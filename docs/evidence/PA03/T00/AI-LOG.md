# AI log — PA03-T00

## 2026-11-17 — Sắp xếp cấu trúc LeeTKOB

Tool: Codex.
Asked for: Chạy prompt `codex-prompt-pa03-t00.md` cho T00: đối chiếu plan/rubric, chuyển code và test giữ nguyên hành vi, kiểm tra và chuẩn bị PR vào `develop`.
Kept: Layout một package từ prompt và ba điểm vào API, worker, checker. Codex tạo bản đồ T01–T13/F1–F11, thực hiện các bước `git mv` và chạy kiểm tra; [kết quả](README.md) ghi số test và SHA.
Changed: Giữ RFC 9457 trong cụm auth của API vì code đang gắn với Fastify và Publish; phân loại các bài smoke/lifecycle theo boundary Fastify vào integration, giữ helper riêng. Dùng Node 24.22.1/npm 11.19.1 ở thư mục tạm vì Node mặc định thấp hơn yêu cầu.
Rejected: Không tạo thư mục trống cho các chỗ dự kiến. Giữ nguyên các glob của tsconfig, Oxlint và Prettier vì chúng đã bao phủ cây mới; không siết glob theo các suite đang có. Không chép các thay đổi đang chờ review từ PR #30 vào nhánh T00.
By hand: Vỹ cung cấp prompt và ràng buộc. Các thay đổi, lệnh kiểm tra và bản ghi này trong phiên do Codex thực hiện; chưa có kiểm tra độc lập của reviewer trong phiên local.
