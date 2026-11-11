# Đầu vào AI-log — T09

Bản ghi task này dành cho T11 tổng hợp vào `AI-LOG.md` ở root. Bản ghi không thay báo cáo milestone hoặc review độc lập.

## 11/11/2026 — Thiết lập Shared CI Workflow và Chính sách Merge Protection

**Công cụ (Tool):** Antigravity assistant (Gemini).

**Yêu cầu (Asked for):**
Triển khai hoàn chỉnh Task T09 trên nhánh `feat/t09-ci` tách từ `develop` (sau khi đã tích hợp đầy đủ T01, T02, T03, T04, T05, T08). Tạo workflow `.github/workflows/ci.yml` kích hoạt cho các PRs vào `develop`, `main` và push/tag release `pa2`; chạy đúng 4 quality commands từ T04 trên môi trường Node 24 LTS / Ubuntu; chuẩn hóa tên check ổn định `quality-gate`; thiết lập tài liệu và phương án Branch Protection trên `main` cho T10.

**Phần giữ lại (Kept):**
- File workflow `.github/workflows/ci.yml` sử dụng `ubuntu-latest`, Node `24.x`, caching npm.
- Gom toàn bộ 4 lệnh chất lượng đã chốt từ T04: `npm run lint`, `npm run format-check`, `npm run type-check`, `npm test` (bao phủ đầy đủ 83/83 tests).
- Đặt tên job và tên check thống nhất là `quality-gate` làm required check cho Branch Protection.
- Thêm cơ chế concurrency (`cancel-in-progress: true` cho pull requests) để tránh lãng phí tài nguyên CI.
- Khai báo quyền tối thiểu `permissions: contents: read` theo nguyên tắc T05.
- Tạo bộ hồ sơ bằng chứng tại `docs/evidence/PA02/T09/` (`README.md`, `verification.json`, `AI-LOG.md`).
- Ghi nhận đầy đủ hạn chế của GitHub Free đối với private repositories (HTTP 403 khi gọi API protection) và phương án kích hoạt khi repo chuyển sang public trước hạn nộp PA02.

**Phần điều chỉnh (Changed):**
- Thống nhất tên job `quality-gate` trùng với job id để tránh xung đột tên check khi khai báo required status checks trên GitHub.
- Đồng bộ trigger `push: tags: ['pa2', 'pa02*']` để workflow tự động chạy kiểm thử khi nhóm gắn tag nộp bài theo rubric PA02.

**Phần không chọn (Rejected):**
- Không tạo ma trận workflow riêng cho từng module (tránh phức tạp hóa không cần thiết ngoài scope PA02).
- Không tự ý thay đổi visibility của repository sang public khi chưa có sự thống nhất của cả nhóm.
- Không sửa đổi các script `package.json` hoặc test suites đã được kiểm chứng ở T04/T08.

**Phần làm tay (By hand):**
- Người thực hiện kiểm tra thực tế quyền admin trên repository bằng GitHub CLI (`gh api repos/2609-AWAD-23-3/leetkob`).
- Xác minh phản hồi từ API branch protection và rulesets trên private repo.
- Chạy kiểm chứng toàn bộ 4 quality commands trên môi trường cục bộ Node 24.22.1 / npm 11.19.1.
- Mở PR hướng vào `develop` và yêu cầu reviewer Trần Quốc Vỹ (`@tranquocvy`) thẩm định độc lập.
