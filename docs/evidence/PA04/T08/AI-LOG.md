# AI log — PA04-T08

## 2026-11-28 — Kế hoạch T08 và bước 1: `marking.env` không vào Git và image

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi mục tiêu của T08, cách để người chấm chạy được mà key không lên GitHub, và vì sao `eval.mjs` của thầy không phụ thuộc cấu hình của nhóm; chốt năm quyết định (proxy bằng `ENV` trong image, proxy thử tự viết, `--env-file`, nội dung `marking.env`, chỉ ghi `reason` vào call log) rồi bảo làm từng bước, dừng cho review trước khi commit.
Kept: `marking.env` chỉ chứa `MODEL_API_KEY` và `MODEL_TIMEOUT_MS`, tạo bằng key riêng trong workspace của nhóm, Vỹ nộp. Test cho ignore chỉ đọc file, không gọi `git` hay Docker, để chạy được khi không có network.
Changed: Claude kiểm thấy `.gitignore` và `.dockerignore` không có mục nào khớp `marking.env` (chỉ `.env`, `.env.*`), nên nếu đặt file trong repo thì key có thể lên Git hoặc vào build context. Viết test trước (đỏ 2/2), rồi thêm `marking.env` vào `.gitignore`, `marking.env` và `**/marking.env` vào `.dockerignore`; `git check-ignore` xác nhận khớp ở gốc và thư mục con, `.env.example` vẫn được theo dõi.
Rejected: Dùng chung key `.env` cho `marking.env` (rubric yêu cầu key cho riêng lần chạy này, thu hồi sẽ làm dừng deployment và CI); tải image proxy bên ngoài để thử; test gọi `git check-ignore` (cần git trong môi trường chạy test).
By hand: Vượng chốt các quyết định, tạo key, sẽ review trước khi commit. Claude viết test, sửa hai file ignore, viết evidence và chạy kiểm tra.

## 2026-11-28 — Bước 2: checker đi qua proxy tới model host

Tool: Claude Code (desktop app).
Asked for: Vượng bảo commit bước 1 rồi làm bước 2 theo quyết định đã chốt: bật proxy bằng `ENV` trong image, thử bằng proxy tự viết, không tải image proxy bên ngoài; dừng cho review trước khi commit.
Kept: Kiểm trước rằng SDK dùng `fetch` toàn cục của Node (`internal/shims.js`), nên `NODE_USE_ENV_PROXY=1` có tác dụng mà không sửa code client. Proxy và checker chạy bằng base image của checker. Script thử không truyền `NODE_USE_ENV_PROXY` cho checker, để kiểm đúng image; có kiểm môi trường thử (mạng internal không ra thẳng được, proxy từ chối host khác) trước khi tin kết quả.
Changed: Chạy script trước khi sửa Dockerfile: 22 call `provider_error`, `eval.mjs` cho recall 26.7% như model tắt, dù checker exit 0; lưu ở `step2-red/`. Thêm `ENV NODE_USE_ENV_PROXY=1` thì `PASS`. Sửa hai chỗ trong script sau lần chạy xanh đầu (thông điệp lỗi rõ hơn; lint đổi kiểm `^req_` sang `startsWith`) rồi chạy lại để evidence khớp script được commit. Ghi lại một lần `npm test` lỗi timeout ở test logger không liên quan (chạy lại đạt).
Rejected: Tải image squid hay tinyproxy (tải phần mềm ngoài không cần thiết); truyền `NODE_USE_ENV_PROXY` từ lệnh `docker run` (người chấm không biết phải truyền); sửa client model để tự dùng proxy (không cần, vì SDK dùng `fetch` của Node).
By hand: Vượng chốt cách làm và sẽ review trước khi commit. Claude viết script, sửa Dockerfile, chạy các lần thử (model thật qua proxy, tổng khoảng $0.016), `npm run test:checker-image` và quality checks.

