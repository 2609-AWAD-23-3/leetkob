# Đầu vào AI-log — T08

Bản ghi task này dành cho T11 tổng hợp vào `AI-LOG.md` ở root. Bản ghi không thay báo cáo milestone hoặc review độc lập.

## 10/11/2026 — Triển khai Endpoint `POST /labs/{labId}/publish`, Contract và Contract Tests

**Công cụ (Tool):** Antigravity assistant (Gemini).

**Yêu cầu (Asked for):**
Triển khai hoàn chỉnh Task T08 trên nhánh `feat/t08-publish` tách từ `develop` (sau khi T01, T02, T03 đã được tích hợp). Viết đầy đủ contract `docs/contract/publish.md` theo 5 phần của mẫu IA#3, xây dựng module `src/modules/publish/`, bộ kiểm thử HTTP boundary toàn diện `tests/contract/publish.test.mjs`, ghi nhận đầy đủ bằng chứng kiểm chứng, và chuẩn bị invariant bàn giao cho T10.

**Phần giữ lại (Kept):**
- Contract 5 phần chuẩn IA#3 (`Conventions`, `Errors`, `Resources`, `Endpoints`, `Versions and the legacy API`) với thứ tự ưu tiên kiểm tra (precedence) nghiêm ngặt.
- Cấu trúc tài nguyên `LabPublication` đồng bộ chính xác với mô hình T02: `labId`, `classId`, `status: 'published'`, `publishedAt`, `publishedBy`, và `summary` (`queueItemCount`, `passDecisionCount`, `violationDecisionCount`).
- Fastify plugin `createPublishModule` và `publishModule` trong `src/modules/publish/index.ts` kết nối trực tiếp với `PublishStore` (T02) và `authorizePublishAccess` / `registerPublishErrorHandling` (T03).
- Cơ chế lũy quyền tự nhiên (Natural Idempotency): gọi lại lần 2 trên lab đã publish trả về `200 OK` kèm header `Idempotent-Replayed: true` và bảo toàn nguyên vẹn `publishedAt`/`publishedBy`/`summary`.
- 11 bài kiểm thử HTTP-boundary trong `tests/contract/publish.test.mjs` bao phủ 100% các nhánh lỗi (401, 400 invalid-json, 400 validation, 404, 403 role/class, 409 deadline/pending) và 200 thành công/gọi lặp.

**Phần điều chỉnh (Changed):**
- Đồng bộ các trường thống kê trong `LabPublication` khớp với `PublicationSummary` của T02 (`queueItemCount`, `passDecisionCount`, `violationDecisionCount`) thay vì bản nháp ban đầu (`publishedSubmissionCount`, `totalDeductionsApplied`).
- Thống nhất tên thuộc tính số đếm review chưa xử lý là `pendingCount` trong problem details `pending-reviews` theo đúng interface của T02/T03.
- Bảo vệ an toàn cho smoke test: `publishModule` chỉ đăng ký route khi được truyền `store` hợp lệ, giữ nguyên tính chất "business routes are absent" của skeleton mặc định khi chưa cấu hình.

**Phần không chọn (Rejected):**
- Không tự ý sửa đổi `src/app.ts`, `src/data/*`, `package.json` hoặc các task của thành viên khác.
- Không cho phép request body override danh tính caller, role, class hay deadline.
- Không sử dụng mock endpoint; toàn bộ kiểm thử chạy qua HTTP injection thật (`app.inject`).
- Không triển khai các endpoint đã hoãn (`POST /labs/{labId}/submissions`, `GET /labs/{labId}/review-queue`).

**Phần làm tay (By hand):**
- Người thực hiện kiểm soát và duyệt kế hoạch triển khai, đối chiếu yêu cầu rubric PA02 (R5 Contract 25đ, R6 Contract tests 15đ) và kiểm chứng thực tế trên Node 24.22.1 / npm 11.19.1.
- Chọn và định nghĩa invariant bàn giao cho T10: Gate từ chối khi còn pending review (`409 pending-reviews`).

Kết quả kiểm chứng và giới hạn môi trường được ghi tại [README.md](README.md) và [verification.json](verification.json).
