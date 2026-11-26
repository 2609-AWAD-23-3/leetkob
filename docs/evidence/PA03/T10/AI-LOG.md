# AI log — PA03-T10

## 2026-11-23 — Plan, quyết định thiết kế và bản local (chưa dev run thật)

Tool: Claude Code (desktop app), chạy như một session phụ do session chính của Vượng mở.
Asked for: Vượng giao T10: đọc plan/rubric/AGENTS/T08, tạo nhánh từ `origin/develop`, kiểm tra môi trường, gửi plan để duyệt, rồi làm theo thứ tự test trước; không commit/push/mở PR/sửa Issue khi chưa được cho phép.
Kept: Plan 6 phase. Vượng chốt A2 (thêm `UnsureCause` `model_off`, kèm migration mới), B3 (sửa T08 để identity có kiểu, thay vì chuỗi sentinel B1 Claude đề xuất ban đầu hay cờ boolean), C1 (thiếu key exit 2; lỗi provider một bài thành `unsure` và chạy tiếp), D1 (positional dataset + `--out`). Dev set copy bằng git blob để giữ byte; dùng chính sandbox của sản phẩm để kiểm eval-cases Accepted.
Changed: Checkout chính đang ở nhánh T09 và dùng chung với session khác, nên Claude tạo worktree riêng cho nhánh T10 thay vì chuyển nhánh, và bỏ upstream `origin/develop` của nhánh mới để tránh push nhầm. Phát hiện `core.autocrlf=true` làm sai SHA dev set khi checkout/`git archive`; đổi sang xuất từng blob và thêm `leetkob-eval/** -text`. Test OpenAPI đầu tiên đặt sai file (đỏ vì setup, không vì thiếu enum); chuyển sang `review-queue.test.mjs` và chạy đỏ lại trên bản gỡ tạm `model_off`. Test model giả có regex sai (`+` chưa escape), sửa test. Hai danh sách migration mong đợi trong test Postgres thêm `0006` vì contract DB đổi có chủ đích.
Rejected: Chuỗi sentinel cho `getIdentity` (B1: nói sai rằng có danh tính, mẫu dễ bị chép sang worker); cờ `allowEmptyIdentity` (dễ bật nhầm); sửa migration `0001`; dừng cả lần chạy khi gặp lỗi provider đầu tiên (C2); dùng `labels.jsonl` hay `tests/` trong checker.
By hand: Vượng duyệt plan và chốt bốn quyết định. Claude viết test, code, case, Dockerfile, tài liệu và chạy lệnh: lint, format-check, type-check, `git diff --check` exit 0; `npm test` 551 test, 548 pass, 3 skipped; `npm run test:db` 101/101; image chạy `--network none -e MODEL_OFF=1` trên dev set ghi file hợp lệ, `eval.mjs` exit 1 (0 wrongful). Dev run model thật chưa chạy vì chưa có `MODEL_API_KEY`.

## 2026-11-23 — Sửa theo review của Vượng: image không ghi được output trên Linux

Tool: Claude Code (desktop app).
Asked for: Vượng review bản local, chỉ ra P1: thư mục `/out` thuộc root (Docker tự tạo trên Linux theo đúng lệnh README) khiến checker chạy bằng user `node` báo `EACCES`, không có file prediction; và một điểm nhỏ về `unsureCause: null` khi lỗi provider.
Kept: Lỗi P1 đúng; Claude không thấy trước đó vì Docker Desktop trên Windows không kiểm quyền thư mục mount.
Changed: Viết `scripts/test-checker-image.mjs` (`npm run test:checker-image`) tái hiện bằng Docker volume mới thuộc `root:root 755`, chạy đỏ trước (log `red/07-checker-image-root-out.log`), rồi bỏ `USER node` để checker chạy bằng root trong container; chạy lại xanh (`logs/checker-image.log`). README ghi lý do.
Rejected: Hướng dẫn người chấm tự `mkdir out` hay thêm `--user` (người chấm chạy lệnh của họ, không bảo đảm làm theo); đổi quyền thư mục của host từ trong container.
By hand: Vượng tìm ra lỗi và tái hiện. Claude viết script, sửa Dockerfile và tài liệu, chạy lệnh: lint, format-check, type-check, `git diff --check` exit 0. Điểm nhỏ về `unsureCause` chờ Vượng chọn phương án.

## 2026-11-23 — Hướng A cho `unsureCause` khi provider lỗi

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi rõ hai phương án cho điểm nhỏ trong review (call log ghi `unsureCause: null` kèm `cause: provider_error`) rồi chốt hướng A.
Kept: Hướng A: call log của checker ghi `unsureCause: "provider_error"`, bỏ trường `cause`; kiểu `CheckerUnsureCause = UnsureCause | 'provider_error'` chỉ trong `src/cli/run.ts`.
Changed: Kỳ vọng trong test lỗi provider đổi từ `decision.cause` sang `decision.unsureCause` theo quyết định này, thêm kiểm mọi dòng `unsure` trong call log có cause khác `null`; chạy đỏ trước (log `red/08-provider-error-cause.log`) rồi mới sửa code.
Rejected: Hướng B (thêm `provider_error` vào `UnsureCause` chung và migration `0006`): worker không bao giờ ghi giá trị này, review queue sẽ liệt kê một cause không xuất hiện.
By hand: Vượng chọn hướng A. Claude sửa test, code, tài liệu và chạy lệnh (kết quả ở `logs/quality-checks.txt`).