## 2026-11-28 — Bước 2 sau review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review bước 2 (chưa commit): nén nguyên thư mục repo sẽ đưa `.env` và `marking.env` vào zip nộp bài; comment trong Dockerfile còn ghi `--network none` và chỉ có ví dụ model tắt; README chưa có model host, lệnh chạy qua proxy và cách chạy khi tắt model.
Kept: Việc tạo zip thuộc T10 (Vỹ); T08 chỉ ghi cách làm an toàn và cách kiểm vào README. Thời gian chạy và concurrency vẫn để bước 4.
Changed: Thử nén từ một bản clone sạch trước khi ghi lệnh vào README. Lần đầu dùng `tar` trong Git Bash: file ra là tar (GNU tar 1.35), không phải zip, dù đặt đuôi `.zip`; Claude kiểm header file mới thấy. Dùng `tar.exe` của Windows trong PowerShell thì ra zip thật, có `.git`, không có `.env` hay `marking.env`; README chỉ ghi cách này. Sửa hai đoạn comment trong Dockerfile; thêm mục "Lần chạy held-out (PA04)" vào README. Sau review lần hai: README ghi chạy lệnh nén ở thư mục ngoài repo (tránh thư mục lồng `leetkob/leetkob`) và tag `pa4` do T10 tạo.
Rejected: Viết sẵn script đóng gói bài nộp trong T08 (thuộc T10, Vỹ quyết cách làm); dùng `Compress-Archive` (chưa kiểm cách nó xử lý thư mục ẩn như `.git`).
By hand: Vượng tìm ra ba điểm khi review. Claude thử nén zip, sửa Dockerfile, README và evidence.

## 2026-11-28 — Bước 3: `reason` trong call log của checker

Tool: Claude Code (desktop app).
Asked for: Vượng bảo commit bước 2 rồi làm bước 3 theo quyết định 5 (chỉ ghi `reason` của verdict `unsure` vào call log, không ghi nguyên output model); dừng cho review trước khi commit.
Kept: `reason` là field tuỳ chọn, chỉ có ở decision `unsure` của đường model (kể cả `provider_error`, ghi thông điệp lỗi); không đổi file prediction hay field hiện có, nên test cũ không phải sửa.
Changed: Viết bốn test trước; ba test đỏ, test còn lại canh hành vi hiện có (model tắt, hard rule không có `reason`). Bản đầu của một test đòi lý do `evidence_mismatch` chứa số dòng, tức thông điệp của G2 chưa có trên nhánh này; sửa assert thành kiểm lý do có chữ `evidence` và lý do của model, rồi kiểm lại hai chiều (bỏ code thì 3 đỏ, có code thì xanh). README ghi field mới.
Rejected: Ghi `reason` cho mọi decision (call log phình, không cần cho chẩn đoán); ghi nguyên text output của model (dài, lặp lại code sinh viên vốn đã có trong prompt).
By hand: Vượng chốt quyết định 5 và sẽ review trước khi commit. Claude viết test, sửa `src/cli/run.ts`, README, evidence và chạy kiểm tra.

## 2026-11-28 — Bước 3 sau review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review bước 3 (chưa commit): lỗi kết nối chỉ ghi "Connection error." nên lần chạy held-out lỗi môi trường khó chẩn đoán, nên ghi thêm `error.cause`; chưa có test cho `timeout`.
Kept: Che key bằng cùng hàm `redact` của client cho cả phần nguyên nhân gốc.
Changed: Claude tìm ra nguyên nhân gốc bị mất ở client (`src/pipeline/model/client.ts` chỉ chép `error.message`), không phải ở checker; sửa ở client để cả worker cũng có. Viết test client trước (đỏ), thêm test `timeout` (xanh ngay, chỉ bổ sung độ phủ), rồi kiểm trên đường mạng thật bằng proxy thử từ chối model host: `reason` nêu đúng "Proxy response (403)", không có key. Lúc dọn proxy thử, lệnh `pkill` không tắt được process trên Windows và nhánh dự phòng `taskkill` lọc theo tên `node.exe` có thể đụng process Node khác; Claude kiểm danh sách process (không process nào khác bị tắt) rồi chỉ tắt đúng PID của proxy thử.
Rejected: Ghép `cause` trong checker (`src/cli/run.ts`) thay vì client (`ModelProviderError` không giữ `cause`, và worker cũng cần); ghi nguyên object lỗi (có thể chứa header của request).
By hand: Vượng tìm ra hai điểm khi review. Claude viết test, sửa client, chạy kiểm trên proxy thử, cập nhật README, evidence.

