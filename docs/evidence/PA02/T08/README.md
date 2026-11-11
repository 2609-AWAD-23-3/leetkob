# T08 — Bằng chứng triển khai Endpoint `POST /labs/{labId}/publish`

- **Task ID:** T08
- **Milestone:** PA02 (Harness và Quality Gate)
- **Executor:** Bửu Huỳnh Vĩnh Phúc (`@BHVPhuc` — Role C)
- **Reviewer độc lập:** Nguyễn Khắc Vượng (`@vinny2707` — Role A)
- **Nhánh triển khai:** `feat/t08-publish`
- **Môi trường:** Node `24.22.1` / npm `11.19.1` trên Windows x64

---

## 1. Kết quả kiểm chứng chất lượng thực tế (Quality Commands)

Toàn bộ các lệnh kiểm chứng chất lượng theo chuẩn dự án đã hoàn thành với mã thoát 0:

| Lệnh kiểm chứng | Kết quả | Chi tiết bằng chứng |
| :--- | :---: | :--- |
| `npm run lint` (`oxlint --deny-warnings src tests scripts`) | **Exit 0** | 0 warnings, 0 errors trên 22 files với 96 rules |
| `npm run format-check` (`prettier --check .`) | **Exit 0** | All matched files use Prettier code style |
| `npm run type-check` (`tsc -p tsconfig.check.json`) | **Exit 0** | Kiểm tra toàn bộ codebase và test files sạch, không lỗi kiểu |
| `npm test` (`npm run build && node scripts/test.mjs`) | **Exit 0** | **83/83 tests pass 100%** trên 6 suites (16 contract tests, 18 auth tests, 40 data tests, 7 smoke tests, 2 app lifecycle tests) |
| `git diff --check` | **Exit 0** | Không có trailing whitespace hoặc conflict markers |

---

## 2. Bảng ánh xạ Rule / Contract ➔ Test Assertion (Rule-to-Test Mapping)

Tất cả các điều khoản trong [`docs/contract/publish.md`](../../../contract/publish.md) được kiểm chứng tự động tại [`tests/contract/publish.test.mjs`](../../../../tests/contract/publish.test.mjs):

