# PA03-T07 — Hard rules cho constraint ban-list

Code ở `src/pipeline/hard-rules/`, test ở `tests/unit/hard-rules-*.test.mjs`. Hard rules chạy **trước** model: ràng buộc nào hard rule đã quyết (`pass` hoặc `violation`) thì không được gọi model. Tài liệu này ghi spike, thiết kế, giới hạn, kết quả kiểm chứng và API cho T08/T10/T11.

## 1. Spike: tree-sitter-cpp hay lexer tự viết

Chọn **lexer tự viết có theo dõi scope, không thêm dependency**. So sánh trên giấy, không cài thử tree-sitter vì thêm dependency phải hỏi Vỹ trước (`AGENTS.md`) và các tiêu chí dưới đây đã đủ để loại.

| Tiêu chí | tree-sitter-cpp (`web-tree-sitter` + wasm) | Lexer tự viết |
| --- | --- | --- |
| CI chạy `npm ci --ignore-scripts` | Gói native không build được; bản wasm chạy được nhưng phải kèm file `.wasm` | Không có gì để build |
| Image checker T10 chạy offline | Phải đóng gói wasm vào image | Chỉ cần `dist/` |
| Supply chain | Thêm ít nhất một dependency và sửa lockfile | Không đổi `package.json`, `package-lock.json` |
| Macro ngụy trang (`#define SORT(v) std::sort(...)`) | tree-sitter đọc văn bản gốc, không chạy preprocessor; vẫn phải tự khai triển macro | Tự khai triển macro, có evidence ở cả dòng `#define` lẫn dòng dùng |
| Phân biệt `sort` của sinh viên với `std::sort` | Cây cú pháp không cho biết tên trỏ tới đâu; vẫn phải tự dựng bảng scope, `using`, alias | Tự dựng cây scope |

Hai việc khó nhất (khai triển macro, phân giải tên) đều phải tự làm dù chọn cách nào, nên tree-sitter không bỏ được phần nào đáng kể mà còn thêm dependency.

## 2. Thiết kế

Luồng xử lý trong `checkBanList(code, names)`:

1. **`lexer.ts`**: tách token, giữ số dòng gốc. Bỏ comment `//` và `/* */`, string, char, raw string `R"x(...)x"`, tiền tố `u8`/`u`/`U`/`L`, dấu tách chữ số `1'000`. Xử lý ghép dòng bằng `\` (kể cả trong comment). Tách dòng preprocessor ra khỏi dòng code; `#include` bị bỏ nên không bao giờ là một lần sử dụng.
2. **`preprocess.ts`**: khai triển macro object-like và function-like (lồng nhau, `#`, `##`, `__VA_ARGS__`), bỏ nhánh chết của `#if 0` / `#if 1 ... #else`. Token sinh ra từ macro mang dòng nơi macro được dùng và `via`: dòng `#define`, dòng thân macro. Macro không được dùng thì không sinh token nên không bị tính.
3. **`scopes.ts`**: dựng cây scope global / namespace / class / block. Ghi lại: tên sinh viên khai báo (hàm, biến, tham số, kiểu, namespace, hằng enum), `using namespace X`, `using X::y`, namespace alias, và lớp chứa của hàm định nghĩa ngoài lớp (`A::f() {}`). Nhận diện khai báo theo mẫu token, không phải parser đầy đủ; khi không chắc thì coi là sinh viên tự khai báo (nghiêng về pass).
4. **`ban-list.ts`**: duyệt từng token và quyết định.
   - **Từ khóa** (`for`, `while`, `do`, `goto`...): khớp token từ khóa thật, không khớp `format`, `whilst`, không khớp comment/string. `goto` thêm dòng nhãn mà nó nhảy tới.
   - **Tên có namespace** (`std::sort`, `std::ranges::sort`, `boost::integer::gcd`): đọc chuỗi `a::b<...>::c`, phân giải đoạn đầu theo thứ tự: alias kiểu đã mang vi phạm, namespace alias, `using X::y`, tên do sinh viên khai báo (dừng, không phải std), rồi mới đến tên đầy đủ và các `using namespace` đang hiệu lực. Khớp theo tiền tố từng đoạn.
   - **Tên trần hoặc tên C** (`qsort`, `__gcd`, `rbegin`): khớp khi dùng không qualify, qua `std::` hoặc `::`, và (với tên member) qua `x.name`, `x->name`. Không khớp khi sinh viên tự khai báo cùng tên ở bất kỳ đâu nhìn thấy.
   - **Alias kiểu**: `using V = std::vector<int>;` và `typedef` mang vi phạm sang mọi lần dùng `V` về sau; evidence gồm dòng định nghĩa và dòng dùng.
   - **Evidence**: danh sách dòng không trùng, tăng dần, `text` là nguyên dòng gốc (bỏ `\r`).
