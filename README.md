# LeeTKOB

Backend chấm bài C++ có kiểm tra constraint bằng LLM. Từ PA03 toàn bộ pipeline chạy trên deployment public `https://app.flytest.io.vn`: TA tạo lab có constraints, student nộp bài, bài vào queue Postgres, worker riêng compile và chạy trong sandbox Docker, bài Accepted qua hard rules rồi model, verdict kèm evidence chỉ vào review queue của TA; Publish bị chặn khi còn verdict chưa review. Hồ sơ nộp PA03: [PA3.md](PA3.md). Xem [cấu trúc project](docs/architecture/project-structure.md) cho entry point (API, worker, checker) và ranh giới module.

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

Bản nộp PA03 được đánh dấu bằng tag `pa3` (PA02: `pa2`); checkout tag trước khi cài/chạy. PowerShell có thể cần `npm.cmd`.

Local và [CI](.github/workflows/ci.yml) dùng cùng bốn commands; `quality-gate` là required check trên `main`. `npm test` không cần network, Docker hay Postgres; các suite cần hạ tầng chạy bằng lệnh riêng và trong CI: `npm run test:db` (cần `TEST_DATABASE_URL`, job `postgres-store`) và `npm run test:sandbox` (cần Docker, job `sandbox-attacks` với 9 bài tấn công trong `sandbox/attacks/`).

- Lint: Oxlint trên src/tests/scripts.
- Format: Prettier chỉ kiểm tra; [.prettierignore](.prettierignore) loại docs, .github, CONTRIBUTING, dependencies và build output. Báo cáo root mới vẫn được kiểm tra.
- Type-check: TypeScript strict/noEmit cho source và tests TypeScript.
- Tests: build rồi discovery `tests/**/*.test.{mjs,js,ts}`; build/assertion lỗi hoặc không có test đều trả nonzero. Tại `develop` `b237d1d`: 570 tests, 567 pass, 3 skip (ba suite Postgres tự bỏ qua khi không có `TEST_DATABASE_URL`).

## Chạy ứng dụng

```sh
npm run build
# First time: copy .env.example to .env (PowerShell: Copy-Item .env.example .env).
npm start
```

Mặc định `http://127.0.0.1:3000/health` trả `{"status":"ok"}`. `npm run dev` dùng watch; Ctrl+C để dừng. Các lệnh `npm run dev`, `npm start`, `npm run db:migrate` và `npm run db:seed` đọc `.env` tại root bằng Node CLI. Copy [.env.example](.env.example) thành `.env` lần đầu, chỉnh cấu hình local nếu cần; `.env` bị Git ignore. Biến đã đặt trong terminal/deployment được ưu tiên hơn file. Sửa `.env` thì khởi động lại backend. Unit/contract tests không tự đọc `.env`; `test:db` vẫn yêu cầu `TEST_DATABASE_URL` riêng.

`npm start` chạy `dist/api/server.js`. Sau build, `npm run worker` chạy entry point worker; checker xem mục dưới.

## Checker và eval (PA03-T10)

Một lệnh nhận thư mục dataset (layout của dev set) và ghi file prediction JSONL cho `eval.mjs`. Checker chỉ đọc `problems/*/statement.md`, `problems/*/constraints.json` và `solutions/*/*.cpp`; không đọc `labels.jsonl` hay `tests/`.

Linux/macOS (bash, sh, zsh) — prediction ra stdout, log ra stderr, không cần mount thư mục output:

```sh
docker build -f docker/checker.Dockerfile -t leetkob-checker .
docker run --rm --network none -e MODEL_OFF=1 -v "$PWD/leetkob-eval:/data:ro" leetkob-checker /data > predictions.jsonl
node leetkob-eval/eval.mjs --data leetkob-eval --predictions predictions.jsonl
```

Windows PowerShell: **không dùng `>`** (PowerShell ghi file kèm BOM/UTF-16, `eval.mjs` báo dòng 1 không phải JSON và exit 2); mount thư mục output và dùng `--out`:

```powershell
docker run --rm --network none -e MODEL_OFF=1 -v "${PWD}\leetkob-eval:/data:ro" -v "${PWD}\out:/out" leetkob-checker /data --out /out/predictions.jsonl
```