| Mục Contract | Mã HTTP & Trạng thái | Điều kiện kích hoạt | Test Assertion tương ứng |
| :--- | :---: | :--- | :--- |
| **HTTP Framing: Size Limit** | `413 payload-too-large` | Request body vượt quá giới hạn 65,536 bytes (64 KB). Trả về RFC 9457 `Payload too large` | `POST /labs/{labId}/publish — 413 payload-too-large when body exceeds 64 KB limit` |
| **HTTP Framing: Media Type** | `415 unsupported-media-type` | Request payload gửi định dạng không được hỗ trợ (ví dụ `application/xml`, `text/plain`, `text/plain; charset=utf-8`). Trả về RFC 9457 `Unsupported media type` | `POST /labs/{labId}/publish — 415 unsupported-media-type when content-type is unsupported (application/xml, text/plain)` |
| **Transport Precedence: Media Type** | `415 unsupported-media-type` | Request gửi `Content-Type: text/plain` và không có header `Authorization`; parser Fastify chạy trước auth và trả về `415` (không trả `401`) | `POST /labs/{labId}/publish — precedence: unsupported content-type (text/plain) is rejected with 415 before authentication` |
| **Transport Precedence** | `400 invalid-json` | Request gửi body lỗi cú pháp JSON và không có header `Authorization`; parser Fastify chạy trước auth và trả về `400` (không trả `401`) | `POST /labs/{labId}/publish — precedence: malformed JSON body is rejected with 400 invalid-json before authentication` |
| **Authentication** | `401 unauthenticated` | Thiếu header `Authorization`, sai scheme (Basic), hoặc token không tồn tại. Tự động trả header `WWW-Authenticate: Bearer` | `POST /labs/{labId}/publish — 401 unauthenticated when credentials are missing, malformed, or invalid` |
| **Input: JSON Syntax** | `400 invalid-json` | Body gửi lên không phải JSON hợp lệ, hoặc chứa prototype pollution payload (`{"__proto__": ...}`) | `POST /labs/{labId}/publish — 400 invalid-json for malformed JSON or prototype pollution payload` |
| **Input: LabId & Body** | `400 validation` | `labId` vi phạm regex `^[a-zA-Z0-9_-]{1,64}$`, hoặc body là JSON hợp lệ nhưng không phải object (array, primitive) | `POST /labs/{labId}/publish — 400 validation for invalid labId syntax or non-object JSON body` |
| **Anti-Enumeration Role Precedence** | `403 forbidden` | Role `student` hoặc `admin` gọi với `labId` không tồn tại; server trả về `403 forbidden` (không trả `404`) để bảo vệ chống dò quét lab ID | `POST /labs/{labId}/publish — precedence: caller role check precedes lab lookup (anti-enumeration defense)` (bước 1 & 2) |
| **Resource Existence** | `404 not-found` | Caller là `TA` hợp lệ nhưng `labId` không tồn tại trong store. Trả về `404 not-found` | `POST /labs/{labId}/publish — precedence: caller role check precedes lab lookup (anti-enumeration defense)` (bước 3) & `POST /labs/{labId}/publish — 404 not-found when target lab does not exist` |
| **Authorization: Class** | `403 forbidden` | Caller là `TA` nhưng không được phân công phụ trách lớp sở hữu lab (`store.isTaAssignedToClass === false`) | `POST /labs/{labId}/publish — precedence: caller role check precedes lab lookup (anti-enumeration defense)` (bước 4) & `POST /labs/{labId}/publish — 403 forbidden for student, admin, or cross-class TA` (bước 3) |
| **Gate: Deadline** | `409 before-deadline` | Thời điểm server hiện tại trước hạn nộp (`now < lab.deadline`) | `POST /labs/{labId}/publish — 409 before-deadline when server time is before deadline` |
| **Gate: Pending Reviews** | `409 pending-reviews` | Còn ít nhất 1 mục review queue chưa có quyết định TA (`pendingCount > 0`). Trả về member `pendingCount: 1`, không mutate store | `POST /labs/{labId}/publish — 409 pending-reviews with pendingCount member when reviews remain pending` |
| **Initial Publish** | `200 OK` | Đủ điều kiện: chuyển trạng thái sang `published`, trả về `LabPublication` (`labId`, `classId`, `status: 'published'`, `publishedAt`, `publishedBy`, `summary`), không có header `Idempotent-Replayed` | `POST /labs/{labId}/publish — 200 OK initial publication succeeds and returns LabPublication resource` |
| **Repeat Idempotency** | `200 OK` | Gọi lại trên lab đã công bố: trả về đúng payload cũ, kèm header `Idempotent-Replayed: true`. Không tạo publication lần 2, không ghi đè `publishedAt`/`publishedBy` ngay cả khi TA khác cùng lớp gọi lại | `POST /labs/{labId}/publish — 200 OK repeated call is naturally idempotent with Idempotent-Replayed: true` |
| **Body Spoofing Denial** | `403 forbidden` | Client cố tình gửi `role`, `userId`, `classId`, `force`, `publishedAt` trong body; server hoàn toàn bỏ qua và dựa vào Bearer token | `POST /labs/{labId}/publish — client cannot spoof caller identity, role, or state in body` |
| **Optional Body** | `200 OK` | Request không gửi body hoặc gửi `{}` rỗng vẫn publish thành công | `POST /labs/{labId}/publish — empty request body or omitted body succeeds` |

---

## 3. Hướng dẫn chạy Demo & Handoff tích hợp Runtime cho Vỹ (`src/server.ts`)

### 3.1 Khởi chạy và thử nghiệm Demo với `createPublishApp`
Module publish được thiết kế theo kiến trúc plugin module hóa của Fastify. Để thử nghiệm trực tiếp endpoint trong môi trường lập trình hoặc demo kịch bản chấm bài:

```typescript
import { createPublishApp } from './modules/publish/index.js';
import {
  createInMemoryPublishStore,
  createPublishSeed,
  createFixedClock,
  FIXTURE_AFTER_DEADLINE,
} from './data/index.js';
import {
  createTokenIdentityResolver,
  createPublishFixtureTokens,
} from './auth/index.js';

// 1. Tạo store với kịch bản dữ liệu mẫu (ví dụ: 'resolved' đã giải quyết hết review)
const { store } = createInMemoryPublishStore({
  initialState: createPublishSeed('resolved'),
  clock: createFixedClock(FIXTURE_AFTER_DEADLINE),
});

// 2. Cấu hình resolver token Bearer danh tính
const identityResolver = createTokenIdentityResolver({
  tokens: createPublishFixtureTokens(),
});

// 3. Khởi tạo ứng dụng với publish module
const app = createPublishApp({
  store,
  identityResolver,
  logger: true,
});

// 4. Lắng nghe trên cổng hoặc inject trực tiếp
await app.listen({ port: 3000, host: '127.0.0.1' });
console.log('Publish endpoint sẵn sàng tại http://127.0.0.1:3000/labs/:labId/publish');
```

