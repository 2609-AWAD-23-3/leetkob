# AI log — PA04-T08

## 2026-11-28 — Kế hoạch T08 và bước 1: `marking.env` không vào Git và image

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi mục tiêu của T08, cách để người chấm chạy được mà key không lên GitHub, và vì sao `eval.mjs` của thầy không phụ thuộc cấu hình của nhóm; chốt năm quyết định (proxy bằng `ENV` trong image, proxy thử tự viết, `--env-file`, nội dung `marking.env`, chỉ ghi `reason` vào call log) rồi bảo làm từng bước, dừng cho review trước khi commit.
Kept: `marking.env` chỉ chứa `MODEL_API_KEY` và `MODEL_TIMEOUT_MS`, tạo bằng key riêng trong workspace của nhóm, Vỹ nộp. Test cho ignore chỉ đọc file, không gọi `git` hay Docker, để chạy được khi không có network.
Changed: Claude kiểm thấy `.gitignore` và `.dockerignore` không có mục nào khớp `marking.env` (chỉ `.env`, `.env.*`), nên nếu đặt file trong repo thì key có thể lên Git hoặc vào build context. Viết test trước (đỏ 2/2), rồi thêm `marking.env` vào `.gitignore`, `marking.env` và `**/marking.env` vào `.dockerignore`; `git check-ignore` xác nhận khớp ở gốc và thư mục con, `.env.example` vẫn được theo dõi.
Rejected: Dùng chung key `.env` cho `marking.env` (rubric yêu cầu key cho riêng lần chạy này, thu hồi sẽ làm dừng deployment và CI); tải image proxy bên ngoài để thử; test gọi `git check-ignore` (cần git trong môi trường chạy test).
By hand: Vượng chốt các quyết định, tạo key, sẽ review trước khi commit. Claude viết test, sửa hai file ignore, viết evidence và chạy kiểm tra.
