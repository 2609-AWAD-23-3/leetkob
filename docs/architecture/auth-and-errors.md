# LeeTKOB — Ranh giới xác thực, phân quyền và lỗi RFC 9457 của T03

**Thực hiện:** Phúc (BHVPhuc). **Reviewer độc lập:** Vượng (vinny2707).
**Tiêu chí nghiệm thu:** [PA02/T03](../plans/PA02.md#t03--auth-v%C3%A0-errors-chung), [Issue #3](https://github.com/2609-AWAD-23-3/leetkob/issues/3).

**Trạng thái:** bản triển khai trên nhánh `feat/t03-publish-auth-errors`, phát triển từ `develop` (`2dfff8f`). Cung cấp ranh giới xác thực danh tính tin cậy, kiểm tra vai trò TA cùng quyền sở hữu lớp–lab dựa trên lookup interface `PublishStore` của T02, và bộ chuẩn hóa lỗi RFC 9457 (`application/problem+json; charset=utf-8`) cho endpoint `POST /labs/{labId}/publish`.

## 1. Phạm vi và nguyên tắc bảo mật

- **Chỉ phục vụ scope publish PA02:** T03 chỉ triển khai xác thực/phân quyền và mô hình lỗi cần cho `POST /labs/{labId}/publish`. Không xây dựng API đăng nhập/đăng ký, OAuth, quản lý phiên hoặc mô hình lỗi cho các endpoints đã hoãn (`submissions`, `review-queue`).
- **Không bao giờ tin danh tính do client tự khai:** Các trường như `userId`, `taId`, `role`, `classId` hay `publishedBy` gửi trong request body hoặc query string tuyệt đối không được đọc để xác định danh tính hay quyền hạn.
- **Tách biệt thông tin xác thực client và cơ chế inject chỉ dùng trong test:**
  - Giao thức client chuẩn sử dụng header `Authorization: Bearer <token>` được tra cứu qua bảng ánh xạ token tin cậy phía server (`createTokenIdentityResolver`).
  - Khi khởi tạo mặc định (`createTokenIdentityResolver()` không truyền bảng token), không có token ngầm định nào tồn tại và mọi request đều bị từ chối với `401 unauthenticated`.
  - Helper phục vụ test `createTestHeaderIdentityResolver` mặc định tắt (`allowTestHeader: false`). Server khởi chạy mặc định (`src/server.ts`) không bao giờ bật cờ này, đảm bảo header test (`x-test-user-id`, `x-test-role`) không thể trở thành đường bypass phân quyền công khai.

## 2. Hợp đồng thông tin xác thực (Client Credential Contract) và Test Injection

Các thành phần được export qua [src/auth/index.ts](../../src/auth/index.ts):

```ts
export type PrincipalRole = 'admin' | 'TA' | 'student';

export interface Principal {
  readonly id: string;
  readonly role: PrincipalRole;
}

export interface IdentityResolver {
  resolve(headers: IncomingHeaders): IdentityResolution;
}
```

### 2.1. Header chuẩn cho Client (`Authorization: Bearer <token>`)

- Client gửi header `Authorization: Bearer <token>`, trong đó `<token>` là chuỗi không rỗng, không chứa khoảng trắng.
- Cách xử lý của `createTokenIdentityResolver({ tokens })`:
  - Không có header `Authorization` -> `{ kind: 'unauthenticated', reason: 'missing_credentials' }` (`401`).
  - Header rỗng, sai cú pháp scheme `Bearer <token>`, dư khoảng trắng đầu/cuối hoặc truyền dạng mảng -> `{ kind: 'unauthenticated', reason: 'malformed_credentials' }` (`401`).
  - Token không tồn tại trong bảng `tokens` phía server -> `{ kind: 'unauthenticated', reason: 'invalid_credentials' }` (`401`).
  - Token hợp lệ -> `{ kind: 'authenticated', principal: { id, role } }` (trả bản sao phòng thủ).

### 2.2. Cách inject danh tính an toàn trong Test

Tests của T03 và T08 có hai cách inject danh tính bằng code mà không mở đường bypass trên server thật:

1. **Qua bảng token fixture (`createPublishFixtureTokens`):**
   ```ts
   const identityResolver = createTokenIdentityResolver({
     tokens: createPublishFixtureTokens(),
   });
   ```
   Cung cấp sẵn các token giả lập khớp với fixture T02 (`createPublishSeed`):
   - `token-ta-one` -> `{ id: 'ta-one', role: 'TA' }` (phụ trách `class-1`)
   - `token-ta-other` -> `{ id: 'ta-other', role: 'TA' }` (phụ trách `class-2`)
   - `token-ta-multi` -> `{ id: 'ta-multi', role: 'TA' }` (phụ trách `class-1` và `class-2`)
   - `token-student-one` -> `{ id: 'student-one', role: 'student' }`
   - `token-admin-one` -> `{ id: 'admin-one', role: 'admin' }`

2. **Qua `createTestHeaderIdentityResolver({ allowTestHeader: true })` (chỉ bật tường minh trong test):**
   - Nếu `allowTestHeader` không được truyền hoặc bằng `false`, resolver bỏ qua hoàn toàn mọi header `x-test-user-id` / `x-test-role` và ủy quyền về `fallbackResolver`.
   - Chỉ khi test truyền tường minh `{ allowTestHeader: true }`, resolver mới đọc cặp header `x-test-user-id` và `x-test-role` (`admin | TA | student`). Thiếu một trong hai header hoặc giá trị sai định dạng sẽ trả về `{ kind: 'unauthenticated', reason: 'malformed_credentials' }`.

## 3. Ranh giới phân quyền Publish với `PublishStore` của T02

Hàm `authorizePublishAccess({ headers, labId, store, identityResolver })` kết nối trực tiếp với lookup interface `PublishStore` (`getLab`, `isTaAssignedToClass`) từ T02 theo đúng thứ tự:

| Bước | Kiểm tra | Kết quả `PublishAccessDecision` | Mã HTTP tương ứng |
| --- | --- | --- | ---: |
| 1 | `identityResolver.resolve(headers)` | `unauthenticated` | `401` |
| 2 | `principal.role === 'TA'` | `forbidden_role` nếu là `student` hoặc `admin` | `403` |
| 3 | `store.getLab(labId)` | `lab_not_found` nếu `undefined` | `404` |
| 4 | `store.isTaAssignedToClass(principal.id, lab.classId)` | `forbidden_class` nếu TA thuộc lớp khác | `403` |
| 5 | Đạt toàn bộ điều kiện | `authorized` kèm `{ principal, lab }` | Tiếp tục gọi `store.publishLab` |

- Kiểm tra `role === 'TA'` trước khi tra lab giúp ngăn `student` hoặc `admin` dò sự tồn tại của `labId` qua endpoint publish.
- Khi TA thuộc lớp khác (`forbidden_class`), phản hồi lỗi `403` dùng thông điệp cố định, không tiết lộ `classId` hay số lượng review của lớp khác.

## 4. Mô hình lỗi RFC 9457 (`application/problem+json; charset=utf-8`)

Mọi phản hồi 4xx/5xx đều được chuẩn hóa qua `src/auth/problem-details.ts` với `Content-Type: application/problem+json; charset=utf-8` và cấu trúc `ProblemDetails`:

| Slug (`https://leetkob.example/problems/<slug>`) | Status | Title | Trigger và trường mở rộng |
| --- | ---: | --- | --- |
| `unauthenticated` | `401` | `Authentication required` | Thiếu, sai định dạng hoặc không hợp lệ thông tin xác thực |
| `forbidden` | `403` | `Forbidden` | Caller không có role `TA` hoặc không được phân công vào lớp của `labId` |
| `invalid-json` | `400` | `Malformed JSON` | Body không phải JSON hợp lệ (bao gồm lỗi parser của Fastify) |
| `validation` | `400` | `Invalid request` | `labId` sai cú pháp (`^[a-zA-Z0-9_-]{1,64}$`) hoặc JSON body không phải object; kèm mảng `errors` (`{ parameter, detail }` hoặc `{ pointer, detail }`) |
| `not-found` | `404` | `Not found` | Không tìm thấy `labId` (hoặc route không tồn tại trong scope) |
| `before-deadline` | `409` | `Lab deadline has not passed` | Gọi publish khi `now < lab.deadline` (`PublishResult.kind === 'before_deadline'`), kèm `deadline` |
| `pending-reviews` | `409` | `Pending reviews block publication` | Còn mục review chưa có quyết định TA (`PublishResult.kind === 'pending_reviews'`), kèm `pendingCount` |
| `internal` | `500` | `Internal error` | Mọi ngoại lệ không mong đợi; luôn trả câu `detail` cố định, loại bỏ hoàn toàn stack trace, đường dẫn file và secrets |

Hàm `registerPublishErrorHandling(scope)` gắn content-type parser cho `application/json` (cho phép body rỗng hoặc JSON object hợp lệ, chuyển JSON lỗi thành `400 invalid-json`), `setErrorHandler` và `setNotFoundHandler` vào Fastify plugin scope mà không làm rò rỉ chi tiết nội bộ.

## 5. Giới hạn chưa Production-Ready

- Bảng token của `createTokenIdentityResolver` nằm trong bộ nhớ (in-memory), phục vụ kiểm chứng hợp đồng và quality gate PA02; chưa tích hợp hệ thống quản lý phiên, chữ ký JWT/JWKS hay cơ sở dữ liệu tài khoản thực.
- Chưa cấu hình rate limiting, thu hồi token (revocation) hoặc lưu vết kiểm toán (audit log) bền vững ngoài bộ nhớ tiến trình.