## 2026-11-28 — Bước 4: thời gian chạy và concurrency

Tool: Claude Code (desktop app).
Asked for: Vượng bảo commit bước 3 rồi làm bước 4: đo thời gian chạy và chốt concurrency, ghi vào README; dừng cho review trước khi commit.
Kept: Đo qua proxy thử, cùng điều kiện như người chấm, trên dev set. Không đổi giá trị mặc định khi số đo không cần.
Changed: Thêm `--concurrency` cho script thử (chỉ truyền tiếp cho checker; không truyền thì dùng mặc định như lệnh trong README). Đo mức 4 (20 s) và 8 (11 s); độ trễ mỗi call không đổi, không call nào lỗi. Ước lượng 30 phút đủ cho khoảng 3 500 call bình thường, khoảng 240 call nếu mọi call chạm hạn 30 s. Đề xuất giữ mặc định 4. Lần chạy mức 4 có một `model_unsure` và call log ghi đúng `reason` của model, xác nhận thay đổi ở bước 3 trên lần chạy thật.
Rejected: Tăng mặc định lên 8 (không cần về thời gian, tăng rủi ro giới hạn tốc độ nếu held-out lớn); bắt người chấm truyền `--concurrency` (họ chạy đúng lệnh trong README).
By hand: Vượng chốt giữ concurrency 4 khi review. Claude sửa script thử, chạy hai lần đo (model thật qua proxy, tổng khoảng $0.018), viết README và evidence.

## 2026-11-28 — Bước 4 sau review của Vượng: thời gian build image

Tool: Claude Code (desktop app).
Asked for: Vượng chỉ ra bước 4 mới đo phần chạy checker; plan ghi người chấm build image rồi chạy, và lần build trong script thử có thể dùng cache Docker, không phản ánh máy người chấm phải `npm ci` từ đầu. Cần đo `docker build --no-cache` rồi ghi vào evidence và câu "Thời gian" của README.
Kept: Ghi rõ phần chưa đo được: base image đã có sẵn trên máy, nên thời gian tải base image không nằm trong 48 s.
Changed: Đo một lần `docker build --no-cache`: 48 s (`npm ci` 16 s, build và prune 24 s), image 406 MB; lưu log đã thay đường dẫn local. README và evidence bước 4 ghi số này và tổng thời gian build cộng chạy.
Rejected: Xoá base image để đo cả lần tải (phụ thuộc mạng của máy dev, không đại diện cho máy người chấm, và làm mất cache dùng chung).
By hand: Vượng tìm ra điểm thiếu khi review. Claude chạy build không cache và cập nhật README, evidence.

## 2026-11-28 — Bước 5: chẩn đoán `evidence_mismatch`

