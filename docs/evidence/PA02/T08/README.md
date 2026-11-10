# T08 — Bằng chứng triển khai Endpoint `POST /labs/{labId}/publish`

- **Task ID:** T08
- **Milestone:** PA02 (Harness và Quality Gate)
- **Executor:** Bửu Huỳnh Vĩnh Phúc (`@BHVPhuc` — Role C)
- **Reviewer độc lập:** Nguyễn Hà Triều Vượng (`@vinny2707` — Role A)
- **Nhánh triển khai:** `feat/t08-publish`
- **Môi trường:** Node `24.22.1` / npm `11.19.1` trên Windows x64

---

## 1. Kết quả kiểm chứng thực tế

| Lệnh kiểm chứng | Kết quả | Chi tiết bằng chứng |
| :--- | :---: | :--- |
| `npm run build` (`tsc -p tsconfig.json`) | **Exit 0** | Biên dịch TypeScript sạch, không có cảnh báo hay lỗi kiểu |
| `node --test ...` (76/76 tests pass) | **Exit 0** | Toàn bộ 4 suites đạt 100%: 11 contract + 18 auth + 40 data + 7 smoke |
| `git diff --check` | **Exit 0** | Không có trailing whitespace hoặc conflict markers |

---

## 2. Bảng ánh xạ Rule / Contract ➔ Test Assertion (Rule-to-Test Mapping)

Tất cả các điều khoản trong [`docs/contract/publish.md`](../../../contract/publish.md) được kiểm chứng tự động tại [`tests/contract/publish.test.mjs`](../../../../tests/contract/publish.test.mjs):

| Mục Contract | Mã HTTP & Trạng thái | Điều kiện kích hoạt | Test Assertion tương ứng |
| :--- | :---: | :--- | :--- |
| **Authentication** | `401 unauthenticated` | Thiếu header `Authorization`, sai scheme (Basic), hoặc token không tồn tại. Tự động trả header `WWW-Authenticate: Bearer` | `POST /labs/{labId}/publish — 401 unauthenticated when credentials are missing, malformed, or invalid` |
| **Input: JSON Syntax** | `400 invalid-json` | Body gửi lên không phải JSON hợp lệ, hoặc chứa prototype pollution payload (`{"__proto__": ...}`) | `POST /labs/{labId}/publish — 400 invalid-json for malformed JSON or prototype pollution payload` |
| **Input: LabId & Body** | `400 validation` | `labId` vi phạm regex `^[a-zA-Z0-9_-]{1,64}$`, hoặc body là JSON hợp lệ nhưng không phải object (array, primitive) | `POST /labs/{labId}/publish — 400 validation for invalid labId syntax or non-object JSON body` |
| **Resource Existence** | `404 not-found` | `labId` hợp lệ về mặt cú pháp nhưng không tồn tại trong store | `POST /labs/{labId}/publish — 404 not-found when target lab does not exist` |
| **Authorization: Role** | `403 forbidden` | Caller có role `student` hoặc `admin` (chỉ role `TA` mới được phép publish) | `POST /labs/{labId}/publish — 403 forbidden for student, admin, or cross-class TA` (phần 1 & 2) |
| **Authorization: Class** | `403 forbidden` | Caller là `TA` nhưng không được phân công phụ trách lớp sở hữu lab (`store.isTaAssignedToClass === false`) | `POST /labs/{labId}/publish — 403 forbidden for student, admin, or cross-class TA` (phần 3) |
| **Gate: Deadline** | `409 before-deadline` | Thời điểm server hiện tại trước hạn nộp (`now < lab.deadline`) | `POST /labs/{labId}/publish — 409 before-deadline when server time is before deadline` |
| **Gate: Pending Reviews** | `409 pending-reviews` | Còn ít nhất 1 mục review queue chưa có quyết định TA (`pendingCount > 0`). Trả về member `pendingCount: 1`, không mutate store | `POST /labs/{labId}/publish — 409 pending-reviews with pendingCount member when reviews remain pending` |
| **Initial Publish** | `200 OK` | Đủ điều kiện: chuyển trạng thái sang `published`, trả về `LabPublication` (`labId`, `classId`, `status: 'published'`, `publishedAt`, `publishedBy`, `summary`), không có header `Idempotent-Replayed` | `POST /labs/{labId}/publish — 200 OK initial publication succeeds and returns LabPublication resource` |
| **Repeat Idempotency** | `200 OK` | Gọi lại trên lab đã công bố: trả về đúng payload cũ, kèm header `Idempotent-Replayed: true`. Không tạo publication lần 2, không ghi đè `publishedAt`/`publishedBy` ngay cả khi TA khác cùng lớp gọi lại | `POST /labs/{labId}/publish — 200 OK repeated call is naturally idempotent with Idempotent-Replayed: true` |
| **Body Spoofing Denial** | `403 forbidden` | Client cố tình gửi `role`, `userId`, `classId`, `force`, `publishedAt` trong body; server hoàn toàn bỏ qua và dựa vào Bearer token | `POST /labs/{labId}/publish — client cannot spoof caller identity, role, or state in body` |
| **Optional Body** | `200 OK` | Request không gửi body hoặc gửi `{}` rỗng vẫn publish thành công | `POST /labs/{labId}/publish — empty request body or omitted body succeeds` |

---

## 3. Bàn giao Invariant cho T10 (Contract Break/Fix Experiment)

- **Invariant được chọn:** **Pending-Review Gate (`409 pending-reviews`)**.
- **Mô tả hành vi chuẩn:** Khi lab còn ít nhất một mục review ở trạng thái `pending` (`taDecision === null`), endpoint `POST /labs/{labId}/publish` bắt buộc phải từ chối công bố với mã lỗi HTTP `409`, Problem Type `https://leetkob.example/problems/pending-reviews`, member `pendingCount >= 1`, và tuyệt đối không tạo bản ghi publication trong store.
- **Test bắt lỗi trong T10:** Test `POST /labs/{labId}/publish — 409 pending-reviews with pendingCount member when reviews remain pending` tại `tests/contract/publish.test.mjs` sẽ trực tiếp bắt bất kỳ thay đổi nào làm suy yếu gate này (ví dụ: vô hiệu hóa kiểm tra pending hoặc trả sai status code).

---

## 4. Giới hạn API (API Notes & Limitations cho T11)

- **In-Memory Store:** Backend trong PA02 sử dụng store bộ nhớ trong, dữ liệu reset khi restart process.
- **Single-Process Concurrency:** Đảm bảo tính nhất quán (atomicity) của việc publish và gọi lặp trên cùng một tiến trình Node.js (event loop). Không áp dụng khóa phân tán đa tiến trình.
- **Scope PA02:** Chỉ phục vụ duy nhất endpoint `POST /labs/{labId}/publish`. Các endpoints hoãn (`POST .../submissions`, `GET .../review-queue`) không được cài đặt.
