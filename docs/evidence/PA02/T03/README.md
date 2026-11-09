# Bằng chứng kiểm chứng — T03

**Task:** [PA02/T03](../../../plans/PA02.md#t03--auth-v%C3%A0-errors-chung) · [Issue #3](https://github.com/2609-AWAD-23-3/leetkob/issues/3)
**Thực hiện:** Phúc (BHVPhuc) · **Reviewer độc lập:** Vượng (vinny2707)

Tài liệu thiết kế và API: [docs/architecture/auth-and-errors.md](../../../architecture/auth-and-errors.md).
Bản ghi số liệu kiểm chứng: [verification.json](verification.json).

## 1. Môi trường thực thi

- **Hệ điều hành:** Windows x64 (`d:\HCMUS\Year4\Sem1\AdvancedWeb\DoAn_NhomWebNC\leetkob`).
- **Nhánh làm việc:** `feat/t03-publish-auth-errors` tách từ `origin/develop` (`2dfff8f11cc6c28a8f5d8795bf915735b117902c`).
- **Runtime chuẩn đồ án:** Node `v24.22.1`, npm `11.19.1` (quản lý trực tiếp qua NVM kết hợp file `.node-version`; `npm ci` hoàn tất sạch sẽ 55 packages, 0 cảnh báo `EBADENGINE`).
- **Khả năng tương thích:** Code và tests đã được kiểm tra đạt 100% trên cả Node 24.22.1 và Node 22.19.0.

## 2. Đối chiếu yêu cầu T03 với kết quả kiểm thử

| Yêu cầu trong checklist T03 | Bằng chứng trong code và `tests/auth/publish-auth-errors.test.mjs` |
| --- | --- |
| Resolve caller tin cậy, không lấy `role`/`userId` từ body | `createTokenIdentityResolver` chỉ đọc header `Authorization: Bearer <token>`; test gửi `userId: 'ta-one', role: 'TA'` trong body vẫn bị từ chối `401`/`403` |
| Kiểm tra role `TA` và ownership `lab–class` qua `PublishStore` T02 | `authorizePublishAccess` kiểm tra `role === 'TA'`, `store.getLab(labId)` và `store.isTaAssignedToClass(principal.id, lab.classId)`; `student`/`admin` trả `403`, `ta-other` thuộc `class-2` gọi `lab-1` (`class-1`) bị từ chối `403` |
| Chuẩn hóa lỗi RFC 9457 (`application/problem+json; charset=utf-8`), không lộ stack/path/secret | Test kiểm tra đầy đủ `401 unauthenticated` (kèm header `WWW-Authenticate: Bearer` theo RFC 9110), `403 forbidden`, `404 not-found`, `400 invalid-json`, `400 validation` (`errors[]`), `409 before-deadline`, `409 pending-reviews`, `413 payload-too-large`, `415 unsupported-media-type`, và `500 internal` (ẩn hoàn toàn đường dẫn nội bộ và secrets giả lập) |
| Bắt lỗi parser/framework qua HTTP boundary thực | `registerPublishErrorHandling` sử dụng parser mặc định (`secure-json-parse`) chặn đứng payload độc hại Prototype Pollution (`{"__proto__":...}`); ánh xạ lỗi framework `413` (body too large), `415` (unsupported media type) và `400` (schema validation) sang RFC 9457 mà không bị biến thành 500 |
| Test-header identity injection tắt mặc định | `createTestHeaderIdentityResolver()` mặc định `allowTestHeader: false`, từ chối mọi header `x-test-user-id` / `x-test-role`; chỉ hoạt động khi test bật tường minh `{ allowTestHeader: true }` |

## 3. Lệnh kiểm chứng tái lập

Chạy trực tiếp từ thư mục gốc repository (với Node 24.22.1 / npm 11.19.1 do NVM tự chọn qua `.node-version`):

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test tests/auth/publish-auth-errors.test.mjs tests/data/publish-store.test.mjs tests/smoke/app.test.mjs
git diff --check
```

Kết quả quan sát thực tế:
- `node -v`: `v24.22.1`
- `npm -v`: `11.19.1`
- `npm run build`: Exit code `0`.
- `node --test tests/auth/publish-auth-errors.test.mjs tests/data/publish-store.test.mjs tests/smoke/app.test.mjs`: Tổng **65 tests** (18 auth/errors tests + 40 data tests + 7 smoke tests), **65 pass, 0 fail, 0 skipped**.
- `git diff --check`: Exit code `0`.

## 4. Bàn giao và giới hạn

- **Bàn giao cho T08 (Phúc) và Reviewer T03 (Vượng):**
  - Exports tại [src/auth/index.ts](../../../../src/auth/index.ts), tài liệu tại [docs/architecture/auth-and-errors.md](../../../architecture/auth-and-errors.md), bộ test tại [tests/auth/publish-auth-errors.test.mjs](../../../../tests/auth/publish-auth-errors.test.mjs).
  - T03 không sửa `package.json`, `package-lock.json`, `src/app.ts`, `src/server.ts` hoặc `src/data/*`.
- **Điều kiện còn chờ:**
  - Chờ review độc lập từ Vượng (`@vinny2707`) và tích hợp vào `develop`.
  - Kết quả này kiểm chứng ranh giới auth/errors của T03 kết hợp với store T02 và app factory T01, chưa phải hoàn thành endpoint publish T08 hay CI gate T09/T10.

Xem thêm [Đầu vào AI-log](AI-LOG.md) để tổng hợp vào `AI-LOG.md` ở root trong T11.