Tool: Claude Code (desktop app).
Asked for: Vượng bảo làm bước 5 sau khi PR #92 (T02) merge: đo tần suất và nguyên nhân G2 hạ verdict thành `evidence_mismatch`, dùng `reason` mới trong call log.
Kept: Merge `develop` vào nhánh T08 bằng merge commit (không rebase) để giữ SHA các commit T08 mà evidence dẫn tới; kiểm trước là hai bên không sửa chung file. Không sửa G2 khi chưa có quyết định.
Changed: Chạy checker 3 lần trên `eval-cases` và dev set: 1 `evidence_mismatch` trên 453 lượt quyết, `reason` chỉ ra dòng 9 của `digit-sum/s06` (dòng có ký tự xuống dòng viết dạng escape trong code C++). Vì `reason` không chứa text model trích, Claude viết một script chẩn đoán ngoài code sản phẩm, gọi model 10 lần với đúng prompt đó và in nguyên văn: 4/10 lần model chép hai ký tự "dấu gạch chéo ngược" và "n" của code thành escape JSON của ký tự xuống dòng, nên text sau khi parse có một ký tự xuống dòng thật. Lưu evidence không kèm prompt để gọn. Đề xuất ba hướng, khuyến nghị cho G2 chấp nhận đúng biến đổi "dòng code bị đọc như chuỗi JSON". Khi ghi mục này, lệnh Python của Claude làm lọt ký tự xuống dòng thật vào AI-LOG; đã viết lại cả mục từ file soạn sẵn.
Rejected: Sửa G2 hay prompt ngay trong bước 5 (thay đổi guardrail, cần Vượng quyết và commit riêng); kết luận từ một lần lệch mà không xác nhận cơ chế. Sau đó Vượng chọn hướng 1 và phần sửa G2 đi ở PR #93 (nhánh riêng từ `develop`); trong lúc làm, phần evidence bước 5 này được cất tạm bằng `git stash` rồi lấy lại.
By hand: Vượng quyết định làm bước 5. Claude merge, chạy kiểm tra, ba lần chạy model thật ($0.048858), script chẩn đoán ($0.002351), phân tích và viết evidence.

## 2026-11-28 — Bước 5 sau review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review evidence bước 5 (chưa commit): mô tả hướng 1 ghi chỉ giải escape "khi dòng code là thân chuỗi JSON hợp lệ", khác code của PR #93 (giải từng escape hợp lệ, giữ nguyên dấu gạch chéo ngược khác) và khác README T02 mục 10; comment đầu `diag-line9.mjs` ghi "không thuộc repo" dù file đã nằm trong `docs/evidence/`.
Kept: Không đổi kết quả hay số liệu nào.
Changed: Sửa mô tả hướng 1 cho khớp `decodeJsonEscapes` và README T02 mục 10; đổi comment thành "không thuộc code sản phẩm". Mô tả cũ viết trước khi làm PR #93 và không được cập nhật sau khi cách làm đổi.
Rejected: Không có.
By hand: Vượng tìm ra hai điểm khi review. Claude sửa README và comment.

## 2026-11-28 — Bước 6 (thử sớm) với `marking.env`

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi T08 có phải chờ T06 không; Claude giải thích chỉ lần chạy thử cuối phụ thuộc T06 và đề xuất thử `marking.env` ngay để phát hiện sớm lỗi key. Vượng bảo chạy thử rồi ghi evidence.
Kept: Không in giá trị key; chỉ kiểm có biến, key khác key dev, và không file kết quả nào chứa key.
Changed: Phát hiện `marking.env` dùng CRLF và thiếu ký tự xuống dòng cuối; kiểm `readModelConfig` thấy cả hai biến được `trim()`, rồi lần chạy thật xác nhận key và timeout đọc đúng. Ghi khuyến nghị lưu file bằng LF trước khi đính kèm. Chạy `npm run test:held-out-proxy -- --env-file marking.env` tại `45f659c`: mọi kiểm đều `PASS`, `eval.mjs` `PASS`, 22 call qua proxy có request id, $0.006278.
Rejected: Sửa `marking.env` thay Vượng (file chứa key của Vượng, chỉ ghi khuyến nghị); coi đây là lần chạy thử cuối (code còn đổi ở T06).
By hand: Vượng tạo key và file `marking.env`, quyết định chạy thử. Claude kiểm file, chạy script thử, kiểm kết quả không chứa key, viết evidence.