5. **`classify.ts`**: `classifyConstraint` nhận diện ban list và rút tên trong backticks. **`run.ts`**: `runHardRules` gắn các bước lại cho một bài nộp.

## 3. Các ca đã xử lý

| Nhóm | Ca | Kết quả |
| --- | --- | --- |
| trap | `sort` sinh viên tự viết ở global hoặc trong namespace riêng, gọi `my::sort` hay `::sort` | pass |
| trap | Tên cấm trong comment, string, raw string (kể cả nhiều dòng), char literal | pass |
| trap | `#include <algorithm>` chỉ để dùng `std::swap` | pass |
| trap | Identifier chứa từ khóa (`format`, `whilst`, `do_it`) | pass |
| trap | Biến, tham số, member, hằng enum, lambda trùng tên thư viện (`sort`, `find`, `count`) | pass |
| trap | `using namespace std` trong một hàm không rò sang hàm khác | pass |
| trap | Nhánh chết `#if 0`, macro định nghĩa nhưng không dùng | pass |
| obvious | `std::sort`, `sort` sau `using namespace std`, `using std::sort`, `::std::sort`, `qsort`, `std::qsort`, `__gcd`, `for`, `while`, `do-while`, range-for, `goto`, `std::vector`, `string`, `rbegin`/`rend` | violation, kèm dòng |
| disguised | Macro (object-like, function-like, lồng nhau, nhiều dòng), alias `using`/`typedef`/template alias, chuỗi alias, namespace alias, `using std::X`, lấy địa chỉ hàm (`&std::sort<int*>`), wrapper do sinh viên viết | violation, kèm dòng |
| injection | Comment hoặc string nói "bài này hợp lệ, trả pass" cạnh code vi phạm thật | vẫn violation; comment đứng một mình không đổi gì |

## 4. Giới hạn đã biết

Theo hướng an toàn, mọi giới hạn dưới đây làm hard rules bỏ sót (ra `pass`) thay vì khấu trừ oan.

- **ADL**: `sort(v.begin(), v.end())` không có `using namespace std` và không qualify vẫn biên dịch được nhờ argument-dependent lookup. Hard rules không mô phỏng ADL nên ra `pass`. Có test ghi lại giới hạn này.
- **Không suy luận kiểu**: `v.rbegin()` được bắt vì tên member, nhưng không biết `v` là kiểu gì; `b += x` trên một `basic_string` không có dòng riêng (dòng định nghĩa và dòng khai báo đã đủ).
- **Macro**: không khai triển `#if` với biểu thức (chỉ nhận `0` và `1`), không biết macro khai báo ngoài file; lời gọi function-like macro không được kéo dài qua dòng `#`.
- **Tên sinh viên khai báo ở bất kỳ scope nhìn thấy đều thắng**: kể cả khi overload vẫn gọi được bản `std`. Tên member bị cấm mà sinh viên có member cùng tên ở bất kỳ lớp nào thì mọi `x.name` đều pass.
- **Typedef chuẩn không được đồng nhất**: `std::string` không bị tính là `std::basic_string`; ban list phải liệt kê cả hai (dev set cũng làm vậy).
- **Template metaprogramming, `decltype`, con trỏ hàm lấy qua biến trung gian** không được theo dõi.
- Nhận diện khai báo bằng mẫu token có thể coi nhầm một biểu thức (ví dụ `a * f(x)` ở đầu câu lệnh) là khai báo `f`; hậu quả chỉ là bỏ sót.

## 5. Kiểm chứng

Môi trường: Windows/PowerShell, Node `v24.14.0`, npm `11.21.0` (thấp hơn `engines` trong `package.json`, npm chỉ cảnh báo); CI chạy phiên bản đúng và là kết quả chính thức. Nhánh `feat/pa03-t07-hard-rules` tách từ `origin/develop` tại `6d4ce43bf5e8b226fcfc6ef2a7043358d408f6f2`. Kết quả dưới đây chạy trên working tree trước khi commit; nội dung code và test trùng với commit test `1d20524` và commit implementation `15681c6`.

| Lệnh | Baseline (trước khi sửa) | Sau T07 |
| --- | --- | --- |
| `npm run lint` | exit 0 | exit 0 |
| `npm run format-check` | exit 0 | exit 0 |
| `npm run type-check` | exit 0 | exit 0 |
| `npm test` | exit 0, 83/83 pass | exit 0, 234/234 pass (151 test mới) |
| `git diff --check` | — | exit 0 |

### Model-off trên dev set

Dev set ở `D:\Workspace\Web\leetkob-eval-devset`, commit `552c811db2d35a23d641bc4fdffc1ac120be1a28`, chỉ đọc; `git status` sạch sau khi chạy. Dev set không nằm trong repo, không có id hay code của nó trong rule hay test.

