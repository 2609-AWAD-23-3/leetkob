# Đầu vào AI-log — T02

Bản ghi task này dành cho T11 tổng hợp vào AI-LOG.md ở root. Bản ghi không thay báo cáo milestone hoặc review độc lập.

## 09/11/2026 — Model, store, fixtures và kiểm chứng T02

**Công cụ (Tool):** Codex assistant.

**Yêu cầu (Asked for):** bảo toàn nhánh/kế hoạch T02 khi chuyển công việc về repo ổ D:, đề xuất nền dữ liệu publish cụ thể theo brief/FAQ, rồi triển khai kế hoạch đã chấp thuận.

**Phần giữ lại (Kept):** model TypeScript do assistant đề xuất, in-memory store đồng bộ, isolation theo instance, seed/reset trực tiếp, summary theo quyết định TA, data tests, tài liệu và evidence.

**Phần điều chỉnh (Changed):** người yêu cầu làm rõ draft của Phúc không ràng buộc T02; đầu ra T02 là thiết kế để T03/T08 sử dụng. Người yêu cầu chọn summary thống kê review thay vì snapshot điểm và chấp thuận giới hạn storage. Assistant phát triển kế hoạch ban đầu thành đặc tả triển khai; dùng npm.cmd vì PowerShell chặn npm.ps1. Sau đó người yêu cầu yêu cầu tài liệu T02 bằng tiếng Việt để dễ kiểm tra; assistant chuyển tài liệu thiết kế, evidence và AI-log sang tiếng Việt, giữ tên API/lệnh và dữ liệu kiểm chứng lịch sử.

**Phần không chọn (Rejected):** coi verdict mô hình là quyết định TA; thiết kế T02 theo draft của Phúc; thêm pipeline tính điểm hoặc endpoints đã hoãn; coi smoke/data tests là hoàn thành toàn bộ quality gate PA02. Các phần ngoài scope này chưa được triển khai rồi xóa đi.

**Phần làm tay (By hand):** người yêu cầu cung cấp phạm vi, ownership, hướng thiết kế và cho phép triển khai. Assistant viết implementation/tests/docs; Vỹ đã review PR của Task T02.

Kết quả kiểm chứng và giới hạn môi trường nằm trong [hồ sơ evidence](README.md). Không đưa dữ liệu người dùng thật, lời gọi provider, model key hoặc transcript assistant vào hồ sơ này.
