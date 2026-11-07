# LeeTKOB architecture baseline

**Trạng thái 08/11/2026:** skeleton tại `738b183a` đã được @BHVPhuc review trên [PR #14](https://github.com/2609-AWAD-23-3/leetkob/pull/14). Người yêu cầu đã chốt publish-only ngày 07/11 và xác nhận đã kiểm tra/duyệt phần conflict trong hội thoại; không suy ra independent approval cho bản tài liệu mới này hoặc cho một resolution commit chưa tồn tại. Bổ sung wiring bên dưới là candidate local chờ review và đầu vào T02, chưa phải implementation hay acceptance T01.

Executor: @tranquocvy. Source: [class brief](../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief.pdf), sections 3-5 and 7; [PA02 requirements](../reference/PA02/requirement.md); [task T01](../plans/PA02.md#t01--architecture-baseline-v%C3%A0-skeleton).

## Scope and stack

Use one modular backend, Node.js 24 LTS (baseline 24.22.1), npm 11, TypeScript strict mode with ESM, and Fastify 5. The exact dependency versions and transitive tree are recorded in package.json and package-lock.json. The root is the existing leetkob repository, not the legacy PA02 directory. Do not recreate the repository.

Fastify provides maintained HTTP routing, plugin encapsulation, lifecycle hooks and real HTTP-boundary injection. A custom HTTP framework would duplicate these capabilities. Express is adequate but would need additional conventions for the same plugin/testing boundaries. A multi-service/multi-language scaffold adds deployment, identity and storage coordination without helping PA02. No dependency on a paid service, model provider, database server or container runtime is needed to start this baseline.

This stack is a reviewable implementation choice, not a requirement imposed by the brief. TypeScript emits JavaScript into dist; the server never relies on a global TypeScript/tsx installation. The development watcher is not the production startup command.

## Runtime and file boundaries

~~~text
src/
  app.ts                       createApp; composition and module registration (T01/B)
  config.ts                    explicit HOST/PORT parsing (T01/B)
  server.ts                    executable listener and shutdown (T01/B)
  modules/
    submissions/index.ts       no-op plugin now; contract/source/tests owned by T06/A
    review-queue/index.ts      no-op plugin now; contract/source/tests owned by T07/B
    publish/index.ts           no-op plugin now; contract/source/tests owned by T08/C
tests/smoke/app.test.mjs        narrow T01 acceptance checks, not the T04 quality harness
~~~

The package manifest, lockfile, app composition and setup README have one writer, B, until the explicit T11 README handoff to A. Data/store/shared data fixtures belong to T02/A. Auth/error helpers and shared authorization/error tests belong to T03/C. Do not introduce a competing store/auth schema in a feature module. Source directories for those future artifacts are created when their owners implement them, not populated with pretend production services here.

## Application and listener lifecycle

1. Import createApp from src/app.ts (or dist/app.js after build). Construction does not read environment variables, bind ports, connect to services or launch workers.
2. Each call creates a separate Fastify instance and registers submissions, reviewQueue and publish plugins, in that stable order. Default plugins deliberately register no business routes.
3. app.ready() boots plugins; app.inject() exercises actual routing/serialization without listening. Call app.close() in teardown to release resources. Test fixtures must be per instance and must not depend on another member's endpoint or test order.
4. Only server.ts reads validated HOST/PORT and calls app.listen(). It defaults to 127.0.0.1:3000. The server entry point handles SIGINT/SIGTERM by calling app.close(); normal Windows terminal Ctrl+C maps to the SIGINT handler, while forced process termination is not proof of graceful shutdown.
5. A listener failure exits nonzero after closing the app. The narrow /health route reports process liveness only; it is not readiness, database health, security acceptance or pipeline completion.

The current smoke suite also starts an ephemeral loopback listener and verifies close. It does not prove every OS signal path or production deployment behavior.

## Module extension interface

Each module exports a FastifyPluginAsync named submissionsModule, reviewQueueModule or publishModule. Add the owned routes inside that plugin; default registration adds no URL prefix, so module contracts retain their documented /labs/... paths. Do not wrap these feature plugins with fastify-plugin merely to escape encapsulation.

For a temporary integration probe, createApp({ modules: { publish: async (scope) => { scope.get('/probe', async () => ({ ok: true })); } } }) replaces only that plugin. This is an in-process composition seam, never a request/body/header option. Call inject('/probe') and close the returned app. The smoke suite exercises the same interface for all three modules. Production module tests should use their real module, not replace the handler under test with a fake response.

Fastify decorators/hooks are encapsulated: a decorator inside one ordinary plugin is not automatically visible to siblings. Before T02/T03 consumers implement business routes, agree the real data/auth interfaces and compose shared services at the correct ancestor scope or pass typed plugin options explicitly. T01 intentionally does not freeze entity schemas or invent an authentication mechanism on behalf of those owners. Any resulting app.ts or manifest change is integrated by B after the owning package supplies its requirements. Review the wiring before parallel endpoint implementation is accepted.

## Shared business and security invariants

- The conceptual relationships are user -> class -> lab, with submissions, reviews and publication state. [T02 data-model document](data-model.md) remains the authoritative place to decide concrete IDs, storage/reset APIs, persistence and concurrency guarantees. No global mutable store exists in this baseline.
- T03 must establish a trusted identity boundary, role plus class/lab ownership checks and RFC 9457 conventions. Client-provided role/userId is never an authentication strategy. No development header bypass is introduced here.
- Only /health is implemented. The three business routes return Fastify's default 404 until their owners implement them; current default errors are not claimed to be the final RFC 9457 model. No business route is exposed before its contract and authorization boundary are ready.
- T04 owns the comprehensive test lifecycle, fixture/clock/seed rules and lint/format/typecheck/test commands. Build and narrow smoke checks here do not complete T04. T09 owns workflows/settings; no CI or protection is added by T01.
- No .env is automatically loaded. HOST/PORT are the only environment inputs consumed by server.ts; defaults are local development choices, not business contract limits. T05 owns the full env example, permissions, rules, secret-history audit and cost-cap records.

## Product flow and deferred components

The eventual flow is TA lab/constraints -> student submission -> queued sandbox judging -> Accepted -> hard rules -> semantic-only model review -> schema/evidence guards -> TA review queue -> TA publish -> appeals. The model never sets deductions; the TA defines them. Hard-rule decisions avoid unnecessary model calls, and violation/unsure plus a sampled 10% of pass go through human review.

PA02 may use deterministic in-process fixtures to exercise endpoint contracts. That is not evidence that judging, queueing, model review or the final pipeline works. No C++ is executed and no provider key is consumed in this skeleton. Later sandbox work must satisfy no-network, resource limits, non-root, no host mounts/Docker socket and no secrets, with attack-test evidence; do not substitute an unrestricted local child process for a sandbox.

There is no frontend, database adapter, judge, job queue, sandbox, LLM/eval pipeline, appeal implementation or deployment in T01. Storage/queue/provider/deployment choices remain open until their checkpoint needs them. PA02 chỉ yêu cầu `POST /labs/{labId}/publish`; T06/T07 deferred, các plugin rỗng sẵn có không tạo thêm acceptance gates. Scope hiện hành nằm trên [PR #16](https://github.com/2609-AWAD-23-3/leetkob/pull/16), chưa được coi là đã tích hợp vào nhánh này.

See [architecture decisions](decisions/README.md) for the review status of consequential choices; no separate accepted ADR is fabricated for this proposal.

## Wiring publish tối thiểu cho PA02 — candidate local 08/11/2026

Phần này cụ thể hóa nền T01, không thay hợp đồng T08 hoặc tự triển khai T02/T03. Các phần product flow phía trên chỉ là bối cảnh sản phẩm; submissions, review-queue, judge, sandbox và model không phải dependencies để test publish.

### Runtime và lifecycle hiện có

| Giai đoạn | Hành vi thực tế tại `738b183a` | Chủ sở hữu |
| --- | --- | --- |
| Cài/build | `npm ci --ignore-scripts`; `npm run build` phát JS vào `dist` theo lockfile và TypeScript strict | T01/B; commands quality đầy đủ thuộc T04/B |
| Khởi tạo | `createApp()` tạo Fastify mới, `trustProxy: false`; chỉ đăng ký health và ba plugin; không tự listen hoặc đọc env | T01/B |
| Boot/test | `ready()` boot plugins; `inject()` đi qua HTTP boundary thật, không cần socket; tests luôn `close()` trong teardown | T01/B; harness T04/B |
| Chạy server | `server.ts` gọi `loadConfig()` rồi `listen()`; mặc định `127.0.0.1:3000`; không tự load `.env` | T01/B |
| Kết thúc | SIGINT/SIGTERM gọi `close()` có guard chống đóng lặp; onClose tháo signal listeners; listen thất bại đóng app rồi báo lỗi/nonzero | T01/B |

`loadConfig()` có thể đọc env khi được gọi không truyền tham số; factory không gọi nó. Smoke tests kiểm tra listener loopback/close và invalid config; không suy ra lần chạy mới hoặc mọi đường OS signal đều được kiểm chứng.

### Composition được đề xuất, chưa phải API đã implement

Giữ Fastify plugin có sẵn, không thêm framework/DI container. B tích hợp dependency bằng **typed plugin options được capture trong wrapper publish** sau khi A/C bàn giao interface. Auth hooks và handlers dùng cùng scope publish; shared not-found/error handling nếu cần áp dụng toàn app phải được C đăng ký ở ancestor scope thích hợp trước khi routes boot, không dựa vào decorator trong sibling plugin.

Luồng composition dự kiến:

```text
server.ts hoặc harness T04
  -> tạo store riêng cho app (T02), identity resolver/errors (T03)
  -> createApp() + wrapper đăng ký publish thật với dependencies (T01 tích hợp)
  -> ready / inject / listen
  -> close + cleanup tài nguyên thuộc app
```

`AppOptions` hiện chỉ có `logger` và `modules`; chưa có options store/auth/clock. Sơ đồ không phải hướng dẫn gọi một API đã tồn tại. Wrapper phải gọi/register module publish thật; contract tests không thay nó bằng handler trả response giả. Không thêm HTTP endpoint hoặc query/header để cấu hình dependencies.

| Dependency cần bàn giao | Trách nhiệm tối thiểu | Trạng thái / người chốt |
| --- | --- | --- |
| Lab/class lookup | Tra lab và class sở hữu, báo không tồn tại rõ ràng | T02/A; chưa có signature được xác nhận |
| Review/publication state | Đọc pending/resolved state và publication metadata/summary; transition publish giữ metadata khi retry và không nhân side effects | T02/A cùng T08/C chốt; chưa có implementation/guarantee concurrency |
| Seed/reset | Seed trực tiếp lab/reviews/publication cho từng app/test; reset không ảnh hưởng app khác | T02/A; T04/B sử dụng, không tạo store cạnh tranh |
| Identity resolver | Tạo principal từ nguồn tin cậy; kiểm tra TA và membership của `lab.classId`; không lấy quyền từ body/query | Đầu vào T03/C đã có ở Issue #3; credential/header cụ thể còn chờ chốt |
| Problem details | RFC 9457, `application/problem+json`, không lộ stack/path/secrets; bao gồm lỗi parser/framework mà contract công bố | T03/C; T08/C và reviewer A đối chiếu contract |
| Clock/cleanup | Nếu transition dùng timestamp, cung cấp clock xác định cho test; teardown đóng app, giải phóng/reset state do app sở hữu | Đề xuất handoff T02/T04/T08; chưa có API mới |

In-memory state đủ cho PA02 nếu owner ghi rõ mất state khi restart, phạm vi process và giới hạn concurrent requests. Không hứa transaction/distributed lock/persistence trước khi T02 có implementation/tests chứng minh. Tránh singleton mutable toàn process; injected store có lifecycle do caller sở hữu phải được ghi rõ thay vì tự đóng/reset tài nguyên dùng chung.

### Luồng request cần kiểm chứng sau tích hợp

1. Request tới publish thật qua routing/parser và identity boundary T03; thứ tự hook/validation và precedence lỗi phải theo contract T08 đã review, không suy ra từ thứ tự hàng trong bảng dependencies.
2. Tra lab/class bằng T02 và kiểm tra role TA + class ownership. TA khác lớp vẫn bị từ chối; payload tự khai role/userId không cấp quyền.
3. Kiểm tra pending reviews và publication state theo contract. Draft T08 yêu cầu `409 pending-reviews` khi còn review và retry giữ nguyên `publishedAt`/`publishedBy`, không tạo side effects trùng. Đây là contract candidate, không phải behavior của skeleton hiện tại.
4. Transition và summary dùng state T02 thật; lỗi không được gây mutation. Trình tự check/write phải đáp ứng giới hạn concurrency mà T02/T08 thống nhất, không chỉ check rồi ghi với một bảo đảm atomic ngầm định.
5. Serialize success/problem details theo contract, test thêm state trước/sau và repeat-call, không chỉ status code. Default startup không bật test-header bypass; cơ chế client credential thật cho bản PA02 vẫn cần C/A chốt.

Hiện `POST /labs/{labId}/publish` vẫn trả default 404 vì plugin rỗng. Test seed pending/resolved state trực tiếp; không cần gọi submissions/review-queue để tạo fixture, không gọi model hoặc chạy code sinh viên.

### Review và handoff còn mở

- **Vỹ/người yêu cầu:** review diff tài liệu này, phương án typed plugin options/wrapper, ownership/lifecycle của dependencies và các giới hạn được nêu; chưa yêu cầu commit/push/merge.
- **Vượng/T02:** xác nhận các capability và API state/seed/reset cùng persistence/concurrency limits; không yêu cầu triển khai T02 trong T01.
- **Phúc/T03/T08:** xác nhận scope hooks/error handler, resolver và wiring publish thật; credential/header + precedence theo contract phải rõ trước acceptance endpoint.
- **Phúc/reviewer T01:** review delta mới so với `738b183a`; giữ nguyên approval/evidence cũ, không tự tick thêm mục review.
- Checklist thực hiện kiến trúc T01 được đồng bộ local sau review của người yêu cầu ngày 08/11: đã ghi nền runtime/lifecycle/wiring và nhận yêu cầu capability T02/đề xuất T03 làm đầu vào. Không có nghĩa API T02 đã được Vượng xác nhận; phần đó thuộc T02, không phải yêu cầu triển khai thêm trong T01. Independent review của delta mới và tích hợp vẫn còn mở; chưa cập nhật Issue remote hoặc publish.

Nguồn đầu vào: [Issue #2](https://github.com/2609-AWAD-23-3/leetkob/issues/2), [đề xuất T03](https://github.com/2609-AWAD-23-3/leetkob/issues/3#issuecomment-6703264025), [draft T08](https://github.com/2609-AWAD-23-3/leetkob/pull/15), [scope PA02](https://github.com/2609-AWAD-23-3/leetkob/pull/16). Không coi mô tả Issue/PR là bằng chứng code đã tồn tại. Evidence/AI entry local: [T01 architecture 08/11](../evidence/PA02/T01/architecture-2026-11-08.md).
