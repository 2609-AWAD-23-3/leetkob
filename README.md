# LeeTKOB

Nền backend từ PA02: **POST /labs/{labId}/publish** có contract, implementation và tests. T06/T07 (submissions/review-queue) deferred, không phải Done. PA03-T00 sắp xếp lại mã và test để chuẩn bị cho các task tiếp theo. Xem [cấu trúc project](docs/architecture/project-structure.md) cho entry point, ranh giới và phần dự kiến theo từng mốc.

## Cài đặt và checks

Yêu cầu Node.js **24.x >= 24.22.1**, npm **11.x**, Git. Chạy từ root:

```sh
git clone https://github.com/2609-AWAD-23-3/leetkob.git
cd leetkob
npm ci --ignore-scripts
npm run lint
npm run format-check
npm run type-check
npm test
```

Bản nộp được đánh dấu bằng tag `pa2`; checkout tag trước khi cài/chạy. PowerShell có thể cần `npm.cmd`.

Local và [CI](.github/workflows/ci.yml) dùng cùng bốn commands; `quality-gate` là required check trên `main`.

- Lint: Oxlint trên src/tests/scripts.
- Format: Prettier chỉ kiểm tra; [.prettierignore](.prettierignore) loại docs, .github, CONTRIBUTING, dependencies và build output. Báo cáo root mới vẫn được kiểm tra.
- Type-check: TypeScript strict/noEmit cho source và tests TypeScript.
- Tests: build rồi discovery `tests/**/*.test.{mjs,js,ts}`; build/assertion lỗi hoặc không có test đều trả nonzero. Baseline có 83 tests: 40 store (unit), 16 contract và 27 integration (18 auth/error, 7 app, 2 lifecycle).

## Chạy ứng dụng

```sh
npm run build
# First time: copy .env.example to .env (PowerShell: Copy-Item .env.example .env).
npm start
```

Mặc định `http://127.0.0.1:3000/health` trả `{"status":"ok"}`. `npm run dev` dùng watch; Ctrl+C để dừng. Các lệnh `npm run dev`, `npm start`, `npm run db:migrate` và `npm run db:seed` đọc `.env` tại root bằng Node CLI. Copy [.env.example](.env.example) thành `.env` lần đầu, chỉnh cấu hình local nếu cần; `.env` bị Git ignore. Biến đã đặt trong terminal/deployment được ưu tiên hơn file. Sửa `.env` thì khởi động lại backend. Unit/contract tests không tự đọc `.env`; `test:db` vẫn yêu cầu `TEST_DATABASE_URL` riêng.

`npm start` chạy `dist/api/server.js`. Sau build, `npm run worker` và `npm run checker` chạy entry point riêng và thoát ngay; chức năng chấm và checker sẽ được bổ sung ở PA03-T06/T10.

