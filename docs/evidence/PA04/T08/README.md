# Evidence PA04-T08 — Sẵn sàng cho lần chạy held-out

**Thực hiện:** Vượng · **Reviewer:** Vỹ · **Issue:** #61 · **Nhánh:** `feat/pa04-t08-held-out` (tách từ `develop` `5037508`).
**Trạng thái:** đã hoàn thành sáu bước và mở [PR #94](https://github.com/2609-AWAD-23-3/leetkob/pull/94); còn lần chạy kiểm chứng cuối sau T06 trên tag `pa4`.

## 1. Mục tiêu

Rubric PA04 tiêu chí 2 (20 điểm): người chấm build checker image, chạy lệnh checker **một lần** trên held-out set trong container của họ, không có network ngoài một proxy chỉ cho đi tới model host ghi trong README, container bị dừng sau 30 phút, rồi chấm output bằng bản `eval.mjs` của họ. Model được gọi bằng key trong `marking.env` nhóm đính kèm cạnh file zip. Lệnh lỗi, file không hợp lệ (`eval.mjs` exit 2) hoặc bị dừng trước khi ghi file là 0 điểm; không có `marking.env` dùng được thì chạy với model tắt.

T08 bảo đảm lần chạy đó không thất bại vì môi trường.

## 2. Quyết định (Vượng chốt 28/11)

| # | Vấn đề | Chọn |
| --- | --- | --- |
| 1 | Checker đi qua proxy | Đặt `ENV NODE_USE_ENV_PROXY=1` trong checker image; chỉ sửa code client nếu thử thật cho thấy SDK không đi qua proxy |
| 2 | Cách thử proxy ở local | Tự viết proxy CONNECT nhỏ bằng Node trong `scripts/`, chỉ cho đi tới `api.anthropic.com:443`; checker chạy trong mạng Docker `internal`. Không tải image proxy bên ngoài |
| 3 | Truyền key vào container | `docker run --env-file marking.env …`. Quy tắc `AGENTS.md` cấm `--env-file` áp cho container **sandbox** chạy code sinh viên; checker không chạy code sinh viên |
| 4 | Nội dung `marking.env` | Chỉ `MODEL_API_KEY` và `MODEL_TIMEOUT_MS` |
| 5 | Call log khi `unsure` | Ghi thêm `reason` của verdict, không ghi nguyên output của model |

Key cho `marking.env`: Vượng tạo một key riêng (`pa04-held-out-run`) trong workspace Anthropic của nhóm, dùng chung giới hạn chi tiêu của workspace (còn khoảng $4.94 ngày 28/11); thu hồi khi có điểm PA04. Vỹ nộp bài nên nhận `marking.env` qua tin nhắn riêng ngay trước khi nộp. Key không bao giờ nằm trong repo, image, file zip, Issue hay PR.

## 3. Bước 1 — `marking.env` không vào Git và image

**Vấn đề.** `.gitignore` và `.dockerignore` chỉ loại `.env` và `.env.*`; không mục nào khớp `marking.env`. Nếu file nằm trong thư mục repo, `git add .` sẽ đưa key lên repo public và `docker build` sẽ chép key vào build context của checker image.

**Thay đổi.**

- `.gitignore`: thêm `marking.env` (tên không có `/` khớp ở mọi thư mục).
- `.dockerignore`: thêm `marking.env` (gốc context) và `**/marking.env` (mọi thư mục).
- Test `tests/unit/held-out-secrets.test.mjs`: hai file ignore có các dòng trên và không có dòng `!` nào đưa `marking.env` trở lại. Test chỉ đọc file, không gọi `git` hay Docker.

**Kiểm chứng.**

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Test trước khi sửa hai file ignore | Đỏ, 2/2 fail | `step1-red.txt` |
| Test sau khi sửa | 2/2 pass | |
| `git check-ignore -v --no-index marking.env docs/marking.env eval-cases/marking.env` | Cả ba khớp `.gitignore:26:marking.env` | |
| `.env.example` vẫn được Git theo dõi | Có (`git check-ignore` không khớp) | |
| `npm run lint`, `npm run format-check`, `npm run type-check`, `git diff --check` | exit 0 | |
| `npm test` (Node `v24.22.3`, Windows 11) | exit 0: 572 test, 569 pass, 3 skipped (Postgres), 0 fail | |

## 4. Bước 2 — Checker đi qua proxy tới model host

**Vấn đề.** Container của người chấm chỉ ra ngoài được qua proxy. SDK model (`@anthropic-ai/sdk` 1.12.0) dùng `fetch` toàn cục của Node; `fetch` chỉ đọc `HTTPS_PROXY` khi bật `NODE_USE_ENV_PROXY=1`. Checker image trước bước này không bật cờ đó.

**Script thử** (`npm run test:held-out-proxy`, file `scripts/test-held-out-proxy.mjs` và `scripts/held-out-proxy.mjs`):

1. Build checker image.
2. Tạo mạng Docker `--internal` (không ra được Internet).
3. Chạy proxy CONNECT tự viết trong một container dùng chính base image của checker (`node:24.22.3-bookworm-slim`, không tải image khác), nối cả mạng internal lẫn mạng thường, chỉ cho CONNECT tới `api.anthropic.com:443`; mỗi kết nối ghi một dòng log (host, cho phép hay từ chối), không ghi nội dung.
4. Kiểm môi trường thử: từ mạng internal không gọi thẳng được model host; qua proxy thì host khác bị từ chối.
5. Chạy checker như lệnh sẽ ghi trong README: chỉ `--env-file <file env>` và `-e HTTPS_PROXY=…`; **không** truyền `NODE_USE_ENV_PROXY`, để kiểm đúng cấu hình trong image.
6. Chấm bằng `leetkob-eval/eval.mjs`; kiểm call log (mọi call `ok`, có request id `req_…`) và log proxy (chỉ có kết nối tới model host được cho qua).
7. Dọn container, mạng và file env tạm.

Key: mặc định script lấy `MODEL_API_KEY` và `MODEL_TIMEOUT_MS` từ `.env` vào một file env tạm (quyền 600, xoá khi xong) và không in giá trị; `--env-file marking.env` dùng đúng file sẽ nộp (bước 6).

**Thay đổi.** `docker/checker.Dockerfile` thêm `ENV NODE_USE_ENV_PROXY=1` ở image chạy. Không có `HTTPS_PROXY` thì cờ không làm gì.

**Kết quả** (`eval-cases`, model `claude-haiku-5-5`, key dev trong `.env`):

| Lần chạy | Image | Kết quả script | Model call | `eval.mjs` | Evidence |
| --- | --- | --- | --- | --- | --- |
| Trước khi sửa | Chưa có cờ | `FAIL` | 22 call đều `provider_error`, 0 request id; proxy không thấy kết nối nào tới model host | exit 1: recall 26.7%, unsure 55.1% (bằng mức model tắt) | `step2-red/` |
| Sau khi sửa | Có cờ | `PASS` | 22 call `ok`, 22 request id; proxy chỉ cho qua `api.anthropic.com:443`, từ chối 1 kết nối (lần thử host khác) | exit 0 `PASS`: 0 khấu trừ sai, recall 100%, unsure 0%; checker 14 s; $0.005516 | `step2-green/` |

Lần chạy đỏ cho thấy rủi ro thật: checker vẫn exit 0 và ghi file hợp lệ, nhưng mọi constraint ngữ nghĩa thành `unsure`, nên nếu nộp image cũ, lần chạy held-out của người chấm sẽ ra kết quả như model tắt.

**Ghi chú:**

- Có hai lần chạy xanh trước lần trong bảng, cùng image: lần đầu dòng kiểm "proxy từ chối host khác" in chi tiết lỗi không rõ nghĩa (`0`), nên script được sửa để in thông điệp lỗi; lần hai, sau đó lint yêu cầu đổi một kiểm tra `^req_` bằng regex sang `startsWith` (cùng ý nghĩa). Lần trong bảng chạy bằng đúng script được commit. Lần hai có 1 cặp `unsure` (`rotate-array/s04` C3, cause `model_unsure`: model tự trả `unsure`, không phải guardrail), recall 93.3%, vẫn `PASS`. Log đỏ trong `step2-red/` tạo bằng script trước hai lần sửa này; phần kiểm tra không đổi.
- `npm run test:checker-image` (4 cách chạy image với model tắt) vẫn đạt sau khi thêm cờ.
- Một lần `npm test` có test `application logger redacts authorization and request bodies` (`tests/integration/auth-runtime.test.mjs`) lỗi `spawnSync … ETIMEDOUT` ngay sau khi build Docker; chạy lại thì đạt (572 test, 569 pass, 3 skipped). Test này không liên quan tới thay đổi của bước 2.
- Lint, format-check, type-check, `git diff --check` exit 0.

**Sau review của Vượng (bước 2, trước commit).**

- **Rủi ro lộ key khi nén repo.** Requirement bắt nộp zip cả repo kèm `.git`, `marking.env` để cạnh zip. `.env` (key dev) và `marking.env` đều nằm ở thư mục gốc; nén nguyên thư mục làm việc sẽ đưa cả hai vào zip, `.gitignore` không chặn được. README (mục "Lần chạy held-out") ghi cách nén từ một bản clone sạch ở tag `pa4` và hai lệnh kiểm nội dung zip, dành cho T10. Đã thử trên một bản clone local: zip tạo bằng `tar.exe` của Windows là zip thật (header `PK`, .NET đọc được 3 074 mục), có `.git` (2 326 mục dưới `leetkob/.git/`), không có `.env` hay `marking.env`. `tar` trong Git Bash là GNU tar 1.35 và tạo **file tar** dù đặt đuôi `.zip`, nên README chỉ dùng `tar.exe` trong PowerShell.
- **Comment trong Dockerfile đã cũ.** Ví dụ ở đầu file chỉ có cách chạy khi tắt model, và một comment ghi người chấm chạy với `--network none`. Đã thêm ví dụ chạy qua proxy (`--env-file marking.env -e HTTPS_PROXY=…`) và sửa comment: lần chạy held-out chỉ ra ngoài qua proxy, lần chạy model tắt dùng `--network none`.
- **README chưa có hướng dẫn held-out.** Thêm mục "Lần chạy held-out (PA04)" trong phần checker: model host `api.anthropic.com:443`, nội dung `marking.env`, lệnh Linux và PowerShell qua proxy, cách chạy khi không có key (`MODEL_OFF=1`), vì sao `--env-file` dùng được cho checker mà bị cấm cho sandbox, lệnh `npm run test:held-out-proxy`. Dòng hướng dẫn cũ "truyền key bằng `-e MODEL_API_KEY`" cập nhật thêm `--env-file marking.env`. Thời gian chạy và concurrency bổ sung ở bước 4.
- **Lệnh clone chạy trong repo sẽ lồng thư mục.** Vượng nhắc `git clone … leetkob` chạy ngay trong repo sẽ tạo `leetkob/leetkob`; README ghi thêm là chạy ở thư mục ngoài repo, và tag `pa4` do T10 tạo trước khi nộp (chưa tồn tại lúc này là bình thường).

## 5. Bước 3 — `reason` trong call log của checker

**Vấn đề.** Ở lần chạy model thật cuối T02, G2 hạ `digit-sum/s06` C2 thành `unsure`/`evidence_mismatch`, nhưng call log của checker chỉ ghi `unsureCause`, không ghi lý do, nên không biết dòng nào lệch. Lần chạy held-out cũng chỉ để lại call log này nếu có gì bất thường.

**Thay đổi** (`src/cli/run.ts`): decision `unsure` của đường model có thêm field `reason`:

- verdict `unsure` từ evaluator: `reason` của verdict, tức lý do model đưa ra (`model_unsure`) hoặc lý do bước kiểm output hạ verdict xuống (`schema_error`, `evidence_mismatch`, `timeout`);
- lỗi provider: thông điệp lỗi (`provider_error`).

Decision `pass`, `violation`, hard rule và `model_off` không có `reason`, để call log không phình. Không ghi nguyên output của model (quyết định 5). File prediction không đổi. README (mục checker) ghi field mới.

**Test** (`tests/unit/checker-run.test.mjs`, model giả, không network):

| Test | Kiểm |
| --- | --- |
| `T08 call log: a model unsure and an evidence mismatch record the reason; other decisions do not` | `model_unsure` ghi đúng lý do model; `evidence_mismatch` ghi lý do của bước kiểm evidence kèm lý do model; mọi decision khác không có `reason` |
| `T08 call log: a schema error records the reason, a pass verdict from the model does not` | `schema_error` có `reason`; `pass` không có |
| `T08 call log: a provider error records its message as the reason` | `provider_error` có thông điệp lỗi |
| `T08 call log: model off and hard-rule decisions have no reason field` | Canh hành vi hiện có: `model_off` và hard rule không có `reason` |

**Kiểm chứng.**

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Test trước khi sửa `run.ts` | Đỏ: 3 test T08 (test thứ tư canh hành vi hiện có nên xanh) | `step3-red.txt` |
| Test sau khi sửa | 13/13 test của file xanh | |
| `npm run lint`, `npm run format-check`, `npm run type-check`, `git diff --check` | exit 0 | |
| `npm test` | exit 0: 576 test, 573 pass, 3 skipped (Postgres), 0 fail | |

**Sửa kỳ vọng của một test trước commit.** Bản đầu của test đầu tiên đòi lý do `evidence_mismatch` chứa số dòng (`999`). Thông điệp có số dòng là của G2 (PR #92), chưa có trên nhánh này; trên `develop` lý do là "its evidence lines are missing or outside the file". Yêu cầu của bước 3 là ghi lại lý do, không phải định dạng lý do, nên test kiểm lý do có chữ `evidence` và lý do của model. Sau khi sửa, kiểm lại hai chiều: bỏ thay đổi ở `run.ts` thì đúng 3 test đỏ như `step3-red.txt`, có thay đổi thì xanh. Khi G2 vào `develop`, lý do sẽ nêu dòng lệch; bước 5 kiểm điều này trên lần chạy thật.

**Sau review của Vượng (bước 3, trước commit).**

- **Lỗi kết nối mất nguyên nhân gốc.** SDK báo lỗi kết nối bằng `APIConnectionError` với thông điệp "Connection error." và giữ lỗi thật trong chuỗi `cause`; client của nhóm (`src/pipeline/model/client.ts`) chỉ chép thông điệp đó vào `ModelProviderError`, nên `reason` của 22 `provider_error` ở lần chạy đỏ bước 2 sẽ không cho biết vì sao. Client giờ nối chuỗi `cause` (tối đa 4 tầng, kèm `code` nếu có) vào thông điệp, qua cùng bước che key như trước. Sửa ở client nên log của worker cũng có nguyên nhân gốc. Test `T08 real client: a connection failure keeps its root cause in the message, without the key` (đỏ trước khi sửa, `step3b-red.txt`): fetch ném `TypeError('fetch failed')` với `cause` là lỗi proxy 403 có chứa key; thông điệp phải có cả ba tầng và không có key.
- **Thiếu test cho `timeout`.** Thêm `T08 call log: a timeout records the reason` (model không bao giờ trả lời, hạn 30 ms; `reason` có "did not answer within 30 ms"). Test xanh ngay khi thêm vì thay đổi đầu tiên của bước 3 đã ghi `reason` cho mọi `unsure` từ evaluator; test chỉ bổ sung độ phủ cho đủ các loại `unsure`.
- **Kiểm trên đường mạng thật** (`step3-proxy-refused/`): checker chạy trên máy, đi qua proxy thử cấu hình **từ chối** model host. 22 call đều `provider_error` (không tốn tiền), cả 27 decision `provider_error` có `reason`, và `reason` là: `Anthropic API call failed (no HTTP status): Connection error. (cause: fetch failed <- Request was cancelled. [0] <- Proxy response (403) !== 200 when HTTP Tunneling [UND_ERR_ABORTED])`. Key không xuất hiện trong call log.
- **Kiểm tra sau khi sửa:** lint, format-check, type-check, `git diff --check` exit 0; `npm test` 578 test, 575 pass, 3 skipped, 0 fail (thêm 2 test so với bảng ở trên).

## 6. Bước 4 — Thời gian chạy và concurrency

**Câu hỏi.** Người chấm dừng container sau 30 phút. Held-out set chưa biết cỡ. Concurrency mặc định của checker (4) có đủ nhanh, và có làm provider giới hạn tốc độ không?

**Đo.** Chạy `npm run test:held-out-proxy -- --data leetkob-eval` (dev set, 102 cặp, 39 call model) qua proxy thử, cùng điều kiện như người chấm, ở concurrency mặc định 4 và ở 8 (`--concurrency 8`, tham số mới của script thử, chỉ truyền tiếp cho checker). Key dev trong `.env`, model `claude-haiku-5-5`.

| Concurrency | Thời gian container checker | Call | Độ trễ mỗi call p50 / p90 / max | `eval.mjs` | Chi phí | Evidence |
| ---: | ---: | --- | --- | --- | --- | --- |
| 4 (mặc định) | 20 s | 39, đều `ok` qua proxy | 1.68 / 2.32 / 5.06 s | `PASS`: 0 khấu trừ sai, recall 97.3% (36/37), unsure 1.0% | $0.009136 | `step4-timing/dev-set-c4/` |
| 8 | 11 s | 39, đều `ok` qua proxy | 1.68 / 2.37 / 4.54 s | `PASS`: 0 khấu trừ sai, recall 100%, unsure 0% | $0.009150 | `step4-timing/dev-set-c8/` |

Độ trễ mỗi call gần như không đổi khi tăng gấp đôi concurrency, và không call nào lỗi, nên ở mức 8 chưa thấy dấu hiệu provider giới hạn tốc độ.

**Build image trên máy chưa có cache** (sau review của Vượng: script thử build có dùng cache Docker, không phản ánh máy người chấm phải chạy `npm ci` từ đầu). `docker build --no-cache --progress=plain -f docker/checker.Dockerfile -t leetkob-checker:nocache .`: exit 0, **48 s**, trong đó `npm ci` 16.0 s và `npm run build` cộng `npm prune` 23.7 s; image 406 MB. Base image `node:24.22.3-bookworm-slim` đã có sẵn trên máy (330 MB sau khi giải nén), nên thời gian tải base image chưa được tính và tuỳ mạng của người chấm. Log: `step4-timing/build-nocache.txt`. Đầu vào của build (`src/`, `package*.json`, Dockerfile) không đổi từ `cbcfe38`.

Cộng lại: build khoảng 1 phút cộng thời gian tải base image, chạy checker trên dev set 20 s, xa giới hạn 30 phút.

**Ước lượng cho held-out** (thời gian ≈ số call × độ trễ ÷ concurrency):

- Bình thường, ở mức 4: khoảng 2 call/giây (39 call trong 20 s), tức 30 phút đủ cho khoảng 3 500 call; dev set chỉ cần 39.
- Trường hợp xấu nhất, mọi call đều chạm hạn `MODEL_TIMEOUT_MS=30000`: mức 4 xử lý 4 call mỗi 30 s, tức khoảng 240 call trong 30 phút, gấp khoảng 6 lần dev set. Một lần call lỗi thật sẽ trả `unsure` và checker vẫn ghi đủ file.

**Quyết định (Vượng chốt 28/11): giữ concurrency mặc định 4.** Đủ nhanh với dư lớn, và ít rủi ro chạm giới hạn tốc độ của tài khoản hơn mức 8 nếu held-out lớn. Không yêu cầu người chấm truyền thêm tham số; lệnh trong README giữ nguyên.

**Ghi chú:**

- Cặp `unsure` duy nhất ở lần chạy mức 4 là `dynamic-array/s05` C2, cause `model_unsure`. Call log ghi `reason` mới của bước 3: model nói code dùng `std::basic_string<int>` (container của thư viện, cấp phát qua `std::allocator`) nên không tự quyết được có đạt ý "tự quản lý bộ nhớ" hay không. Đây là lần đầu `reason` cho biết lý do của một `unsure` thật.
- README (mục "Lần chạy held-out") ghi số đo này.

## 7. Bước 5 — Chẩn đoán `evidence_mismatch`

**Bối cảnh.** Lần chạy cuối của T02 có một cặp vi phạm thật (`digit-sum/s06` C2) bị G2 hạ thành `unsure`/`evidence_mismatch`, nhưng không biết dòng nào lệch. Sau khi T02 merge (PR #92), nhánh T08 merge `develop` (`fd57762`, không xung đột: hai bên không sửa chung file nào); `npm test` 609 test, 606 pass, 3 skipped, 0 fail; lint, format-check, type-check exit 0.

**Ba lần chạy có `reason`** (tại `fd57762`, checker trên máy, key dev, model `claude-haiku-5-5`, concurrency 4; mỗi lần `eval-cases` 49 cặp và dev set 102 cặp; `step5-diagnosis/run1..3/`, call log tách thành `decisions.jsonl` và `model-calls.jsonl` bỏ prompt):

| Lần | `eval-cases` | Dev set |
| --- | --- | --- |
| 1 | `PASS`: 0 khấu trừ sai, recall 100%, unsure 0% | `PASS`: 0 khấu trừ sai, recall 97.3%, unsure 1.0% |
| 2 | `PASS`: 0 / 100% / 0% | `PASS`: 0 / 97.3% / 1.0% |
| 3 | `PASS`: 0 / 93.3% / 2.0% | `PASS`: 0 / 97.3% / 1.0% |

183 call, đều `ok` với request id `req_…`, tổng $0.048858. Trên 453 lượt quyết (151 cặp × 3), có 4 `unsure`:

- 3 là `model_unsure` (model tự trả `unsure`, kèm lý do): `binary-search/s04` C2 hai lần (code dùng `std::lower_bound`; model băn khoăn đó là vi phạm "tự viết" hay không) và `dynamic-array/s05` C2 một lần (dùng `std::basic_string<int>` thay vì tự cấp phát). Đây là phán đoán của model, việc của T06.
- 1 là `evidence_mismatch`: lại đúng `digit-sum/s06` C2, `reason` giờ nêu **dòng 9**: `while ((c = std::getchar()) != EOF && c != '\n') {`.

3/151 cặp đổi verdict giữa ba lần chạy (`digit-sum/s06` C2, `binary-search/s04` C2, `dynamic-array/s05` C2). Đây chưa phải ba lần chạy lặp của T05 (khác commit và cách chạy), chỉ là số liệu tham khảo.

**Xác nhận nguyên nhân.** Script chẩn đoán `step5-diagnosis/diag-line9.mjs` (không thuộc code sản phẩm) gọi model 10 lần với đúng prompt của `digit-sum/s06` C2 và in nguyên văn text model trích cho từng dòng (`line9-quotes.jsonl`, mỗi dòng có request id; $0.002351):

- 20 phần tử evidence, 4 lệch, cả 4 ở dòng 9.
- Code có hai ký tự `\` và `n`. Ở 6/10 lần model viết đúng `\\n` trong JSON; ở 4/10 lần model viết `\n`, là escape JSON của ký tự xuống dòng, nên text sau khi parse chứa **một ký tự xuống dòng thật** thay cho `\n`. G2 so chính xác nên hạ verdict xuống `unsure`.

**Ý nghĩa cho lần chạy held-out.** Dòng vi phạm có `\` (`'\n'`, `"%d\n"`, `"\t"`) rất thường gặp trong code C++. Với những dòng đó, khoảng 4/10 lần trích sẽ lệch, verdict thành `unsure`: không trừ oan (an toàn), nhưng làm giảm recall ở tiêu chí 2. G2 làm đúng quy tắc đã chốt; vấn đề là quy tắc chưa tính tới lỗi escape của model.

**Hướng sửa.** Vượng chốt hướng 1 (28/11), làm ở nhánh riêng `fix/pa04-t02-g2-json-escape`, [PR #93](https://github.com/2609-AWAD-23-3/leetkob/pull/93), evidence ở `docs/evidence/PA04/T02/README.md` mục 10. Sau khi sửa, 10 call trên dòng 9 có 5 phần tử mất escape và cả 10 giữ `violation`; `eval-cases` và dev set `PASS` với 0 khấu trừ sai. Ba hướng đã cân nhắc:

1. **G2 chấp nhận đúng một biến đổi: dòng code bị đọc như chuỗi JSON.** So `text` với dòng code như hiện tại; nếu lệch, so tiếp với dòng code sau khi giải các escape JSON hợp lệ trong dòng (`\n` thành xuống dòng, `\t` thành tab, `\"` thành `"`, `\\` thành `\`, `\uXXXX`, …); dấu `\` khác (ví dụ `\0`) giữ nguyên, không đòi cả dòng là thân chuỗi JSON hợp lệ. Đây đúng là quy tắc đã làm ở PR #93 (`decodeJsonEscapes`, README T02 mục 10). Biến đổi này xác định duy nhất từ dòng code thật, nên không mở đường cho dòng bịa hay sai số dòng; mọi khác biệt khác vẫn là lệch. Đây là thay đổi của G2: commit riêng, test trước (gồm trường hợp `'\n'`, `"%d\n"`, `\"`), thử xoá, chạy lại model thật.
2. **Dặn trong prompt** phải escape `\` khi chép dòng. Đụng prompt (T06, Vỹ) và không chắc model luôn làm theo.
3. **Giữ nguyên**, chấp nhận mất recall ở các dòng có `\`.

## 8. Bước 6 (thử sớm) — Chạy với đúng `marking.env` sẽ nộp

**Vì sao thử sớm.** Plan đặt lần chạy thử cuối sau T06, vì image người chấm build là code ở tag `pa4`. Nhưng key trong `marking.env` là key mới tạo; nếu key sai, chưa có quyền hay hết hạn mức thì cần biết sớm, không phải sát hạn nộp. Lần này chạy với code hiện tại; lần cuối sẽ chạy lại cùng lệnh trên code sau T06.

**File `marking.env`** (ngoài Git: `.gitignore`, `.dockerignore` và `.git/info/exclude` của máy dev đều bỏ qua). Kiểm bằng script, không in giá trị:

- Có đúng hai biến `MODEL_API_KEY` và `MODEL_TIMEOUT_MS`.
- Key khác key dev trong `.env` (key riêng cho lần chạy held-out).
- File dùng xuống dòng CRLF (tạo trên Windows) và dòng cuối không có ký tự xuống dòng. Checker `trim()` cả hai biến (`readModelConfig` trong `src/pipeline/model/client.ts`), nên ký tự `\r` thừa không làm hỏng key hay timeout; lần chạy dưới xác nhận điều này. Nên lưu file bằng LF trước khi đính kèm để chắc chắn với mọi cách đọc file env.

**Lệnh** (tại `45f659c`, gồm T02 và bản sửa G2 ở PR #93):

```sh
npm run test:held-out-proxy -- --env-file marking.env
```

**Kết quả** (`step6-early-marking-env/`, call log tách bỏ prompt):

| Kiểm | Kết quả |
| --- | --- |
| Mạng internal không ra thẳng được model host | `PASS` (`EAI_AGAIN`) |
| Proxy từ chối host khác | `PASS` |
| Checker | exit 0, 14 s |
| `eval.mjs` trên `eval-cases` | exit 0 `PASS`: 0 khấu trừ sai, recall 100% (15/15), unsure 0% (0/49) |
| Model call | 22, đều `ok` qua proxy, 22 request id `req_…`, độ trễ tối đa 4.0 s, $0.006278 |
| Proxy | chỉ cho qua `api.anthropic.com:443`, từ chối 1 kết nối (lần thử host khác) |
| Key trong file kết quả | không file nào chứa key dev hay key held-out (kiểm 7 file) |

**Còn lại cho lần chạy cuối:** sau khi T06 merge, chạy lại đúng lệnh trên code sẽ gắn tag `pa4`, ghi kết quả vào mục này hoặc vào evidence của T10.
