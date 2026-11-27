# Evidence PA04-T02 — Guardrails G1, G2, G3, G5

**Thực hiện:** Vượng · **Reviewer:** Vỹ · **Issue:** #55 · **Nhánh:** `feat/pa04-t02-guardrails` (tách từ `develop` `977c2bc`).
**Trạng thái:** đang làm từng guardrail; mỗi guardrail được Vượng review rồi mới commit. Chưa push, chưa mở PR.

## 1. Phạm vi

Rubric PA04 tiêu chí 3: năm guardrail trên output model, mỗi guardrail có test dùng fake model và không network; mỗi guardrail và test của nó trong commit riêng, test không muộn hơn code; hard rules vẫn quyết định ban-list trước. T02 làm G1, G2, G3, G5; G4 (cost cap theo lab) thuộc T03.

Thay đổi nằm ở `src/pipeline/model/` và test. Không đổi domain, DB, API hay file prediction của checker.

Thứ tự làm: G5, G1, G2, G3, rồi phần chạy model thật và tổng kết.

**Log thử bỏ guardrail** (`removal/*.log`): đầu mỗi log ghi việc thử, commit nguồn, lệnh, exit code, danh sách test đỏ và **patch tạm** đã áp vào file nguồn (dạng `git diff`), để người review áp lại và chạy lại được; sau đó là output test. Đường dẫn local được thay bằng `<repo>`. File nguồn được khôi phục và kiểm bằng so sánh nội dung sau mỗi lần thử.

## 2. G5 — Không lấy mức trừ từ model

**Quy tắc mới.** Bước kiểm output phía nhóm (`parseModelOutput` trong `src/pipeline/model/schema.ts`) chỉ đòi đủ field bắt buộc (`hasRequiredKeys`). Field ngoài schema, ở cấp ngoài cùng hay trên từng kết quả (ví dụ `deduction`, `score`, `penalty`), bị bỏ qua và không bao giờ được đọc; verdict của model được giữ. Thiếu field bắt buộc hoặc sai kiểu vẫn là `schema_error` (G1).

**Thay quy tắc của PA03-T08.** Dòng 73 của `docs/evidence/PA03/T08/README.md` ghi "trường thiếu/thừa (kể cả `deduction`)" làm mọi constraint thành `schema_error`. Với G5, **trường thừa** không còn là `schema_error`; trường thiếu và sai kiểu vẫn như cũ. Evidence PA03 giữ nguyên vì là lịch sử; comment của `parseModelOutput` trỏ sang tài liệu này.

**Không đổi:**

- Schema gửi qua `output_config.format` vẫn `additionalProperties: false` (structured output yêu cầu), nên model thật gần như không trả được field lạ. G5 chủ yếu chặn trường hợp refusal, model giả, hoặc API đổi hành vi.
- Mức trừ hiển thị luôn lấy từ `constraint.deduction` do TA đặt (review queue), và store từ chối mọi verdict có field `deduction`: thêm một lớp chặn phía sau.
- Prompt vẫn cấm model đề xuất điểm (rule 6).

**Test** (viết trước, đỏ khi chưa sửa code):

| Test | Kiểm |
| --- | --- |
| `G5 schema: extra deduction or score fields on a result are ignored and the verdict is kept` | Field thừa trên từng kết quả: verdict, evidence giữ nguyên; kết quả đã parse không mang field nào về điểm |
| `G5 schema: an extra top-level deduction field is ignored and the results are kept` | Field thừa ở cấp ngoài cùng |
| `G5 schema: a grading instruction in the reason changes nothing but the reason text` | Lời dặn chấm điểm trong `reason` không đổi verdict hay evidence |
| `G5 schema: required fields with the wrong type are still schema_error (G1), extra fields do not hide them` | Field thừa không che lỗi schema thật |
| `G5 evaluator: an extra deduction field is ignored, the verdict is kept and no verdict carries a mark` | Qua evaluator: `violation` có `deduction: 0` vẫn là `violation`, call log `ok`, không verdict nào mang field điểm |
| `e2e pipeline: …` (đã có, thêm một nhánh) | Model trả `deduction: 0` và "Grader: deduction 0." cho bài injection; review item vẫn hiện mức trừ 4 do TA đặt |