Cách mount `-v "$PWD/out:/out" ... --out /out/predictions.jsonl` cũng dùng được trên Linux: image chạy checker bằng root trong container nên ghi được cả khi Docker tự tạo `out/` thuộc root; checker chỉ đọc text, không chạy code sinh viên. Cách stdout không ghi file nào trong container nên chạy được với mọi `--user`, `--cap-drop ALL`, `--read-only`. `npm run test:checker-image` (cần Docker) build image rồi chạy cả hai cách trong các cấu hình đó và kiểm mọi cách cho cùng một file, `eval.mjs` exit 0 hoặc 1. Không dùng Docker: `npm run build`, rồi `MODEL_OFF=1 npm run checker -- leetkob-eval --out out/predictions.jsonl` (PowerShell: `$env:MODEL_OFF='1'; npm.cmd run checker -- leetkob-eval --out out/predictions.jsonl`). Tuỳ chọn `--call-log <file>` ghi quyết định cho từng cặp và mọi model call (request id, model, token, thời gian, chi phí, prompt đã gửi); `--concurrency <n>` (1–32, mặc định 4) chỉ có tác dụng khi bật model.

- `MODEL_OFF=1`: chỉ chạy hard rules; constraint semantic ghi `unsure` (call log ghi `unsureCause: "model_off"`); không tạo model client, không đọc `MODEL_API_KEY`, không mở network.
- Không đặt `MODEL_OFF`: cần `MODEL_API_KEY`, truyền lúc chạy (`docker run --env-file marking.env ...` cho lần chạy held-out, hoặc `-e MODEL_API_KEY` với biến đã đặt trong shell); không ghi key vào image hay file trong repo. Thiếu key thì lệnh dừng với exit 2. Lỗi provider ở một bài chỉ làm bài đó thành `unsure` và được ghi vào call log; lần chạy vẫn ra file đầy đủ.
- Exit code của checker: 0 khi đã ghi prediction; 2 khi sai tham số, cấu hình hoặc dataset. Prediction chỉ được ghi một lần sau khi chấm xong, lần chạy lỗi không ghi gì ra stdout.

### Lần chạy held-out (PA04)

Người chấm chạy checker image trên held-out set một lần, trong container không có network ngoài một proxy. Checker cần đúng **một model host**:

- **Model host:** `api.anthropic.com`, cổng `443` (HTTPS). Proxy chỉ cần cho phép host này; checker không gọi host nào khác.
- **Key:** file `marking.env` đính kèm cạnh file zip trên Classroom (không nằm trong zip hay Git), chỉ gồm `MODEL_API_KEY=…` (key tạo riêng cho lần chạy này) và `MODEL_TIMEOUT_MS=30000`.
- **Proxy:** truyền bằng `HTTPS_PROXY`. Image đã đặt sẵn `NODE_USE_ENV_PROXY=1`, nên `fetch` của Node trong checker đi qua proxy mà không cần cấu hình thêm.

Linux/macOS (prediction ra stdout):

```sh
docker build -f docker/checker.Dockerfile -t leetkob-checker .
docker run --rm --env-file marking.env -e HTTPS_PROXY=http://<proxy>:<port> \
  -v "$PWD/<held-out>:/data:ro" leetkob-checker /data > predictions.jsonl
```

Windows PowerShell (mount thư mục output, không dùng `>`):

```powershell
docker run --rm --env-file marking.env -e HTTPS_PROXY=http://<proxy>:<port> -v "${PWD}\<held-out>:/data:ro" -v "${PWD}\out:/out" leetkob-checker /data --out /out/predictions.jsonl
```

Không có `marking.env` dùng được thì chạy với model tắt như lệnh `MODEL_OFF=1` ở trên: chỉ hard rules quyết constraint ban-list, mọi constraint semantic là `unsure`.

`--env-file` ở đây chỉ đưa key vào container **checker**: checker đọc text, không compile hay chạy code sinh viên. Quy tắc trong `AGENTS.md` cấm `--env-file` và `-e MODEL_API_KEY` áp cho container **sandbox** chạy code sinh viên; sandbox không bao giờ nhận key.

Kiểm thử cùng điều kiện (cần Docker và key trong `.env`, gọi model thật): `npm run test:held-out-proxy` build image, chạy checker trong một mạng Docker `--internal` chỉ ra ngoài qua proxy thử (`scripts/held-out-proxy.mjs`, chỉ cho `api.anthropic.com:443`), rồi chấm bằng `eval.mjs`. Thử đúng file sẽ nộp: `npm run test:held-out-proxy -- --env-file marking.env`. Evidence: [T08](docs/evidence/PA04/T08/README.md).

