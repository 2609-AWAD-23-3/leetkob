# T04 — candidate PR 08/11/2026

Refs #4. Executor: Trần Quốc Vỹ (@tranquocvy); reviewer độc lập: Phúc
(@BHVPhuc). Review độc lập và integration chưa hoàn tất.

## Nguồn và phạm vi

- Nhánh: `test/t04-quality-harness`, từ develop
  `9ac6bf5d7f7fcdab6f8835b836ca35dede010121` sau fetch.
- Node `24.22.1`, npm `11.19.1`, Windows; giữ TypeScript `7.0.2`, Fastify `5.12.8`.
- Commands: `npm run lint`, `npm run format-check`, `npm run type-check`, `npm test`.
- Oxlint `1.92.0`, Prettier `3.9.10`, pin trong manifest/lockfile.
- Không thay handler, không thêm business endpoints/CI/protection hoặc framework riêng.
- Smoke suite T01 chỉ đổi formatting; support suite mới kiểm tra app thật,
  cleanup hook và state/plugin isolation. Baseline: **9 tests passed**, không skip.

## Bằng chứng thực thi

[verification.json](verification.json) ghi từng command/cwd/start/end/exit/stdout/stderr.
[publication-verification.json](publication-verification.json) ghi lần chạy lại
bốn commands trước commit: tất cả exit 0, 9 tests passed, không skip/fail.
[candidate-sha256.json](candidate-sha256.json) nhận diện snapshot các file trước
negative probes; đây **không phải commit SHA của diff chưa commit**. Hash của
verification.json trong snapshot là phiên bản giữa lượt chạy, không phải log cuối.

| Kiểm chứng | Kết quả |
| --- | --- |
| Bốn commands trên checkout local | Cả bốn exit 0 |
| Clone local mới, overlay candidate chưa commit, `npm ci --ignore-scripts` | Exit 0, không dùng node_modules/dist của checkout nguồn |
| Bốn commands trong môi trường sạch | Cả bốn exit 0, 9 tests passed |
| Thêm `src/t04-negative.ts` chứa `debugger;`, lint | Exit 1 |
| File TS chưa format, format-check | Exit 1; so sánh byte xác nhận không sửa file |
| TS `export const wrong: string = 123;`, type-check | Exit 1 (TS2322) |
| `tests/contract/t04-negative.test.ts`, assertion `1 === 2`, npm test | Exit 1 do assertion; chứng minh thu contract directory và TS tests |
| Tạm chuyển tests khỏi tên directory được thu, npm test | Exit 1, No test files discovered |
| Xóa probes/phục hồi tests trong finally; chạy lại bốn commands | Cả bốn exit 0, 9 tests passed |
| `git diff --check` | Exit 0 |

Môi trường tái lập: `D:/Workspace/Web/leetkob-t04-clean-20261108`.
Tại thời điểm kiểm chứng, candidate chưa commit: clone nền Git local
bằng `--no-hardlinks`, overlay tracked/untracked không bị
ignore từ candidate rồi cài mới theo lockfile. Đây là **clean environment +
uncommitted overlay**, không được mô tả thành fresh remote clone của final commit.
Probe chỉ thay bản sao sạch, không làm mất thay đổi của người dùng.

## Quyết định tooling

Lần thử `npm install --save-dev --save-exact eslint@9 @eslint/js@9 typescript-eslint prettier globals`
thất bại exit 1: typescript-eslint 8.72.1 yêu cầu TypeScript >=4.8.4 <6.1.0,
không tương thích nền TS7. Không dùng force/legacy-peer-deps hoặc downgrade stack.
Chuyển sang Oxlint; install thành công, audit báo 0 vulnerabilities tại thời điểm chạy.
`npm ci --ignore-scripts` đã thành công cả test/build trên máy này; không tự approve
dependency install scripts. Có thể cần kiểm tra lại trên OS/architecture khác.

Nguồn tooling: [Oxlint](https://oxc.rs/docs/guide/usage/linter.html),
[Prettier CLI](https://prettier.io/docs/cli),
[Node test runner](https://nodejs.org/docs/latest-v24.x/api/test.html).

## Xác nhận kiểm thử bổ sung

- Ngày 08/11/2026, người yêu cầu báo đã chạy lại các bước hướng dẫn và tất cả
  checks/tests đều pass. Đây là xác nhận của executor, không phải review độc lập
  của Phúc; không có stdout/exit-code log mới từ lượt chạy của người dùng.
- Snapshot hashes và verification.json phía trên là evidence lịch sử của lượt
  triển khai. Commit chứa hồ sơ này trên nhánh PR xác định phiên bản được publish;
  không sửa các logs cũ để giả thành một lượt chạy khác.

## Còn thiếu trước acceptance

- Phúc chạy commands và xác nhận hai mục review; hiện không có review mới.
- Handoff riêng, không phải blocker T04: T02 cung cấp fixture/reset API khi có; T08 bổ sung publish
  contract tests thật. Probe discovery không phải contract coverage của endpoint.
- T09 sở hữu CI/protection; logs này không phải CI. Không làm thay hoặc đợi T09
  để nghiệm thu phần tooling/harness T04.
- Execution checklist đã đối chiếu evidence; giữ review boxes cho reviewer.
  Tích hợp develop bằng PR trước khi close Issue.
- T11 tổng hợp [AI-log fragment](AI-LOG.md); không nhận T04/PA02 đã Done.
