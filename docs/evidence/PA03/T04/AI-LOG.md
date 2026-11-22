# Đầu vào AI-log — PA03-T04

Sáu mục ngắn để T13 tổng hợp vào AI-LOG của milestone; không thay review độc lập. Nguồn và số liệu chi tiết: [README T04](README.md). Mã nguồn giai đoạn 1: `9812a52`; giai đoạn 2–3 hiện là thay đổi chưa commit tiếp nối SHA này.

## 1. 21–22/11/2026 — Contract xác thực

**Công cụ (Tool):** Codex.
**Yêu cầu (Asked for):** chốt và triển khai đăng ký, login, session và logout cho T04.
**Phần giữ lại (Kept):** Store chung T03, session phía server, PostgreSQL runtime và fake cho test.
**Phần điều chỉnh (Changed):** đăng ký chỉ tạo student; identity/quyền đọc từ Store, token chỉ lưu hash; giữ resolver Publish cũ để T09 tích hợp.
**Phần không chọn (Rejected):** JWT/refresh token, admin cấp TA và logout all trong giai đoạn này.
**Phần làm tay (By hand):** Vượng chốt luồng và phạm vi; code/test do assistant thực hiện.

## 2. 21–22/11/2026 — Seed, môi trường chạy và công cụ xem API/database

**Công cụ (Tool):** Codex, npm, PostgreSQL/Docker, Swagger, Prisma Studio.
**Yêu cầu (Asked for):** tạo tài khoản mẫu, chạy backend bằng .env và có giao diện kiểm tra thuận tiện.
**Phần giữ lại (Kept):** migration riêng, pg làm Store; seed 3 admin, 10 TA, 100 student, mỗi lớp 80 student.
**Phần điều chỉnh (Changed):** theo yêu cầu Vượng, đổi seed private/password ngẫu nhiên sang password dev công khai `password123`; thêm .env, ví dụ Swagger và link docs trong startup log.
**Phần không chọn (Rejected):** đưa Prisma ORM/Client vào backend; Studio chỉ là công cụ dev, không quản lý migration.
**Phần làm tay (By hand):** Vượng chọn số lượng tài khoản, chính sách password dev và yêu cầu Studio; assistant triển khai/cấu hình.

## 3. 21–22/11/2026 — Sửa sau review giai đoạn 1

**Công cụ (Tool):** Codex, kiểm thử Node và PostgreSQL.
**Yêu cầu (Asked for):** kiểm tra lại auth và sửa ba lỗi đã thống nhất.
**Phần giữ lại (Kept):** contract auth và chính sách reset password của seed dev.
**Phần điều chỉnh (Changed):** xử lý lỗi pool idle để tiến trình sống/kết nối lại; từ chối password Unicode lỗi và displayName chứa NUL; thêm test hồi quy fake/PG.
**Phần không chọn (Rejected):** mở rộng sang API reset password hoặc coi race login đồng thời seed là đã được sửa; giới hạn này được ghi rõ.
**Phần làm tay (By hand):** Vượng chấp nhận hoãn race seed/login cho phạm vi dev và yêu cầu sửa ba điểm còn lại; assistant sửa và chạy test.

## 4. 22/11/2026 — API tạo và xem lab

**Công cụ (Tool):** Codex, Fastify multipart, PostgreSQL, Swagger.
**Yêu cầu (Asked for):** TA tạo lab bằng JSON/file, xem theo quyền và chống double-click tạo trùng.
**Phần giữ lại (Kept):** domain T03, role/membership, phase theo thời gian; transaction và key có TTL 24 giờ.
**Phần điều chỉnh (Changed):** đếm tổng byte trên stream gốc và kiểm tra UTF-8; bỏ encoding khiến Swagger gửi trường lab thành Blob/file; thêm migration 0004 và test rollback/replay.
**Phần không chọn (Rejected):** chỉ dựa vào bodyLimit để giới hạn multipart; thêm sửa/xóa/ẩn/tạm dừng lab trong phase 2.
**Phần làm tay (By hand):** Vượng chốt input, quyền, thời gian và idempotency; assistant viết code, mẫu và kiểm thử.

## 5. 22/11/2026 — API tiếp nhận và xem bài nộp

**Công cụ (Tool):** Codex, Node, PostgreSQL.
**Yêu cầu (Asked for):** student nộp/xem bài, TA xem bài trong lớp; chưa thực thi chấm.
**Phần giữ lại (Kept):** lưu code dạng TEXT, giữ lịch sử và lấy bài cuối trong hạn theo FAQ; ghi submission/job/key nguyên tử.
**Phần điều chỉnh (Changed):** từ ba thành bốn API khi Vượng yêu cầu danh sách cho TA; thêm phân trang, bộ đọc JSON/.cpp riêng và migration 0005; chụp thời gian nhận trước chờ database.
**Phần không chọn (Rejected):** ZIP/nhiều file, sửa/xóa và triển khai worker T06 trong phase này; một file .cpp là phạm vi nhóm chọn, không phải khẳng định FAQ bắt buộc.
**Phần làm tay (By hand):** Vượng chốt tiếp nhận bài, một file/64 KiB và hoãn ZIP; assistant triển khai và kiểm thử.

## 6. 22/11/2026 — Kiểm chứng, tài liệu và kiểm tra trước PR

**Công cụ (Tool):** Codex, npm/Git, PostgreSQL, Edge headless và Playwright tạm trong .local.
**Yêu cầu (Asked for):** kiểm tra Swagger, gộp evidence tiếng Việt và kiểm tra khả năng merge develop trước commit/PR.
**Phần giữ lại (Kept):** 207 test mặc định đạt, 1 suite database bỏ qua; PostgreSQL 86/86; lint/format/type-check/diff-check đạt, chi tiết trong README.
**Phần điều chỉnh (Changed):** sửa cách chờ Try it out của probe UI rồi chạy lại đạt 13 bước; gộp evidence vào README. Bản ghép tạm với develop `c660d7e` không conflict, đạt 358 test; giữ nguyên working tree/staging thật.
**Phần không chọn (Rejected):** gọi bài queued hoặc kết quả fixture là chấm thật; coi checks đạt là T04 đã hoàn tất hoặc tự tick review của Vỹ.
**Phần làm tay (By hand):** Vượng yêu cầu cách trình bày và quyết định thời điểm commit/PR; kiểm thử tự động/log do assistant thực hiện. Chưa commit/push, chưa có review độc lập hoặc kiểm chứng chấm thật T05/T06.