Test auth và lab trực tiếp tại [Swagger UI](http://127.0.0.1:3000/docs/) sau khi bật API. Dùng **Try it out** để login, copy `accessToken` vào **Authorize** (không thêm `Bearer`), rồi gọi `/auth/me` hoặc logout. Tài khoản seed dev dùng chung password công khai `password123`; danh sách ở `src/db/seeds/demo-accounts.ts`. OpenAPI JSON tại `/docs/json`; thay cổng nếu PORT đã cấu hình khác.

TA `ta01` tạo lab bằng POST `/classes/demo-class-1/labs`: nhập JSON hoặc chọn multipart để upload bộ test/constraint JSON. Bắt buộc `Idempotency-Key` UUID v4; giữ key cho retry, key mới cho ý định tạo mới. Cùng key/payload trong 24 giờ trả cùng lab. Student chỉ xem lab lớp mình đã mở, không thấy bộ test. Xem [contract lab](docs/contract/labs.md), [mẫu JSON](docs/examples/labs/tests.json) và [quy trình test Swagger từng bước](docs/evidence/PA03/T04/README.md#phase-2). Không cần seed lại để dùng API mới; runtime tự chạy migration 0004 trước khi listen.

Phase 3: student nộp qua POST `/labs/{labId}/submissions` bằng JSON code hoặc một file `.cpp` tối đa 64 KiB; cần key UUID v4 mới cho mỗi lần nộp, giữ key khi retry. GET `/labs/{labId}/submissions/mine` xem lịch sử của mình; TA cùng lớp dùng GET `/labs/{labId}/submissions` với studentId/status/limit/cursor. GET `/submissions/{id}` xem code và trạng thái. Runtime tự áp dụng thêm migration 0005. Bài mới và job được lưu atomic, trạng thái queued; phase này chưa chạy worker/chấm bài. Xem [contract submissions](docs/contract/submissions.md), [file C++ mẫu](docs/examples/submissions/sum.cpp) và [runbook phase 3](docs/evidence/PA03/T04/README.md#phase-3).

Xem/sửa dữ liệu bằng **Prisma Studio**: bật PostgreSQL Docker, bảo đảm `.env` có DATABASE_URL rồi chạy `npm.cmd run db:studio` ở terminal riêng. Mở [Studio](http://localhost:5555), chọn bảng `users`, `classes` hoặc `class_memberships`. Backend không cần chạy. Studio đọc schema PostgreSQL trực tiếp qua cấu hình `scripts/prisma-studio.config.ts`; không dùng Prisma Client hoặc chuyển quyền quản lý migration sang Prisma. Thay đổi trong Studio ghi trực tiếp vào database dev. `Ctrl+C` tại terminal Studio để dừng. Có thể dùng cổng khác bằng `npm.cmd run db:studio -- --port 5556` nếu cổng mặc định đã được sử dụng.

**npm start mount auth, labs và submissions với PostgreSQL; Publish vẫn chưa được nối runtime (T09).** Xem [contract auth](docs/contract/auth.md) và [hướng dẫn seed 113 tài khoản](docs/evidence/PA03/T04/README.md). Để kiểm chứng endpoint, chạy `npm test`. Để thử Publish HTTP với fixtures, sau build lưu block sau thành file `.mjs` tạm ở root, chạy `node <file>.mjs`:

```js
import { createPublishApp } from './dist/api/modules/publish/index.js';
import {
  createInMemoryPublishStore,
  createPublishSeed,
  createFixedClock,
  FIXTURE_AFTER_DEADLINE,
} from './dist/db/index.js';
import {
  createTokenIdentityResolver,
  createPublishFixtureTokens,
} from './dist/api/auth/index.js';

const { store } = createInMemoryPublishStore({
  initialState: createPublishSeed('resolved'),
  clock: createFixedClock(FIXTURE_AFTER_DEADLINE),
});
const app = createPublishApp({
  store,
  identityResolver: createTokenIdentityResolver({
    tokens: createPublishFixtureTokens(),
  }),
});
await app.listen({ host: '127.0.0.1', port: 3000 });
```

Trong terminal khác (PowerShell dùng `curl.exe`):

```sh
curl -X POST http://127.0.0.1:3000/labs/lab-1/publish -H "Authorization: Bearer token-ta-one" -H "Content-Type: application/json"
```

Fixture token là dữ liệu test công khai, không phải credential production. Lượt đầu trả 200 LabPublication; gọi lại giữ nguyên metadata, thêm `Idempotent-Replayed: true`. Không dùng demo làm cấu hình production. Xem [contract](docs/contract/publish.md) cho role TA/ownership, RFC 9457 errors, deadline/pending gate và versioning.

## Security, model và chi phí

[AGENTS.md](AGENTS.md) là rules file; [permissions](docs/security/permissions.md) chia allowed / ask first / never. Không secrets trong sandbox/prompt/log, không model thật trong unit tests, không sửa tests/eval/labels chỉ để xanh. [Scan T05](docs/evidence/PA02/T05/security-scan.md) ghi phạm vi history/refs/config và triage digest false positives. Kết quả scan áp dụng cho snapshot được ghi trong hồ sơ.

PA02 chưa tích hợp model/provider, không cần API key để chạy. **Chưa có bằng chứng spending cap; không nhận đã đáp ứng phần cap của rubric.** [Model/cost T05](docs/evidence/PA02/T05/model-cost.md) chỉ là estimate tham chiếu: 80 bài, 3 constraints, 20% retry khoảng **1,73 USD/lab**; kịch bản 5 constraints/input-output lớn hơn khoảng **5,76 USD/lab**. Provider/model tham chiếu chưa phải lựa chọn triển khai; chưa có measured cost/lab. Không có model calls trong tests. Theo brief, LLM tương lai chỉ nhận đề, constraints và code đã bỏ tên/StudentID; luồng gửi này chưa triển khai.

## Hồ sơ và giới hạn

- [PA2.md](PA2.md): repository/protection, PR đỏ/fix xanh, deliberate break, tag-run.
- [AI-LOG.md](AI-LOG.md): AI assistance theo task, không phải transcript.
- [SELF_ASSESSMENT_REPORT.md](SELF_ASSESSMENT_REPORT.md): bảy tiêu chí, điểm tự chấm và phần chưa hoàn thành.
- [Evidence T11](docs/evidence/PA02/T11/README.md): nguồn tham chiếu và kết quả kiểm chứng.
- [Plan PA02](docs/plans/PA02.md), [requirement](docs/reference/PA02/requirement.md), [rubric gốc](docs/reference/PA02/PA%232%20rubric%20%E2%80%94%20Harness%20and%20quality%20gate.pdf).

Publish demo PA02 dùng Store in-memory, reset khi restart; runtime auth PA03 dùng PostgreSQL. Summary thống kê quyết định TA, không phải pipeline tính điểm. Chưa có API admin provisioning hoặc runtime wiring Publish mặc định; auth đã có persistence và đăng ký student.