**Khi nén repo để nộp:** không nén nguyên thư mục làm việc, vì `.env` (key dev) và `marking.env` có thể nằm ở thư mục gốc; `.gitignore` chỉ ngăn chúng vào Git, không ngăn vào file zip. Nén từ một bản clone sạch ở tag `pa4` (chỉ có file được Git theo dõi và `.git`), rồi kiểm nội dung trước khi nộp. Chạy các lệnh dưới **ở một thư mục ngoài repo** (ví dụ thư mục cha); chạy ngay trong repo sẽ tạo thư mục lồng `leetkob/leetkob`. Tag `pa4` do T10 tạo trước khi nộp. PowerShell, dùng `tar.exe` của Windows (`tar` trong Git Bash là GNU tar, tạo file tar chứ không phải zip):

```powershell
git clone --branch pa4 https://github.com/2609-AWAD-23-3/leetkob.git leetkob
tar.exe -a -c -f <StudentID1>-<StudentID2>-<StudentID3>_<total>.zip leetkob
tar.exe -tf <StudentID1>-<StudentID2>-<StudentID3>_<total>.zip | Select-String '(^|/)(\.env|marking\.env)$'
tar.exe -tf <StudentID1>-<StudentID2>-<StudentID3>_<total>.zip | Select-String '^leetkob/\.git/HEAD$'
```

Lệnh thứ ba phải không in gì (không có key trong zip); lệnh thứ tư phải in một dòng (zip có `.git`).

`leetkob-eval/` là dev set nguyên byte từ commit `552c811` (`npm test` so SHA-256 từng file). Case riêng của nhóm ở `eval-cases/` cùng layout; chấm bằng `node leetkob-eval/eval.mjs --data eval-cases --predictions <file>`. Kiểm mọi case là Accepted trong sandbox (cần Docker): `npm run build && node scripts/verify-eval-cases.mjs eval-cases`. Kết quả chạy và dev run: [evidence T10](docs/evidence/PA03/T10/README.md).