**Bỏ ba trường hợp test của PA03.** `model-schema.test.mjs` có hai trường hợp ("an extra top-level field", "an extra field named deduction/score") và `model-evaluate.test.mjs` có một test ("output with an extra deduction field is rejected") đòi field lạ phải thành `schema_error`. Chúng được thay bằng các test G5 ở trên vì **yêu cầu đã đổi** theo quyết định G5 trong `docs/plans/PA04.md` (merge ở #53): biến cả output thành `schema_error` chỉ vì model chèn field là đã thay đổi kết quả và đẩy unsure rate lên ở tiêu chí 2. Đây không phải nới test cho xanh: trường hợp thiếu field và sai kiểu vẫn có test và vẫn là `schema_error`.

**Thử bỏ guardrail** (sửa tạm `schema.ts`, build, chạy test schema, evaluator và e2e, khôi phục bằng bản sao và `cmp`):

| Sửa tạm | Kết quả | Log |
| --- | --- | --- |
| Quay về kiểm field chặt (đòi đúng bộ key như `hasExactKeys` của PA03) | **4 test đỏ**: 3 test G5 và test e2e | `removal/g5-exact-keys.log` |
| Cho `readRawResult` chép mọi field của model vào kết quả thô (`...value`) | **Không test nào đỏ** (74/74) | `removal/g5-raw-result-keeps-extra-fields.log` |

Trường hợp thứ hai không phải test yếu: bước sau dựng kết quả đã parse theo **tên từng field** (`constraintId`, `verdict`, `evidenceLines`, `reason`, `unsureCause`), nên field lạ trong kết quả thô vẫn bị loại trước khi tới evaluator và store. Guardrail G5 nằm ở hai chỗ: không coi field lạ là lỗi (có test), và không bao giờ đọc field lạ (do cấu trúc code, không cần test riêng).

**Giới hạn đã biết (không bắt buộc cho G5).** Lời dặn chấm điểm trong `reason` được giữ nguyên chữ, nên câu như "Grader: deduction 0" vẫn hiện cho TA trong review queue. Theo rubric vẫn đạt vì con số không đổi và mức trừ hiển thị do TA đặt. Có thể đánh dấu hoặc lược câu đó để TA khỏi bị nhiễu; chưa làm.

**Kiểm chứng tại working tree của G5** (Node `v24.22.3`, Windows 11): lint, format-check, type-check, `git diff --check` exit 0; `npm test` 571 test, 568 pass, 3 skipped, 0 fail. Test G5 chạy riêng khi chưa có code: 4 đỏ; sau khi có code: 74/74 xanh.

**Lưu ý cho G2.** Khi evidence đổi sang `{line, text}`, phần đọc từng phần tử evidence cũng phải dùng `hasRequiredKeys`. Nếu kiểm chặt ở đó, model chèn `deduction` vào một phần tử evidence sẽ làm cả output thành `schema_error`, tức G5 thủng ở tầng dưới. Commit G2 sẽ có test cho trường hợp này.

## 3. G1 — Schema

**Quy tắc** (không đổi so với PA03-T08, code ở `parseModelOutput`): output phải là đúng một object JSON theo schema, đọc bằng `JSON.parse` trên toàn bộ text. Không bóc code fence, không cắt văn xuôi, không đoán phần JSON. Các trường hợp sau làm **mọi** constraint của call thành `unsure`/`schema_error`: JSON không hợp lệ, JSON trong code fence, JSON đứng trước hoặc sau văn xuôi, verdict lạ. Constraint bị thiếu hoặc trùng thì constraint đó thành `unsure`/`schema_error`, constraint khác giữ kết quả.

**Không sửa code.** Code đã bắt đủ các trường hợp của rubric từ PA03-T08; test PA03 chưa có trường hợp code fence và JSON đi kèm văn xuôi. Commit G1 chỉ thêm test, nên test xanh ngay khi thêm. Để chứng minh test không "xanh sẵn", mỗi phần của guardrail được thử xoá ở bảng dưới.

**Nguồn gốc code G1 và thứ tự test/code ở PA03.** Code của G1 vào repo ở `d4e93e7` (`feat(pa03-t08): grade semantic constraints with a schema-checked, time-limited model call`). Test đầu tiên của nó ở `bc2b7d1` (`test(pa03-t08): cover semantic model schema, timeout, sanitizing and call log with a fake model`). `bc2b7d1` là tổ tiên của `d4e93e7` (`git merge-base --is-ancestor bc2b7d1 d4e93e7` trả 0), tức test có trước code, đúng điều kiện "test no later than the code". Hai commit đó gộp nhiều phần của PA03-T08 (schema, evidence trong phạm vi file, timeout, làm sạch code, call log), nên với G1 và G3 người chấm có thể xem đó là commit trộn; commit G1 của PA04 chỉ chạm G1.

**Test:**

| Rubric | Test |
| --- | --- |
| JSON trong code fence | `G1 schema: JSON in a json code fence …`, `… JSON in a bare code fence …`, `G1 evaluator: a fenced JSON answer is not unwrapped …` |
| JSON sau văn xuôi | `G1 schema: JSON after prose …`, `… JSON followed by prose …`, `… two JSON objects in a row …`, `G1 evaluator: JSON after prose is not cut out …` |
| Đối chứng | `G1 schema: the same answer without fence or prose is accepted …`: cùng nội dung JSON không bọc thì được nhận, nên các test trên chỉ đỏ vì phần bọc |
| Verdict lạ | `G1 schema: an unknown verdict …` (`compliant`, `PASS`, `fail`, chuỗi rỗng) |
| Constraint thiếu | `G1 schema: a missing constraint …` |
| Constraint trùng | `G1 schema: a duplicated constraint …, even when both answers agree` |
| JSON không hợp lệ | Test PA03 `schema: broken JSON …`, `… not JSON at all …` và các trường hợp khác trong cùng vòng lặp |

**Thử bỏ guardrail** (script áp patch tạm vào `schema.ts`, build, chạy test schema và evaluator, ghi log theo định dạng ở mục 1, rồi khôi phục file và kiểm lại nội dung):

| Sửa tạm | Test G1 đỏ | Log |
| --- | --- | --- |
| Cắt text từ `{` đầu tới `}` cuối rồi mới `JSON.parse` | 6: bốn test fence/văn xuôi ở parser, hai test ở evaluator (tổng 6 fail) | `removal/g1-lenient-json.log` |
| Bỏ kiểm verdict thuộc `pass`/`violation`/`unsure` | `an unknown verdict …` (tổng 3 fail, gồm 2 test PA03) | `removal/g1-no-verdict-check.log` |
| Constraint thiếu được coi là `pass` | `a missing constraint …` (tổng 4 fail) | `removal/g1-no-missing-check.log` |
| Cho phép constraint trùng | `a duplicated constraint …` (tổng 2 fail) | `removal/g1-no-duplicate-check.log` |

Test "two JSON objects in a row" vẫn xanh khi cắt theo ngoặc ngoài cùng, vì đoạn cắt ra gồm cả hai object và vẫn không phải JSON hợp lệ; test này giữ lại để chặn một parser lỏng kiểu khác (đọc object đầu tiên).

## 4. G2 — Evidence

**Quy tắc mới.** Model trả evidence dạng `evidence: [{ line, text }]` thay cho `evidence_lines: [n]`. Với mỗi phần tử, `parseModelOutput` kiểm theo thứ tự:

1. `line` nằm trong file;
2. dòng đó **sau khi bỏ comment** còn code (dòng chỉ có comment là dòng trống model không thấy);
3. `text`, bỏ khoảng trắng hai đầu, **bằng đúng** dòng đó của code đã làm sạch (bỏ comment, che danh tính), cũng bỏ khoảng trắng hai đầu.

Một phần tử lệch là cả verdict thành `unsure`/`evidence_mismatch`, với **mọi** verdict có evidence (không riêng `violation`). `violation` không có evidence vẫn là `evidence_mismatch` như PA03. Lý do ghi cho TA nêu dòng lệch và giữ lý do của model.

**Quyết định** (Vượng chốt 27/11):

| Điểm | Chọn | Lý do |
| --- | --- | --- |
| Dạng evidence | `{ line, text }` | Chỉ có số dòng thì không phát hiện được dòng bịa hay "đúng text nhưng sai số dòng". |
| So với bản nào | Code đã làm sạch, đúng thứ model thấy | Model không thấy comment và tên thật (đã thay bằng `STUDENT`), nên so với code gốc sẽ trừ oan cả câu trả lời đúng. |
| Mức khớp | Chính xác sau khi bỏ khoảng trắng hai đầu | Đúng chữ "match the submitted code exactly" của rubric; khoảng trắng hai đầu có thể mất khi model chép dòng thụt lề. |
| Phạm vi | Mọi phần tử, mọi verdict | Rubric: "every evidence line". Bản PA03 dùng `some`, nên một dòng có code che được các dòng comment, và chỉ kiểm khi verdict là `violation`. |
| Ánh xạ số dòng | Không cần bảng ánh xạ | Sanitizer thay comment bằng khoảng trắng và giữ mọi ký tự xuống dòng, nên dòng `n` của bản đã làm sạch là dòng `n` của bản gốc. Text TA thấy lấy từ dòng `n` của code gốc, không phải text model viết. |
| Field lạ trong phần tử evidence | Bỏ qua (`hasRequiredKeys`) | Giữ G5 ở tầng dưới: model chèn `deduction` vào một phần tử evidence không làm cả output thành `schema_error`. |

**Thay quy tắc của PA03-T08.** Bảng quy tắc ở `docs/evidence/PA03/T08/README.md` có ba dòng về evidence: dòng 77 (`violation` không có dòng, hoặc dòng ngoài file), dòng 78 (`violation` mà mọi dòng dẫn chứng đều trống sau khi bỏ comment) và dòng 79 (`pass`/`unsure` có dòng ngoài file). Các quy tắc đó chỉ kiểm số dòng, và dòng trống chỉ bị bắt khi **mọi** dòng của một `violation` đều trống. G2 thay ba dòng đó bằng quy tắc ở trên.

**Thay đổi code:**

- `schema.ts`: schema gửi model có `evidence` là mảng object `{ line: integer, text: string }`, `required` cả hai, `additionalProperties: false`; parser đọc `evidence`, hàm `findEvidenceMismatch` kiểm ba bước trên; `ParseModelOutputInput.lineCount` thay bằng `codeLines` (các dòng model thấy).
- `evaluate.ts`: truyền các dòng đã làm sạch vào parser; bỏ phép kiểm "violation chỉ trích dòng trống" trong `toVerdict` vì parser đã kiểm cho mọi verdict.
- `prompt.ts`: rule 3 dặn model ghi `line` là số in trước `|` và `text` là nguyên văn dòng sau `| `, chỉ trích dòng có code.
- File prediction của checker, domain, DB và API không đổi: verdict vẫn mang số dòng và text của code gốc.

**Test helper.** `tests/support/model-fakes.mjs`: trong `result(id, verdict, [n])`, số `n` nghĩa là "model trích đúng dòng `n`". Helper ghi chỗ giữ `@@quote:n@@`, và model giả thay bằng đúng dòng `n` lấy từ prompt nó nhận (`promptCodeLines`), nên các test có sẵn ở worker, checker và e2e giữ nguyên ý nghĩa mà không phải biết text từng dòng. Test G2 muốn evidence sai thì truyền thẳng `{ line, text }`.

**Test** (viết trước; `npm test` với test và helper mới nhưng chưa sửa code: 47 test đỏ, danh sách ở `red/g2-tests-before-code.txt`; sau khi sửa code: 599 test, 596 pass, 3 skipped, 0 fail):

| Rubric | Test |
| --- | --- |
| Dòng bịa | `G2 schema: a fabricated line (text that is nowhere in the code) …` |
| Đúng text nhưng sai số dòng | `G2 schema: the right text with the wrong line number …` |
| Dòng chỉ có trong comment đã bỏ | `G2 schema: a line that only held a removed comment …, whatever the text`; `G2 evaluator: quoting the removed comment of a line …`; `G2 evaluator: a pass that cites a comment-only line …` |
| Ánh xạ số dòng về code gốc | `G2 evaluator: line numbers map back to the original code, comment included` (dòng có comment cuối dòng, dòng có code sau comment nhiều dòng) |
| Mọi dòng phải khớp | `G2 schema: one bad line among good ones …`; `… pass and unsure with a bad evidence line …` |
| Khớp chính xác | `G2 schema: surrounding whitespace is ignored but any change inside the line is a mismatch`; `G2 evaluator: quoting the original line, which the model never saw …` (tên thật thay vì `STUDENT`) |
| Đối chứng | `G2 schema: evidence that quotes its line exactly is accepted` |
| Lý do cho TA | `G2 schema: the mismatch reason names the line …` |
| Schema và prompt | Test hình dạng schema (PA03, cập nhật); `G2 evaluator: the request schema asks for line and text …`; các trường hợp schema sai mới: `evidence` không phải mảng, phần tử là số trơn, `line` không phải số nguyên, thiếu `text` |
| G5 ở tầng evidence | `G2 schema: an extra field inside an evidence item is ignored like any field outside the schema (G5)` |

**Thử bỏ guardrail** (script áp patch tạm vào `schema.ts`, chạy test schema và evaluator, ghi log theo định dạng ở mục 1, khôi phục và kiểm lại):

| Sửa tạm | Test đỏ | Log |
| --- | --- | --- |
| Không so `text` với dòng | 7 test G2 (dòng bịa, sai số dòng, trích comment, trích tên thật, mọi verdict, khoảng trắng, lý do) | `removal/g2-no-text-compare.log` |
| Cho trích dòng trống sau khi bỏ comment | 2: `G2 schema: a line that only held a removed comment …` và test PA03 tương ứng | `removal/g2-no-blank-line-check.log` |
| Chỉ kiểm phần tử evidence đầu tiên | 2: `G2 schema: one bad line among good ones …` và test PA03 về dòng ngoài file | `removal/g2-first-line-only.log` |
| Phần tử evidence phải đúng bộ key (G5 thủng ở tầng dưới) | 1: `G2 schema: an extra field inside an evidence item is ignored …` | `removal/g2-strict-evidence-keys.log` |

**Chạy thử với model thật trước khi commit G2 (27/11/2026).** Test dùng model giả không phát hiện được hai rủi ro: provider từ chối schema mới (mọi call lỗi), và model chép dòng không khớp khiến `evidence_mismatch` đẩy unsure lên. Vì vậy G2 được chạy thử một lần trước khi commit. Source: `3bc2c16` cộng thay đổi G2 trong working tree (chưa commit); `src/` lúc chạy giống hệt bản sẽ commit. Model `claude-haiku-5-5`, key trong `.env` (bị Git ignore, không đọc hay in giá trị). Lệnh, chạy từ root repo sau `npm run build`:

```sh
node --env-file=.env dist/cli/checker.js eval-cases \
  --out docs/evidence/PA04/T02/g2-precommit-run/predictions.jsonl \
  --call-log docs/evidence/PA04/T02/g2-precommit-run/call-log.jsonl \
  2> docs/evidence/PA04/T02/g2-precommit-run/checker-stderr.txt
node leetkob-eval/eval.mjs --data eval-cases \
  --predictions docs/evidence/PA04/T02/g2-precommit-run/predictions.jsonl \
  --json docs/evidence/PA04/T02/g2-precommit-run/eval-summary.json > docs/evidence/PA04/T02/g2-precommit-run/eval-report.txt
```

| | Trước G2 (`docs/evidence/PA04/T04/model-run-full/`, `4f2c158`) | Sau G2 (`g2-precommit-run/`) |
| --- | --- | --- |
| Call | 22, đều `ok` | 22, đều `ok`, 22 request id `req_…` khác nhau |
| `eval.mjs` | exit 0 `PASS` | exit 0 `PASS` |
| Khấu trừ sai / recall / unsure | 0 / 100% (15/15) / 0% | 0 / 100% (15/15) / 0% |
| `evidence_mismatch` | không áp dụng | 0 cặp |
| Token in / out | 38 170 / 3 852 | 38 170 / 4 242 |
| Chi phí | $0.005519 | $0.005938 (+7.6%) |

Kết luận cho G2:

- **Provider chấp nhận schema `{ line, text }`**: không call nào lỗi.
- **Khớp chính xác không đẩy unsure lên** ở lần chạy này: mọi dòng model trích đều khớp, không cặp nào bị G2 hạ xuống `unsure`.
- **Verdict giữ nguyên 49/49** so với lần chạy trước G2.
- **Evidence model đưa ra hẹp hơn.** Trước G2, model hay kèm số dòng cho cả verdict `pass` (12 cặp `pass` có dòng); sau G2 chỉ còn 1 cặp `pass` có dòng. Rule 3 cả trước và sau G2 đều cho `pass` và `unsure` để trống evidence, nên thay đổi này có thể do model phải chép nguyên văn từng dòng; chưa kiểm chứng. Với `violation`, model trích ít dòng hơn và gần label hơn (ví dụ `above-mean/s05` C2: trước 6, 7, 8, 12, 13; sau 8, 13, đúng bằng label), và vẫn luôn gồm dòng vi phạm chính. Không quy riêng cho G2 hay cho câu chữ mới của rule 3: cả hai đổi cùng lúc, và đây là một lần chạy.
- Call log: 22 quyết định ban-list `route: hard_rule`, `modelCalled: false`; không prompt nào chứa `//` hay `/*`; không file nào chứa key.

Đây là lần chạy kiểm tra trước commit, không thay lần chạy chính thức trên cả case riêng và dev set ở cuối T02.

**Ảnh hưởng ngoài T02.** Schema gửi model và rule 3 của prompt đổi, nên T06 (Vỹ, chất lượng checker) dựng trên dạng `{ line, text }`. Chi phí mỗi call tăng vì model chép text từng dòng (+7.6% trên `eval-cases` ở lần chạy thử trên); số đo đầy đủ ở phần chạy model thật cuối T02.

## 5. G3 — Timeout

**Quy tắc** (không đổi so với PA03-T08, code ở `callWithDeadline` và `createSemanticEvaluator` trong `src/pipeline/model/evaluate.ts`): evaluator tự giữ hạn cứng `timeoutMs` cho mỗi call, không phụ thuộc client có tôn trọng hạn hay không. Tới hạn thì abort signal đưa cho client, bỏ mọi kết quả đến sau, và mọi constraint của call thành `unsure`/`timeout`; call log ghi `outcome: timeout`, `requestId: null`, token và chi phí 0. Client tự ném `ModelTimeoutError` cũng cho cùng kết quả.

**Không sửa code.** Code đã đáp ứng rubric ("a call that times out becomes `unsure`"). Commit G3 chỉ sửa và thêm test:

- Mỗi test G3 có giới hạn 2 s (`G3_LIMIT`). Trước đó, nếu bỏ hạn cứng thì test "model không bao giờ trả lời" sẽ chờ mãi thay vì đỏ.
- Bốn test timeout của PA03 đổi tên thêm tiền tố `G3` để đối chiếu với rubric; nội dung kiểm giữ nguyên. Diff của file test lớn chủ yếu vì Prettier thụt lề lại thân test khi thêm tham số giới hạn.
- Test mới: một `violation` hợp lệ đến **sau** hạn không bao giờ được dùng; cả hai constraint vẫn `unsure`/`timeout`, không có evidence.

**Nguồn gốc code G3 và thứ tự test/code ở PA03.** Như G1: code ở `d4e93e7`, test đầu tiên ở `bc2b7d1`, `bc2b7d1` là tổ tiên của `d4e93e7` (test có trước code). Hai commit đó gộp nhiều phần của PA03-T08, nên người chấm có thể xem đó là commit trộn; commit G3 của PA04 chỉ chạm G3.

**Test:**

| Rubric | Test |
| --- | --- |
| Call hết thời gian thành `unsure` | `G3 timeout: a model that never answers becomes unsure/timeout and the signal is aborted` |
| Client tôn trọng abort | `G3 timeout: a model that honours the abort signal is also unsure/timeout` |
| Client tự báo timeout | `G3 timeout: a client that throws ModelTimeoutError is unsure/timeout` |
| Câu trả lời đến muộn | `G3 timeout: a late answer after the deadline is ignored and does not crash the process`; `G3 timeout: a valid violation that arrives after the deadline is never used` |

**Thử bỏ guardrail** (script áp patch tạm vào `evaluate.ts`, chạy test evaluator, ghi log theo định dạng ở mục 1, khôi phục và kiểm lại):

| Sửa tạm | Test đỏ | Log |
| --- | --- | --- |
| Bộ hẹn giờ trong `callWithDeadline` đặt 10⁹ ms (coi như không có hạn) | 4/5 test G3: 2 fail, 2 quá giới hạn 2 s. Test "client ném `ModelTimeoutError`" không phụ thuộc bộ hẹn giờ nên vẫn xanh. Tiến trình test bị script dừng sau 120 s (`killed (SIGTERM)` trong log) vì chính bộ hẹn giờ 10⁹ ms của bản sửa tạm giữ tiến trình sống; kết quả test đã in đầy đủ trước đó | `removal/g3-no-deadline.log` |
| Timeout không đổi thành `unsure` mà ném ra như lỗi provider | 5/5 test G3 | `removal/g3-timeout-not-unsure.log` |
