# PA03-T09 — Review queue và chặn Publish

- Task: [Issue #38](https://github.com/2609-AWAD-23-3/leetkob/issues/38), mục T09 trong [plan PA03](../../../plans/PA03.md#t09--review-queue-và-chặn-publish).
- Người thực hiện: Vượng (@vinny2707). Reviewer: Vỹ (@tranquocvy).
- Nhánh: `feat/pa03-t09-review-queue`, tách từ `origin/develop` tại `6df715f` (đã có T03, T04, T06, T07, T08).
- Trạng thái: code, test và tài liệu xong trên working tree local; **chưa commit/push, chưa mở PR, chưa đồng bộ Issue #38**.

## 1. Đã làm

| Phần | Nội dung |
| --- | --- |
| API review queue | `GET /labs/{labId}/review-queue`, `GET /review-items/{itemId}` (thêm toàn bộ code, FAQ-09), `POST /review-items/{itemId}/decision`, `POST /labs/{labId}/review-queue/confirm-passes`. Contract: [review-queue.md](../../../contract/review-queue.md) |
| Phân quyền | Session Bearer của T04. Không đăng nhập `401`; student, admin `403`; TA lớp khác `404` như lab không tồn tại (FAQ-01, giống contract labs). Người review luôn là user của session; field `taId`, `role` trong body bị từ chối |
| Bằng chứng khi chọn `violation` | Bắt buộc ít nhất một dòng (FAQ-09), kéo lên từ PA04 theo quyết định của Vượng ngày 23/11/2026. TA chỉ gửi số dòng; server lấy text của dòng từ code đã nộp (`\n`, `\r\n`, `\r`), nên TA không gửi được text lệch với code. `pass` không nhận dòng nào |
| Publish | Route `POST /labs/{labId}/publish` chạy trên `PublicationStore` async (Postgres khi deploy) với session token, giữ nguyên contract v1: cùng thứ tự kiểm tra, status, problem type, field. `pendingCount` lấy từ queue thật, nên còn một verdict chưa có quyết định, kể cả `pass`, là `409 pending-reviews`. Sau Publish, quyết định và xác nhận hàng loạt trả `409 conflict` |
| Runtime | `src/api/runtime.ts` gắn review queue và Publish vào Store thật; trước T09 hai route này không có trên deployment |
| OpenAPI | `/docs` liệt kê 4 endpoint review queue và Publish (`src/api/modules/api-docs/review-openapi.ts`), để kiểm tra qua giao diện API của sản phẩm |
| Sinh viên không thấy verdict (FAQ-08) | Không endpoint nào trả verdict cho student; API bài nộp chỉ trả kết quả chấm test. Có test đọc bài nộp bằng tài khoản student |

Thay đổi ở code dùng chung (`src/api/auth/`): thêm `authorizePublishAccessAsync` và `createSessionPublishIdentityResolver`; hàm đồng bộ `authorizePublishAccess` và resolver token của PA02 giữ nguyên để test PA02 không đổi.

## 2. Test trước

1. Viết `tests/support/review-queue.mjs`, `tests/contract/review-queue.test.mjs`, `tests/integration/review-runtime.test.mjs` khi chưa có dòng code nào của T09.
2. Chạy đỏ: [red-before-implementation.txt](red-before-implementation.txt). File contract không nạp được vì chưa có `createSessionPublishIdentityResolver`; test runtime đỏ vì route review queue trả `404` thay vì `401`. Exit code 1.
3. Cài đặt rồi chạy lại. Hai test đầu tiên đỏ vì **lỗi của chính test**: hàm helper có tham số mặc định `userId = 'ta-1'`, nên `call(undefined)` vẫn gửi token của TA thay vì không có header. Đã sửa test thành `call(null)` để đúng ý "không đăng nhập"; không nới assertion nào. Sau đó toàn bộ xanh.

Log đỏ đã bỏ hai dòng log JSON của Fastify (có tên máy, pid) và thay đường dẫn máy bằng `<repo>`; ngoài ra không sửa.

## 3. Kiểm chứng local

Node v24.22.3, npm 11.19.1, Windows, PostgreSQL 17.11 trong Docker. Chạy trên working tree chưa commit từ `6df715f`.

**Log của bản cài đặt hiện tại (phương án B):** [green-current.txt](green-current.txt): exit code của mọi lệnh, tên từng test T09 và Publish (50/50), 4 test Postgres của review queue, kèm fingerprint của thay đổi để đối chiếu đúng bản. Hai log đỏ ([red-before-implementation.txt](red-before-implementation.txt), [red-review-fixes.txt](red-review-fixes.txt)) là bản ghi lịch sử, giữ nguyên nội dung; dòng đầu mỗi file ghi rõ điều đó.

| Lệnh | Baseline `6df715f` | Sau T09 |
| --- | --- | --- |
| `npm run lint` | exit 0 | exit 0 |
| `npm run format-check` | exit 0 | exit 0 |
| `npm run type-check` | exit 0 | exit 0 |
| `npm test` | exit 0; 498 test, 496 pass, 2 skipped | exit 0; 515 test, 512 pass, 3 skipped, 0 fail |
| `git diff --check` | | exit 0 |
| `npm run test:db` (Postgres 17 local, `docker/compose.postgres.yml`) | exit 0; 91 test, 91 pass | exit 0; 95 test, 95 pass, 0 fail; không còn schema test thừa |

Test mới: 15 contract test (11 viết trước khi có code, 1 test OpenAPI thêm sau khi cài đặt, 3 test của bản sửa review: hai viết trước khi sửa, test Publish của TA lớp khác viết lại theo phương án B), 1 test runtime, 4 test API trên Postgres (1 của bản sửa review). 3 skipped của `npm test` là ba file Postgres tự bỏ qua khi không có `TEST_DATABASE_URL`; chúng chạy trong `npm run test:db` và job CI `postgres-store`. 660 dòng contract test Publish của PA02 (`tests/contract/publish.test.mjs`) và `tests/integration/publish-auth-errors.test.mjs` không sửa, vẫn xanh.

Các trường hợp được test:

- TA đúng lớp thấy 4 mục (2 bài × 2 ràng buộc) với verdict, evidence, mức trừ, nguyên nhân `unsure`; danh sách không chứa code, trang chi tiết có code.
- Không đăng nhập `401` kèm `WWW-Authenticate: Bearer`; student-1, student-2, admin `403`; TA lớp khác `404`, cho cả bốn endpoint; không trạng thái nào bị đổi.
- ID lạ `404`, ID sai định dạng `400`.
- `violation` không có dòng, dòng 0, dòng ngoài file, số thực, chuỗi, dòng trùng, `pass` kèm dòng, `unsure`, field `taId`, body rỗng hoặc mảng: đều `400`; `text/plain`: `415`; không ghi quyết định nào. Hợp lệ thì `taEvidence` lấy text từ code, `reviewedBy` là user của session. File CRLF cho text không có `\r`.
- Xác nhận hàng loạt chỉ đổi các verdict `pass` chưa review.
- Publish: trước deadline `409 before-deadline`; còn một `pass` chưa review `409 pending-reviews` với `pendingCount: 1`; xác nhận xong thì `200`, gọi lại `200` kèm `Idempotent-Replayed: true` và cùng nội dung. Contract v1 với session: `401` cho thiếu, sai scheme, token lạ; `403` cho student, admin, TA lớp khác (giữ contract v1, xem mục 4); `404` cho lab lạ.
- Sau Publish: quyết định và xác nhận hàng loạt `409 conflict`, quyết định cũ giữ nguyên.
- Student đọc bài nộp của mình: chỉ có `id`, `labId`, `studentId`, `code`, `submittedAt`, `status`, `judgeResult` (`verdict`, `tests`); không có chữ `violation`, `unsure`, `evidence`, `taDecision` trong response.
- Runtime gắn đủ năm route và đòi session (`401`), không còn `404`.
- Trên Postgres (`tests/integration/review-queue-postgres.test.mjs`): TA thấy queue và code, student `403`, TA lớp khác `404`; luật bằng chứng, `pass` chưa duyệt chặn Publish, Publish một lần, khoá quyết định; sau khi đóng store và mở lại cùng schema (giống restart process), publication, quyết định và evidence của TA còn nguyên, gọi Publish lại trả `Idempotent-Replayed: true`, quyết định vẫn bị khoá.
- `/docs/json` có đủ năm operation với `bearerAuth`; schema `ReviewDecisionInput` không có trường mức trừ.

## 4. Bản sửa theo review của Vượng (23/11/2026)

Vượng review bản local và chỉ ra hai vấn đề. Cả hai làm theo thứ tự test đỏ trước rồi mới sửa code; log: [red-review-fixes.txt](red-review-fixes.txt) (5 test in-memory và 1 test Postgres đỏ, exit 1).

1. **`confirm-passes` trả `200` khi Publish commit giữa chừng.** Route kiểm publication rồi mới gọi Store; trên Postgres `confirmPasses` chờ khoá dòng lab, thấy lab đã publish thì không xác nhận gì và trả 0, nên API trả `200 { confirmedCount: 0 }`. Sửa: `confirmedCount === 0` và lab đã có publication thì trả `409 conflict`, giống route `decision`. Test: in-memory chen Publish vào ngay trước khi Store xác nhận; Postgres giữ khoá `FOR UPDATE` trên dòng lab bằng một kết nối khác, chờ tới khi `confirm-passes` bị chặn (`pg_stat_activity`), ghi publication rồi `COMMIT` → phản hồi `409` và mục `pass` chưa duyệt vẫn chưa được xác nhận.
2. **Publish lộ việc lab tồn tại cho TA lớp khác** (`403` ở Publish, `404` ở review queue). Lần đầu làm theo đề xuất của Vượng: đổi Publish sang `404` như lab không tồn tại, ghi thay đổi contract và đổi ba kỳ vọng `403` trong test Publish PA02 (log đỏ ở trên có các test này). Sau đó Claude chỉ ra rằng acceptance T09 yêu cầu "giữ contract v1" và mục 5 của `publish.md` dành việc đổi status cho version mới; Vượng so sánh ba phương án và **chốt phương án B**: Publish giữ `403` theo contract v1, review queue giữ `404` như API labs và FAQ-01. Đã hoàn lại: `mapAccessDecisionToProblem` và hai file test Publish PA02 trở về đúng bản trên `develop`, bỏ ghi chú ngoại lệ trong `publish.md`. Khác biệt `403`/`404` được ghi là rủi ro đã chấp nhận trong [review-queue.md](../../../contract/review-queue.md) và đoạn PA03 của `publish.md`: body `403` không có dữ liệu lab, chỉ cho người đã biết ID biết lab tồn tại, và ID lab là UUID ngẫu nhiên. Test giữ lại: TA lớp khác gọi Publish nhận đúng body `403` của contract v1, không chứa `class-1`, lab ID, deadline hay `pendingCount`; bốn endpoint review queue trả cùng `404` cho lab/mục thật và không tồn tại.

## 5. Giới hạn

- Test OpenAPI được thêm sau khi cài đặt, không nằm trong lần chạy đỏ. Test Postgres viết sau khi bản in-memory đã xanh và xanh ngay lần đầu; chúng kiểm tra cùng hành vi trên Store thật.
- Kiểm chứng chạy trên Windows local và Postgres trong Docker; CI chưa chạy vì chưa push.

- Không có UI; plan cho phép "UI tối thiểu hoặc chỉ API".
- Nhật ký đổi quyết định có trong Store (FAQ-10) nhưng chưa có API đọc; lấy mẫu 10% `pass` là PA04.
- `reason` của model là text không tin cậy; client hiển thị phải escape.