Test auth và lab trực tiếp tại [Swagger UI](http://127.0.0.1:3000/docs/) sau khi bật API. Dùng **Try it out** để login, copy `accessToken` vào **Authorize** (không thêm `Bearer`), rồi gọi `/auth/me` hoặc logout. Tài khoản seed dev dùng chung password công khai `password123`; danh sách ở `src/db/seeds/demo-accounts.ts`. OpenAPI JSON tại `/docs/json`; thay cổng nếu PORT đã cấu hình khác.

TA `ta01` tạo lab bằng POST `/classes/demo-class-1/labs`: nhập JSON hoặc chọn multipart để upload bộ test/constraint JSON. Bắt buộc `Idempotency-Key` UUID v4; giữ key cho retry, key mới cho ý định tạo mới. Cùng key/payload trong 24 giờ trả cùng lab. Student chỉ xem lab lớp mình đã mở, không thấy bộ test. Xem [contract lab](docs/contract/labs.md), [mẫu JSON](docs/examples/labs/tests.json) và [quy trình test Swagger từng bước](docs/evidence/PA03/T04/README.md#phase-2). Không cần seed lại để dùng API mới; runtime tự chạy migration 0004 trước khi listen.

Student nộp qua POST `/labs/{labId}/submissions` bằng JSON code hoặc một file `.cpp` tối đa 64 KiB; cần key UUID v4 mới cho mỗi lần nộp, giữ key khi retry. GET `/labs/{labId}/submissions/mine` xem lịch sử của mình; TA cùng lớp dùng GET `/labs/{labId}/submissions` với studentId/status/limit/cursor. GET `/submissions/{id}` xem code, trạng thái và kết quả chấm test. Bài mới và job được lưu atomic ở trạng thái queued; `npm run worker` claim job, chấm trong sandbox rồi chạy hard rules và model ([evidence T11](docs/evidence/PA03/T11/README.md)). TA xem verdict ở review queue và Publish: [contract review queue](docs/contract/review-queue.md). Xem [contract submissions](docs/contract/submissions.md), [file C++ mẫu](docs/examples/submissions/sum.cpp) và [runbook phase 3](docs/evidence/PA03/T04/README.md#phase-3).

Xem/sửa dữ liệu bằng **Prisma Studio**: bật PostgreSQL Docker, bảo đảm `.env` có DATABASE_URL rồi chạy `npm.cmd run db:studio` ở terminal riêng. Mở [Studio](http://localhost:5555), chọn bảng `users`, `classes` hoặc `class_memberships`. Backend không cần chạy. Studio đọc schema PostgreSQL trực tiếp qua cấu hình `scripts/prisma-studio.config.ts`; không dùng Prisma Client hoặc chuyển quyền quản lý migration sang Prisma. Thay đổi trong Studio ghi trực tiếp vào database dev. `Ctrl+C` tại terminal Studio để dừng. Có thể dùng cổng khác bằng `npm.cmd run db:studio -- --port 5556` nếu cổng mặc định đã được sử dụng.

`npm start` mount auth, labs, submissions, review queue và Publish với PostgreSQL. Xem [contract auth](docs/contract/auth.md) và [hướng dẫn seed 113 tài khoản](docs/evidence/PA03/T04/README.md). Demo Publish PA02 với fixtures in-memory vẫn chạy được: sau build lưu block sau thành file `.mjs` tạm ở root, chạy `node <file>.mjs`:

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

[AGENTS.md](AGENTS.md) là rules file; [permissions](docs/security/permissions.md) chia allowed / ask first / never. Không secrets trong sandbox/prompt/log, không model thật trong unit tests, không sửa tests/eval/labels chỉ để xanh. Sandbox: 9 minimums của brief, mỗi minimum một bài tấn công ([evidence T05](docs/evidence/PA03/T05/README.md)).

### Model và chi phí

Model: `claude-haiku-5-5` (Anthropic Claude API, gọi trực tiếp; [ADR 0001](docs/architecture/decisions/0001-host-model-and-spending-cap.md)). Giá $0.10 / 1M token input, $0.50 / 1M token output. Mỗi bài nộp Accepted có ít nhất một constraint semantic mà hard rules chưa quyết thì gọi model **một lần** cho mọi constraint semantic đó; bài không Accepted hoặc chỉ có constraint ban-list thì không gọi. Output qua schema check và timeout; sai schema hoặc timeout thành `unsure`. Spending cap: workspace $5/tháng, Auto-reload tắt ([evidence T02](docs/evidence/PA03/T02/README.md)).

Chi phí một lab 80 bài nộp, tính từ dev run thật ([evidence T10](docs/evidence/PA03/T10/README.md#6-dev-run-model-thật-23112026)):

- Dev run: 39 call, 64 725 token input và 5 369 token output, tổng $0.009157 (cộng `costUsd` từng call trong `call-log.jsonl`).
- Trung bình một call: $0.009157 / 39 ≈ $0.000235 (≈ 1 660 token input, 138 token output).
- Lab 80 bài, giả định cả 80 bài đều Accepted và đều gọi model một lần: 80 × $0.000235 ≈ **$0.019**.
- Độ nhạy: bài dài gấp đôi (≈ 3 300 input, 280 output mỗi call) thì 80 × (3 300 × 0.10 + 280 × 0.50) / 1e6 ≈ $0.038; mỗi job retry thêm một lần thì nhân tối đa 2. Lượt đo riêng của T08 (2 call, $0.0154/lab) cùng bậc độ lớn ([evidence T08](docs/evidence/PA03/T08/README.md#9-phép-tính-chi-phí-một-lab-80-bài)).

Call bị timeout được ghi chi phí 0 trong call log dù provider có thể vẫn tính tiền; cost cap theo lab thuộc PA04.

## Hồ sơ và giới hạn

- [PA3.md](PA3.md): URL deployment, tài khoản test, CI run của tag `pa3`, lệnh checker, dev run, video.
- [SELF_ASSESSMENT_REPORT.md](SELF_ASSESSMENT_REPORT.md): tám tiêu chí PA03, điểm tự chấm, evidence và phần chưa làm.
- [AI-LOG.md](AI-LOG.md): AI assistance PA03 theo task, hợp nhất từ `docs/evidence/PA03/T*/AI-LOG.md`.
- [Plan PA03](docs/plans/PA03.md), [requirement](docs/reference/PA03/requirement.md), [rubric gốc](docs/reference/PA03/PA%233%20rubric%20%E2%80%94%20Prototype%20with%20the%20LLM%20feature%20running.pdf).
- Hồ sơ PA02 ([PA2.md](PA2.md); AI-LOG và tự chấm PA02 xem tại tag `pa2`).

Sản phẩm PA03 chưa có frontend; mọi thao tác qua API/Swagger. Chưa có ngưỡng eval, đủ 5 guardrails, cost cap theo lab, lấy mẫu 10% `pass` (PA04), publishing hoàn chỉnh cho student và appeals (PA05).
