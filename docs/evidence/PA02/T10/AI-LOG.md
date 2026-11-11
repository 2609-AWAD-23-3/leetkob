# Đầu vào AI-log — T10

Bản ghi task này dành cho T11 tổng hợp vào `AI-LOG.md` ở root. Bản ghi không thay báo cáo milestone hoặc review độc lập.

## 11/11/2026 — Thí nghiệm Contract Break / Fix trên Endpoint Publish

**Công cụ (Tool):** Antigravity assistant (Gemini).

**Yêu cầu (Asked for):**
Thực hiện thí nghiệm Task T10 theo đúng chuẩn rubric PA02:
1. Xác định invariant publish đã có assertion: Pending-Review Gate (`409 pending-reviews`).
2. Đồng bộ baseline sạch từ `develop` lên `main` qua PR #23 trước khi bắt đầu thí nghiệm.
3. Tạo nhánh `test/t10-contract-break-fix` từ baseline `main` và mở PR #24 target vào `main` với commit cố tình vi phạm hợp đồng (implementation-only break).
4. Xác nhận CI GitHub Actions báo ĐỎ do fail đúng test assertion (không phải lỗi lint/compile), và thu thập bằng chứng Branch Protection chặn đứng nút merge.
5. Tạo commit Fix khôi phục lại logic đúng (không sửa contract hay tests), đưa CI trở lại màu XANH trên cùng một PR, và chuẩn bị hồ sơ cho reviewer thẩm định.

**Phần giữ lại (Kept):**
- Invariant Pending-Review Gate được quy định tại `docs/contract/publish.md` và kiểm thử tại `tests/contract/publish.test.mjs:304`.
- Giữ nguyên vẹn 100% nội dung của contract và toàn bộ test suites trong suốt quá trình thí nghiệm.
- Ghi nhận đầy đủ chuỗi bằng chứng: Baseline commit SHA `91a738b5e967a3dcd1717ce406429a764e4cfae3`, Break commit SHA `934af86e190384eacfb7ce7c6de06e0c6362db59` (CI Run 42994215858 fail), Fix commit SHA `65097bab5deb18fc4aac7706ab139b5f12195a55` (CI Run 42994580687 pass), trạng thái `BLOCKED` của PR #24 khi check còn đỏ.
- Bộ hồ sơ bằng chứng tại `docs/evidence/PA02/T10/` (`README.md`, `verification.json`, `AI-LOG.md`).

**Phần điều chỉnh (Changed):**
- Sửa file `src/modules/publish/index.ts` để tạo ra sự khác biệt logic rõ ràng (bỏ qua nhánh `pending_reviews`), khiến bài test khẳng định mã 409 nhận được mã 200, tạo ra lỗi `AssertionError: 200 !== 409`.
- Phục hồi lại đoạn code kiểm tra hợp lệ để các lệnh chất lượng chuyển lại trạng thái đạt chuẩn (83/83 tests pass).

**Phần không chọn (Rejected):**
- Không tạo thí nghiệm phá vỡ bằng cách làm lỗi cú pháp hoặc gây lỗi TypeScript compile (vì yêu cầu đề bài là phải chứng minh contract test assertion bắt lỗi).
- Không sửa file test để làm cho test pass một cách giả tạo.
- Không sử dụng quyền administrator (`--admin`) để bypass merge protection khi PR đang đỏ.

**Phần làm tay (By hand):**
- Người thực hiện kiểm tra thực tế trạng thái PR bằng lệnh `gh pr view 24` và thử thực thi `gh pr merge 24 --merge` để xác nhận hệ thống từ chối merge do policy bảo vệ nhánh.
- Kiểm tra toàn bộ 4 quality commands trên môi trường cục bộ Node 24.22.1 / npm 11.19.1.
- Mở PR, yêu cầu reviewer độc lập Nguyễn Khắc Vượng (`@vinny2707`) thẩm định chuỗi bằng chứng.
