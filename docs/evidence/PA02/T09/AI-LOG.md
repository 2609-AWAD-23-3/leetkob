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


---

## 11/11/2026 — Xử lý phản hồi Review độc lập từ Trần Quốc Vỹ (`@tranquocvy`)

**Công cụ (Tool):** Antigravity assistant (Gemini).

**Yêu cầu (Asked for):**
Xử lý toàn bộ 3 điểm phản hồi của reviewer trên PR #22:
1. Kích hoạt Branch Protection thực tế trên nhánh `main` khi repository đã là public (required check `quality-gate`, strict up-to-date, 1 approval, enforce admins).
2. Cập nhật checklist T09 và lưu evidence settings kích hoạt live vào `verification.json` và `README.md`.
3. Sửa mô tả phạm vi `format-check` trong tài liệu cho đúng với đặc tả T04 (`.github/` nằm trong `.prettierignore`).

**Phần giữ lại (Kept):**
- Giữ nguyên workflow `.github/workflows/ci.yml` và 4 lệnh kiểm tra chất lượng (reviewer đã xác nhận workflow chuẩn và không có lỗi).
- Cấu hình Branch Protection qua GitHub API với payload chuẩn: `strict: true`, `contexts: ["quality-gate"]`, `enforce_admins: true`, `required_approving_review_count: 1`, `dismiss_stale_reviews: true`.
- Ghi nhận trạng thái live settings trả về từ GitHub API vào `verification.json`.

**Phần điều chỉnh (Changed):**
- Sửa lại ghi chú mô tả của `npm run format-check` trong `README.md` và `verification.json`: làm rõ `.github/` được loại trừ theo `.prettierignore` của T04 và cú pháp YAML được kiểm tra tính hợp lệ riêng.
- Cập nhật checklist và tiến độ T09 trong `docs/plans/PA02.md` với đầy đủ liên kết và bằng chứng kích hoạt thực tế.

**Phần không chọn (Rejected):**
- Không tự ý mở rộng cấu hình formatter `.prettierignore` làm ảnh hưởng đến baseline chung của T04.
- Không đưa kịch bản deliberate break/fix vào PR #22 (đây là phạm vi độc lập của Task T10).

**Phần làm tay (By hand):**
- Người thực hiện trực tiếp gọi lệnh `gh api --method PUT repos/2609-AWAD-23-3/leetkob/branches/main/protection` để bật Branch Protection trên `main`.
- Đọc lại cấu hình bằng `gh api repos/2609-AWAD-23-3/leetkob/branches/main/protection` để xác nhận trạng thái live.
- Kiểm tra tính hợp lệ cú pháp YAML và chạy kiểm chứng toàn bộ quality commands trên Node 24.22.1 / npm 11.19.1.
- Phản hồi chi tiết trên PR #22 để reviewer thẩm định lại.
