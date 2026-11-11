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

---

## 11/11/2026 — Xử lý phản hồi Review độc lập từ Nguyễn Hà Triều Vượng (`@vinny2707`)

**Công cụ (Tool):** Antigravity assistant (Gemini).

**Yêu cầu (Asked for):**
Xử lý toàn bộ 4 điểm phản hồi từ reviewer trên PR #20:
1. Xóa import không sử dụng `createPublishModule` trong `tests/contract/publish.test.mjs`, định dạng code bằng Prettier, chạy toàn bộ bộ lệnh chất lượng (`oxlint`, `prettier`, `type-check`, `npm test`).
2. Làm rõ thứ tự ưu tiên lỗi (precedence): framing Fastify (400 invalid-json) chạy trước auth ở tầng transport parser; kiểm tra role TA chạy trước kiểm tra lab existence để ngăn chặn nguy cơ dò quét mã lab (anti-enumeration defense).
3. Bổ sung ánh xạ lỗi 413 (`payload-too-large` với giới hạn 64 KB) và 415 (`unsupported-media-type`) vào contract và viết kiểm thử HTTP boundary tương ứng.
4. Bổ sung hướng dẫn chạy demo với `createPublishApp` và handoff tích hợp runtime cho Vỹ (`src/server.ts`).

**Phần giữ lại (Kept):**
- Loại bỏ import `createPublishModule` thừa tại dòng 5 file test.
- Thêm `{ bodyLimit: 65536 }` cho route `/labs/:labId/publish`.
- Thêm 4 bài kiểm thử mới trong `tests/contract/publish.test.mjs` (nâng tổng số test của suite contract lên 15 và toàn bộ dự án lên 82):
  - Kiểm thử 413 khi body vượt quá 64 KB.
  - Kiểm thử 415 khi `Content-Type` là `application/xml`.
  - Kiểm thử precedence: body JSON lỗi trả `400 invalid-json` ngay cả khi không gửi Bearer token.
  - Kiểm thử precedence anti-enumeration: caller có role `student` hoặc `admin` gửi `labId` không tồn tại nhận về `403 forbidden` (không bị lộ `404 not-found`), trong khi TA hợp lệ nhận `404 not-found`.
- Bổ sung tài liệu thứ tự ưu tiên 10 bước chi tiết trong `docs/contract/publish.md`.
- Bổ sung tài liệu demo execution và runtime handoff trong `docs/evidence/PA02/T08/README.md`.

**Phần điều chỉnh (Changed):**
- Đồng bộ lại `verification.json` với 82 tests pass 100% trên 6 test suites và ghi nhận đầy đủ 4 lệnh chất lượng hoàn thành với Exit code 0.

**Phần không chọn (Rejected):**
- Không thay đổi thiết kế bảo mật: giữ nguyên việc kiểm tra role trước lab lookup để duy trì phòng thủ anti-enumeration theo đúng chuẩn REST security.
- Không sửa file `src/server.ts` trực tiếp mà bàn giao rõ ràng bằng tài liệu hướng dẫn cho chủ sở hữu file (Vỹ).

**Phần làm tay (By hand):**
- Người thực hiện kiểm tra diff, chạy trực tiếp các lệnh chất lượng trên môi trường Node 24.22.1 / npm 11.19.1, review từng file trước khi commit và đẩy lên nhánh `feat/t08-publish`.
