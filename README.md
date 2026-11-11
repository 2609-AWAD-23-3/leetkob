# LeeTKOB — PA02

Backend cho checkpoint harness và quality gate: **POST /labs/{labId}/publish** có contract, implementation và tests. T06/T07 (submissions/review-queue) deferred, không phải Done. Chưa có LLM pipeline, judge sandbox, UI hoặc public deployment.

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
- Tests: build rồi discovery `tests/**/*.test.{mjs,js,ts}`; build/assertion lỗi hoặc không có test đều trả nonzero. Baseline có 83 tests: 40 data, 18 auth, 16 contract, 7 smoke, 2 lifecycle.

## Chạy ứng dụng

```sh
npm run build
npm start
```

Mặc định `http://127.0.0.1:3000/health` trả `{"status":"ok"}`. `npm run dev` dùng watch; Ctrl+C để dừng. Runtime chỉ đọc HOST/PORT, không tự load .env. [.env.example](.env.example) cố ý để trống; không export giá trị rỗng. Defaults là 127.0.0.1 và 3000.

**npm start chỉ chạy skeleton, chưa mount publish nếu không có store.** Để kiểm chứng endpoint, chạy `npm test`. Để thử HTTP với fixtures, sau build lưu block sau thành file `.mjs` tạm ở root, chạy `node <file>.mjs` (dừng server skeleton trước):

```js
import { createPublishApp } from './dist/modules/publish/index.js';
import {
  createInMemoryPublishStore,
  createPublishSeed,
  createFixedClock,
  FIXTURE_AFTER_DEADLINE,
} from './dist/data/index.js';
import {
  createTokenIdentityResolver,
  createPublishFixtureTokens,
} from './dist/auth/index.js';

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

Store in-memory, reset khi restart; atomicity/repeat safety trong một process/thread, không cam kết phân tán. Summary thống kê quyết định TA, không phải pipeline tính điểm. Chưa có persistence, production identity provisioning hoặc runtime wiring publish mặc định.