## 2026-11-23 — Ghi prediction ra stdout để image chạy ổn trên máy người chấm

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi cách sửa chạy-bằng-root có vấn đề gì không, rồi hỏi hướng nào ổn định và không mất điểm tiêu chí 6, và yêu cầu sửa theo hướng đó.
Kept: Claude thử thêm trên Docker và chỉ ra cách root vẫn hỏng khi người chấm tự tạo `out/` (thuộc user của họ) và chạy `--cap-drop ALL`, kèm file output thuộc root và rủi ro bảo mật. Vượng chốt hướng kết hợp: mặc định ghi prediction ra stdout (lệnh chính trong README dùng redirect, container không ghi file), image vẫn chạy bằng root cho người tự mount `/out`.
Changed: Thiếu `--out` (hoặc `--out -`) giờ ghi ra stdout; log vẫn ra stderr; prediction chỉ ghi sau khi chấm xong. Test CLI bỏ trường hợp "thiếu `--out` → exit 2" vì contract đổi theo quyết định này. `scripts/test-checker-image.mjs` chạy 4 cấu hình (stdout với `--cap-drop ALL --read-only --user 12345:12345`; `--out -`; mount thuộc root; mount thuộc user khác), đỏ trước (`red/09`, `red/10`) rồi xanh. Khi thử lệnh trên máy dev, Claude phát hiện redirect `>` của PowerShell ghi file kèm BOM làm `eval.mjs` exit 2; README tách lệnh Linux (stdout) và PowerShell (mount `--out`).
Rejected: Chỉ giữ root mà không có stdout (hỏng với `--cap-drop ALL` và thư mục của user khác); quay lại user `node` (hỏng khi Docker tự tạo `out/` thuộc root); khi ghi file lỗi thì in prediction ra stdout thay thế (người chấm không đọc stdout trong kiểu chạy đó, làm output khó đoán).
By hand: Vượng ra quyết định. Claude viết test, sửa code, Dockerfile, README, evidence và chạy lệnh: lint, format-check, type-check, `git diff --check` exit 0; `npm test` có `TEST_DATABASE_URL` 651/651; `npm run test:checker-image` exit 0.

## 2026-11-23 — Dev run model thật

Tool: Claude Code (desktop app).
Asked for: Vượng thêm `MODEL_API_KEY` và `MODEL_TIMEOUT_MS` vào `.env` và yêu cầu chạy thử.
Kept: Claude chỉ kiểm tên biến và hình dạng key (độ dài, tiền tố), không in giá trị; chạy thử trước trên `eval-cases` (6 call, `eval.mjs` exit 0) rồi mới chạy dev set (39 call, `claude-haiku-5-5`, $0.009157). Kết quả dev set báo cáo nguyên trạng: recall 100%, unsure 0%, 1 khấu trừ sai ở một constraint semantic.
Changed: Không chỉnh prompt hay rule theo cặp khấu trừ sai (AGENTS.md cấm tinh chỉnh theo dev set; PA03 không có ngưỡng eval). Kiểm call log bằng script: 39 request id `req_…` khác nhau, không prompt nào còn comment, không call nào cho constraint hard rule đã quyết, không file nào chứa key; chấm lại ra đúng số liệu.
Rejected: Chạy lại nhiều lần để chọn lần đẹp nhất (rubric chấm lại file đã commit, phải báo cáo đúng lần chạy).
By hand: Vượng cấp key qua `.env`. Claude chạy lệnh, kiểm call log, ghi evidence, cập nhật plan.

## 2026-11-23 — Sửa theo review của Vỹ trên PR #81

Tool: Claude Code (desktop app).
Asked for: Vượng yêu cầu đọc review của Vỹ (request changes, chỉ về tài liệu), rồi sửa và cập nhật hết: tài liệu, mô tả PR và Issue #39.
Kept: Ba điểm của Vỹ đều đúng khi đối chiếu file: trạng thái "bản local chưa commit" trong evidence và plan; bảng file của evidence còn ghi image dùng user `node` (sót khi bỏ `USER node`); Issue #39 chưa tick các ô thực hiện như plan.
Changed: Evidence và plan ghi trạng thái theo PR #81 và CI xanh; bảng file ghi image chạy bằng root theo quyết định E. Các dòng nói "image cũ chạy bằng user `node`" và log lịch sử giữ nguyên. Issue #39 tick sáu ô thực hiện, để trống ba ô review của Phúc; mô tả PR ghi CI đã xanh.
Rejected: Sửa log `logs/quality-checks.txt` (ghi lại đúng thời điểm chạy, không viết lại lịch sử).
By hand: Vỹ review và chỉ ra các điểm; Vượng yêu cầu sửa và cập nhật. Claude sửa tài liệu, commit, push, cập nhật Issue và mô tả PR.