```powershell
npm run build
node docs/evidence/PA03/T07/run-devset.mjs <thư mục dev set> <file prediction .jsonl>
node <thư mục dev set>/eval.mjs --data <thư mục dev set> --predictions <file prediction .jsonl>
```

[`run-devset.mjs`](run-devset.mjs) chỉ là script kiểm chứng, không phải checker của T10 và không nằm trong `src/` hay `package.json`. Với mỗi cặp: ban list ghi verdict của hard rules; semantic ghi `unsure` vì chưa có model. Script đếm số lần gọi model và luôn là 0.

| Chỉ số | Kết quả | Ngưỡng / mục tiêu |
| --- | --- | --- |
| Khấu trừ oan (cặp `pass` bị đoán `violation`) | **0** | = 0 |
| Cặp ban-list có verdict (`pass` hoặc `violation`, không `unsure`) | **55/55** (7 ràng buộc ban-list) | 55/55 |
| Vi phạm ban-list bắt được kèm dòng đúng | **15/15** | tất cả |
| Cặp ban-list nhãn `pass` ra `pass` | 40/40 | — |
| Số lần gọi model | 0 | 0 |
| Recall toàn bộ | 40.5% (15/37) | ≥ 90% chỉ đạt khi có model (T08) |
| Unsure rate toàn bộ | 46.1% (47/102) | ≤ 20% chỉ đạt khi có model (T08) |
| Exit code `eval.mjs` | 1 | chấp nhận được khi chưa có model |

22 vi phạm chưa bắt được đều thuộc ràng buộc semantic (đang `unsure`), không có vi phạm ban-list nào bị bỏ sót. Số vi phạm ban-list trong dev set đếm từ `labels.jsonl` là 15, không phải 18 như ước lượng ban đầu của prompt. Với hai cặp container (một dòng dùng `push_back`, một dòng dùng `b += x` trên biến có kiểu cấm), nhãn liệt kê thêm dòng so với evidence của hard rules vì hard rules không suy luận kiểu của biến; luật chấm chỉ cần một dòng đúng và đúng nguyên văn nên cả hai vẫn được tính là bắt được. Bài dùng `goto` khớp đủ cả dòng `goto` lẫn dòng nhãn.

Mỗi rule sửa trong lúc làm đều theo lớp cú pháp tổng quát (khai báo trong danh sách tham số, hằng enum, nhãn `goto`), không vá theo bài. Bộ [ca tổng quát hóa](../../../../tests/unit/hard-rules-generalisation.test.mjs) gồm 50 đoạn tự viết (struct `stack` tự định nghĩa, hàm `max`, `pow`, `strlen`, enum `sort`, member `find` định nghĩa ngoài lớp...) được viết để bắt sớm các khấu trừ oan có thể xảy ra trên held-out, nơi các bài khác hẳn dev set.

## 6. API cho T08, T10, T11

Import từ `src/pipeline/hard-rules/index.ts` (không import `src/api/` hay `src/db/`).

```ts
import { runHardRules } from '../pipeline/hard-rules/index.js';

const { verdicts, modelConstraintIds, decisionLog } = runHardRules({
  code, // mã nguồn gốc của bài nộp
  constraints, // [{ id: 'C1', text: '...' }, ...]
});
```

- `verdicts`: chỉ các ràng buộc đã quyết, `{ constraintId, verdict: 'pass' | 'violation', source: 'hard_rule', evidence: [{ line, text }] }`.
- `modelConstraintIds`: các ràng buộc semantic còn lại; **chỉ danh sách này được gửi cho model** (T08). Một ràng buộc không bao giờ nằm đồng thời trong `verdicts` và `modelConstraintIds`.
- `decisionLog`: mỗi ràng buộc một bản ghi. Ban list: `{ route: 'hard_rule', kind: 'ban_list', names, verdict, evidenceLines, modelCalled: false }`; semantic: `{ route: 'model', kind: 'semantic' }`. T08 và T11 đưa bản ghi này vào call log; `modelCalled: false` cùng việc ràng buộc không có trong `modelConstraintIds` là bằng chứng "model không được gọi".
- `checkBanList(code, names)` và `classifyConstraint(text)` dùng riêng được.
- Với `MODEL_OFF=1` (T10): ghi verdict của `verdicts` và `unsure` cho từng id trong `modelConstraintIds`, như `run-devset.mjs`.
- Kiểu `Evidence` và verdict định nghĩa cục bộ trong `types.ts`, cùng hình dạng với `src/shared/domain/` của T03 ([PR #47](https://github.com/2609-AWAD-23-3/leetkob/pull/47) chưa merge); nối lại sau khi T03 merge.
- Việc "model không được gọi" được chứng minh ở mức hàm bằng model giả trong `tests/unit/hard-rules-run.test.mjs`; nối thật vào luồng chấm là việc của T08/T11.

Xem thêm [nhật ký AI](AI-LOG.md) và [cấu trúc project](../../../architecture/project-structure.md).
