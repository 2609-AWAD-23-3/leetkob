# Đầu vào AI-log — T03

Bản ghi task này dành cho T11 tổng hợp vào `AI-LOG.md` ở root. Bản ghi không thay báo cáo milestone hoặc review độc lập.

## 09/11/2026 — Ranh giới xác thực, phân quyền publish và lỗi RFC 9457 của T03

**Công cụ (Tool):** Antigravity assistant (Gemini).

**Yêu cầu (Asked for):** kiểm tra trạng thái mới nhất của nhánh `develop` sau khi T01 và T02 đã merge, triển khai task T03 (`src/auth/`, `tests/auth/`, tài liệu và bằng chứng kiểm chứng) bám sát lookup interface `PublishStore` của T02 mà không tự ý push hoặc mở/merge PR khi chưa có xác nhận.

**Phần giữ lại (Kept):** bộ resolver xác thực bearer token (`createTokenIdentityResolver`), helper inject danh tính chỉ dùng trong test mặc định tắt (`createTestHeaderIdentityResolver`), hàm kiểm tra quyền publish (`authorizePublishAccess`) kết nối trực tiếp với `getLab`/`isTaAssignedToClass` của T02, bộ khởi tạo và ánh xạ lỗi RFC 9457 (`application/problem+json; charset=utf-8`), parser/error handler cho Fastify scope (`registerPublishErrorHandling`) và 18 bài kiểm thử trong `tests/auth/publish-auth-errors.test.mjs`.

**Phần điều chỉnh (Changed):** cập nhật mô hình lỗi và ánh xạ trạng thái để khớp chính xác với kết quả `PublishResult` thực tế của T02 (`lab_not_found`, `before_deadline` kèm `deadline`, `pending_reviews` kèm `pendingCount`) thay vì chỉ dựa vào bản đề xuất sơ bộ trước khi T02 merge. Kiểm tra `role === 'TA'` trước khi tra cứu `getLab(labId)` để ngăn vai trò `student`/`admin` dò sự tồn tại của lab qua endpoint publish.

**Phần không chọn (Rejected):** không đọc `userId` hoặc `role` từ request body/query; không bật sẵn header test (`x-test-user-id`, `x-test-role`) trong cấu hình mặc định; không xây dựng hệ thống đăng nhập/OAuth hoặc lỗi cho hai endpoints đã hoãn (`submissions`, `review-queue`); không tự ý sửa `src/app.ts`, `package.json` hay `src/data/*`.

**Phần làm tay (By hand):** người thực hiện kiểm soát quy trình, yêu cầu ranh giới task, xác nhận không tự ý push/merge PR và trực tiếp rà soát kết quả trước khi bàn giao. Assistant viết source code, tests và tài liệu; chưa có xác nhận review độc lập từ Vượng (`@vinny2707`).

Kết quả kiểm chứng và giới hạn môi trường được ghi tại [README.md](README.md) và [verification.json](verification.json).