**Ví dụ lệnh cURL thử nghiệm thành công:**
```bash
curl -X POST http://127.0.0.1:3000/labs/lab-1/publish \
  -H "Authorization: Bearer token-ta-one" \
  -H "Content-Type: application/json"
```

**Kết quả nhận được (HTTP 200):**
```json
{
  "labId": "lab-1",
  "classId": "class-1",
  "status": "published",
  "publishedAt": "2026-11-09T15:00:00.001Z",
  "publishedBy": "ta-one",
  "summary": {
    "queueItemCount": 3,
    "passDecisionCount": 2,
    "violationDecisionCount": 1
  }
}
```

### 3.2 Handoff cho Vỹ (`src/server.ts` & `src/app.ts`)
- **Phân định quyền sở hữu file:** Vỹ phụ trách `src/app.ts` và `src/server.ts`. Phúc phụ trách `src/auth/` và `src/modules/publish/`.
- **Handoff tích hợp:** Để đưa route `/labs/:labId/publish` vào server runtime production:
  1. Trong `src/server.ts`, khởi tạo instance `PublishStore` (ví dụ `createInMemoryPublishStore`) và `IdentityResolver` (ví dụ `createTokenIdentityResolver({ tokens })`).
  2. Truyền cả `{ store, identityResolver }` vào `createPublishModule({ store, identityResolver })` khi cấu hình `createApp`:
     ```typescript
     const app = createApp({
       modules: {
         publish: createPublishModule({ store, identityResolver }),
       },
     });
     ```
     *Lưu ý:* Nếu không truyền `identityResolver`, resolver mặc định sẽ có danh bạ token rỗng (chưa nạp fixture tokens), khiến mọi Bearer token đều bị từ chối với `401 unauthenticated`. Do đó cần truyền đồng thời cả `{ store, identityResolver }`.
  3. Module publish tự động mount route `/labs/:labId/publish`, thiết lập `bodyLimit: 65536`, và đăng ký RFC 9457 error handler.
  4. Nếu `store` không được truyền (giữ nguyên mặc định), `publishModule` sẽ không mount route để đảm bảo invariant "business routes are absent rather than fake successful implementations" cho skeleton.

---

## 4. Bàn giao Invariant cho T10 (Contract Break/Fix Experiment)

- **Invariant được chọn:** **Pending-Review Gate (`409 pending-reviews`)**.
- **Mô tả hành vi chuẩn:** Khi lab còn ít nhất một mục review ở trạng thái `pending` (`taDecision === null`), endpoint `POST /labs/{labId}/publish` bắt buộc phải từ chối công bố với mã lỗi HTTP `409`, Problem Type `https://leetkob.example/problems/pending-reviews`, member `pendingCount >= 1`, và tuyệt đối không tạo bản ghi publication trong store.
- **Test bắt lỗi trong T10:** Test `POST /labs/{labId}/publish — 409 pending-reviews with pendingCount member when reviews remain pending` tại `tests/contract/publish.test.mjs` sẽ trực tiếp bắt bất kỳ thay đổi nào làm suy yếu gate này (ví dụ: vô hiệu hóa kiểm tra pending hoặc trả sai status code).

---

## 5. Giới hạn API (API Notes & Limitations cho T11)

- **In-Memory Store:** Backend trong PA02 sử dụng store bộ nhớ trong, dữ liệu reset khi restart process.
- **Single-Process Concurrency:** Đảm bảo tính nhất quán (atomicity) của việc publish và gọi lặp trên cùng một tiến trình Node.js (event loop). Không áp dụng khóa phân tán đa tiến trình.
- **Scope PA02:** Chỉ phục vụ duy nhất endpoint `POST /labs/{labId}/publish`. Các endpoints hoãn (`POST .../submissions`, `GET .../review-queue`) không được cài đặt.
- **Payload Size Bound:** Giới hạn kích thước payload tối đa là 64 KB (65,536 bytes). Payload vượt quá giới hạn trả về HTTP 413 `payload-too-large`.
