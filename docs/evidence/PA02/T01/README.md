# T01 — Evidence skeleton

**Source candidate:** [738b183aef8e180f8e72ef22edcef3521e65c3c1](https://github.com/2609-AWAD-23-3/leetkob/commit/738b183aef8e180f8e72ef22edcef3521e65c3c1), branch feat/t01-architecture-skeleton.
**Tham chiếu:** [Issue #1](https://github.com/2609-AWAD-23-3/leetkob/issues/1), [PR #14](https://github.com/2609-AWAD-23-3/leetkob/pull/14), [task chính trong plan](../../../plans/PA02.md#t01--architecture-baseline-và-skeleton).
**Executor:** Vỹ / @tranquocvy. **Human reviewer:** Phúc / @BHVPhuc đã approve candidate 738b183a trên PR #14 và xác nhận hai review items ở Issue #1. Không suy ra acceptance cho delta mới.

Hồ sơ bổ sung ở local, chưa commit/push. SHA trên là code được kiểm tra, không phải commit chứa các file evidence mới. Không suy ra trạng thái remote/reviews hiện tại từ kết quả local.

## Kết quả được lưu

[verification.json](verification.json) ghi lần chạy lại ngày 02/11/2026, 23:53–23:54 GMT+7 (timestamps trong JSON dùng UTC), môi trường Windows x64, Node 24.22.1 và npm 11.19.1; có command, stdout/stderr và exit code.

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| Tracked tree trước lần chạy | Không khác source commit | git diff --name-only trống trong JSON |
| Build tại working repo | Exit 0 | npm run build |
| Smoke tại working repo | 7/7 pass, 0 fail | node --test tests/smoke/app.test.mjs |
| Fresh local Git clone | Không hardlinks, SHA trùng candidate, ban đầu không node_modules | clone và rev-parse records |
| Cài từ lockfile tại clone | Exit 0 | npm ci --ignore-scripts |
| Build + smoke tại clone | Exit 0; 7/7 pass, 0 fail | Hai records cuối |

Đây là clone từ repo local trong cùng môi trường Windows; không phải clone GitHub/public và không chứng minh Linux. Dependencies của fresh clone được cài riêng, không copy node_modules cũ.

## Rule → test/file

Các tên test nằm trong [smoke suite](../../../../tests/smoke/app.test.mjs); app source tại [app.ts](../../../../src/app.ts), [config.ts](../../../../src/config.ts) và [server.ts](../../../../src/server.ts).

- Factory không tự listen và health đi qua HTTP injection thật: factory does not listen; health works through the real HTTP injection boundary.
- Ba plugins gắn vào cùng app: each module accepts its own real Fastify plugin in the same application.
- Không có business response thành công giả: business routes are absent rather than fake successful implementations.
- Instance/lifecycle tách biệt: application instances have isolated plugin state and lifecycle hooks.
- Listener thật mở/đóng trên loopback: listener can start on loopback and close without hard-coded test ports.
- Config defaults/validation: configuration has local defaults and validates explicit environment input.
- Entry point gặp config sai phải nonzero: executable rejects invalid configuration with a nonzero exit.

## Tái lập

Checkout source SHA trên vào bản làm việc sạch, dùng Node/npm đúng README rồi chạy:

~~~sh
npm ci --ignore-scripts
npm run build
node --test tests/smoke/app.test.mjs
~~~

Đối chiếu [README setup](../../../../README.md) và [architecture](../../../architecture/overview.md). Không thay tests hoặc contract để tạo kết quả xanh.

## Giới hạn và acceptance còn thiếu

- Đây là evidence kỹ thuật hẹp của T01, không phải CI run, required-check/protection, blocked PR hoặc deliberate business-contract break.
- Không chứng minh full harness/lint/format của T04, auth/store/endpoint nghiệp vụ, sandbox/model, watch restart hoặc OS signal thật.
- Publish-only đã được người yêu cầu chốt; Phúc xác nhận endpoint. Người yêu cầu đã review tài liệu kiến trúc local ngày 08/11. API state/fixtures cụ thể và limits thuộc Vượng/T02; không tự claim owner agreement.
- Hai review items cũ đã có xác nhận của Phúc cho 738b183a; delta mới cần review riêng. Không tự chấm điểm rubric từ hồ sơ này.
- Quy trình/T12 ở PR #13 chưa được tích hợp vào branch này; không ghi đè phần đó khi tích hợp sau này.

[AI log input](AI-LOG.md) bàn giao cho T11. T11 phải tổng hợp vào AI-LOG.md, PA2.md và self-assessment ở root; hồ sơ task không thay thế ba file nộp bắt buộc đó.

## Audit bổ sung 08/11/2026

Trong lượt người yêu cầu hỏi evidence/prompt đã đủ chưa, assistant chạy lại `npm run build` (exit 0) và `node --test tests/smoke/app.test.mjs` (exit 0, 7/7 pass, 0 fail). Node v24.22.1, npm 11.19.1; source HEAD vẫn 738b183a, thay đổi local chỉ là docs. `git diff --check` exit 0; kiểm tra 28 local Markdown links trong overview/evidence, 0 missing (không kiểm tra anchors). Đây là lần audit vừa trước yêu cầu đồng bộ trạng thái, không phải lần chạy ngày 02/11 trong verification.json; không phải CI hoặc fresh install mới. Kết quả tóm tắt từ tool output phiên này, không tự gán timestamps chi tiết chưa được capture. Xem [bổ sung architecture/AI input](architecture-2026-11-08.md).
