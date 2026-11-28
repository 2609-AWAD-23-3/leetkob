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
