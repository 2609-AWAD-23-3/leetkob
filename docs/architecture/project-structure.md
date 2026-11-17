# LeeTKOB — Cấu trúc project (PA03-T00)

T00 giữ một package Node.js/TypeScript. API, worker và checker là ba entry point của cùng một lần build. API chỉ tiếp nhận request; các task PA03 sau T00 sẽ nối queue, chấm bài và review. T00 giữ nguyên API HTTP, contract Publish v1 và hành vi từ PA02.

Nguồn đối chiếu: [T00 / Issue #43](https://github.com/2609-AWAD-23-3/leetkob/issues/43), [plan PA03 và rubric PA03–PA06 trong PR #30](https://github.com/2609-AWAD-23-3/leetkob/pull/30) (snapshot `ed1a9c3`), [danh sách F1–F11 và các mốc](https://github.com/2609-AWAD-23-3/leetkob/tree/ed1a9c3405df63ab8d86e6e5380b43fd3453a7c4/docs/reference/final-project) và [Publish v1](../contract/publish.md).

## Cây mã và kiểm thử sau T00

```text
src/
  api/
    app.ts                         tạo Fastify và đăng ký module
    server.ts                      entry point npm start
    auth/                          identity, phân quyền và lỗi HTTP Publish
    modules/
      publish/                     route, kiểu và composition Publish
      submissions/                 plugin PA02 chưa có route
      review-queue/                plugin PA02 chưa có route
  db/                              interface, fixtures và store in-memory của PA02
  shared/
    config.ts                      đọc và kiểm tra HOST/PORT
  worker/
    index.ts                       entry point npm run worker (khởi động rồi thoát)
  cli/
    checker.ts                     entry point npm run checker (khởi động rồi thoát)
tests/
  unit/publish-store.test.mjs
  contract/publish.test.mjs
  integration/
    app.test.mjs
    app-harness.test.mjs
    publish-auth-errors.test.mjs
  support/app.mjs                  helper Fastify dùng lại giữa các suite
scripts/test.mjs                   khám phá test đệ quy trong tests/
.github/workflows/ci.yml           quality-gate
docs/
  architecture/
  contract/
  evidence/
  plans/
  reference/
```

Giữ lỗi RFC 9457 cùng `src/api/auth/` trong T00 vì file hiện gắn với HTTP Fastify và Publish; chuyển nguyên cụm để tránh tách interface hoặc sửa hành vi. `src/db/` là chỗ cho lớp lưu trữ: store PA02 vẫn in-memory, Postgres do T03 bổ sung. Các test Fastify, loopback listener, auth/error HTTP và vòng đời fixture thuộc integration; test store không cần HTTP thuộc unit. Contract suite giữ chỗ riêng. `dist/` phản chiếu cây `src/`.

## Quy tắc phụ thuộc giữa các thư mục

- `src/pipeline/` (hard rules, model) dùng chung worker và checker; checker chạy với `MODEL_OFF=1` và không mở network, nên `src/pipeline/` **không import** từ `src/api/` hay `src/db/`. Worker truyền dữ liệu và interface (ví dụ model client, đọc/ghi verdict) vào pipeline qua tham số.
- `src/api/`, `src/worker/` và `src/cli/` được import từ `src/pipeline/`, `src/db/` và `src/shared/`; không import chéo giữa ba entry point này.
- `src/shared/` chỉ chứa cấu hình, kiểu và lỗi dùng chung, không import từ thư mục khác trong `src/`.
- `src/sandbox/` không import `src/db/` và không nhận secret; input/output là bài nộp và kết quả chạy.
- Chưa có công cụ kiểm tra tự động các quy tắc này; reviewer kiểm tra bằng mắt cho đến khi nhóm quyết định thêm lint rule.

## Chỗ cho từng task PA03

| Task | Người thực hiện | Vị trí và bàn giao |
| --- | --- | --- |
| T01 | Vỹ | `docs/plans/`, `docs/reference/`, quy trình ở `docs/workflow.md`, quy tắc ở `AGENTS.md` và mẫu GitHub. |
| T02 | Vượng | Quyết định host, model và ngân sách ở `docs/architecture/decisions/`; bàn giao cấu hình cho T08/T12. |
| T03 | Vượng | `src/db/`, sau này `src/db/migrations/`; dữ liệu dùng chung cho API/worker. Unit và integration tests cho store/migrations. |
| T04 | Vượng | `src/api/auth/`, `src/api/modules/{auth,classes,labs,submissions}/`, kiểm thử API trong `tests/contract/` và `tests/integration/`. |
| T05 | Phúc | `src/sandbox/` cho runner; `sandbox/attacks/` chứa bài tấn công; chạy kiểm thử sandbox trong CI; image trong `docker/`. |
| T06 | Phúc | `src/worker/` cho queue consumer, claim/lease và chấm; `src/db/` cùng T03 cho job/store. Kiểm thử restart và không lưu trùng trong integration. |
| T07 | Vỹ | `src/pipeline/hard-rules/` dùng chung worker/checker, trap tests trong unit. |
| T08 | Vỹ | `src/pipeline/model/` cho prompt, provider và guardrails; unit tests schema/timeout với fake model; ghép với T07 qua `src/pipeline/`. |
| T09 | Vượng | `src/api/modules/{review-queue,publish}/`, contract Publish v1 và tests HTTP cho review/ownership. |
| T10 | Vượng | `src/cli/checker.ts` và `docker/` cho checker; `leetkob-eval/` bản gốc, `eval-cases/` case nhóm, evidence dev run trong `docs/evidence/PA03/T10/`; dùng pipeline của T07/T08. |
| T11 | Phúc | Nối API, worker, sandbox và pipeline theo interface của từng owner; test luồng đầy đủ trong `tests/e2e/`. |
| T12 | Phúc | `deploy/` cho Compose và config triển khai, `docker/` cho image, runbook dưới `docs/`. |
| T13 | Vỹ | Hồ sơ ở root (`PA3.md`, `AI-LOG.md`, `SELF_ASSESSMENT_REPORT.md`, README), tag `pa3`, video/ZIP; tổng hợp evidence dưới `docs/evidence/PA03/`. |

Router/app dùng chung (`src/api/app.ts`) qua Vượng. Workflow trong `.github/workflows/` qua Phúc. `leetkob-eval/`, `eval-cases/` và checker qua Vượng; các thay đổi pipeline dùng chung phối hợp Vỹ. T00 di chuyển file và cập nhật wiring đường dẫn; các thay đổi interface sau đó theo owner. Thư mục trên chưa có trong cây T00 chỉ được tạo khi có mã, test, cấu hình hoặc tài liệu thật.

## F1–F11 theo mốc

| Feature | Chỗ trong project | Mốc |
| --- | --- | --- |
| F1 — Accounts, roles và classes | `src/api/auth/`, các module auth/classes, `src/db/`, `web/` khi có UI. | PA03: quyền và dữ liệu cho prototype. |
| F2 — Lab, tests và constraints | Module labs, `src/db/`, `web/` cho TA. | PA03: tạo lab và mức trừ do TA đặt. |
| F3 — Submit và judge | Module submissions, `src/worker/`, `src/db/`, `web/` cho trạng thái. | PA03: queue và kết quả; PA05: cập nhật trạng thái không reload. |
| F4 — Sandbox | `src/sandbox/`, `sandbox/attacks/`, `docker/` và CI. | PA03: chín minimums và test tấn công. |
| F5 — Hard rules trước | `src/pipeline/hard-rules/`, dùng chung worker/checker. | PA03: nhận biết cú pháp, tránh trap và bỏ model call khi đã quyết. |
| F6 — Model chấm semantic | `src/pipeline/model/`, `docs/evidence/` cho bằng chứng gọi model. | PA03: model thật, verdict/evidence và chi phí. |
| F7 — Guardrails | `src/pipeline/model/`, `tests/unit/`, module review-queue hiện lý do. | PA03: schema/timeout; PA04: bằng chứng khớp mã, giới hạn chi phí, output không quyết định mức trừ và ca injection. |
| F8 — Review và Publish | Các module review-queue/publish, `src/db/`, `web/` cho TA. | PA03: verdict chỉ tới TA, chặn Publish khi còn pending; PA04: lấy mẫu pass và human gate đầy đủ. |
| F9 — Điểm đã công bố và appeals | Module publish, các module marks/appeals trong `src/api/modules/`, `src/db/`, `web/` cho TA/student. | PA05: đọc điểm và xử lý appeals. |
| F10 — Checker và eval gate | `src/cli/`, `src/pipeline/`, `docker/`, `leetkob-eval/`, `eval-cases/`, CI. | PA03: checker và run đầu tiên; PA04: required eval check và held-out run. |
| F11 — Logs, metrics và traces | `src/observability/` dùng từ API/worker/pipeline; `deploy/` cho dashboard và alert. | PA05: quan sát luồng theo submission, SLO và alert. |

PA04 lưu hồ sơ held-out, guardrails, human gate và red-team dưới `docs/evidence/PA04/`, tóm tắt ở `PA4.md`. PA05 bổ sung `load/` cho tải 80 bài, `docs/evidence/PA05/` cho post-mortem và `PA5.md` cho liên kết nghiệm thu. PA06 chạy lại final build trên deployment `pa5`; `OWNERS.md` trỏ vào code, tests, run và người phụ trách để chuẩn bị demo/oral. Các đường dẫn tương lai là chỗ dự kiến, không phân công thêm người hay chốt framework frontend.
