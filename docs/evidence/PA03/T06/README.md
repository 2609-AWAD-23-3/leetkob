# PA03-T06 — Queue và worker chấm đúng một lần

Nhánh `feat/pa03-t06-queue-worker` ([PR #50](https://github.com/2609-AWAD-23-3/leetkob/pull/50), `Refs #35`), người thực hiện `@BHVPhuc`, reviewer độc lập `@vinny2707`.

## Môi trường kiểm chứng thực tế

- Kiểm thử offline (`lint`, `format-check`, `type-check`, `npm test`) chạy trên Windows PowerShell với Node `v24.22.1`, npm `11.19.1` (`npm.cmd`) sau khi merge `origin/develop` (`f2a4f04`).
- Kiểm thử Postgres thật (`npm run db:migrate`, `npm run test:db`) chạy với `postgres:17-alpine` (`docker/compose.postgres.yml`) trên host Linux của nhóm (`Ubuntu 24.04.5 LTS`, Docker `29.10.0`) qua tunnel SSH tạm thời tới cổng `127.0.0.1:5433` và Docker socket (đã đóng/dọn container ngay sau khi chạy xong).
- CI GitHub Actions vòng đầu tại commit `8077323`: [Run 44936244113](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/44936244113) đạt `SUCCESS` cho `quality-gate` (`19s`) và `postgres-store` (`30s`); sau vòng sửa 3 findings từ review `@vinny2707` và sync `origin/develop` (`f2a4f04`), bộ test offline và Postgres thật đã được kiểm chứng lại trước khi push để chạy CI mới.

## Thành phần triển khai

- Worker core và CLI: [src/worker/types.ts](../../../../src/worker/types.ts), [src/worker/runner.ts](../../../../src/worker/runner.ts), [src/worker/cli.ts](../../../../src/worker/cli.ts), [src/worker/index.ts](../../../../src/worker/index.ts) (entry point cho `npm run worker`, chỉ chạy tiến trình CLI khi gọi trực tiếp bằng `node dist/worker/index.js`).
- Tuân thủ chia tầng của [project-structure.md](../../../architecture/project-structure.md): `src/worker/` chỉ import từ `src/db/`, `src/pipeline/`, `src/shared/`, không import chéo từ `src/api/` hay `src/cli/`.
- Unit tests offline (không cần Postgres hay Docker): [tests/unit/worker.test.mjs](../../../../tests/unit/worker.test.mjs) (`9/9` tests).
- Integration tests với worker process OS riêng và Postgres 17 thật: [tests/integration/worker-postgres.test.mjs](../../../../tests/integration/worker-postgres.test.mjs) (`5` tests tiến trình OS riêng) chạy qua [scripts/test-db.mjs](../../../../scripts/test-db.mjs) (`npm run test:db`; tự skip khi không đặt `TEST_DATABASE_URL` để giữ `npm test` offline).

## Cơ chế đảm bảo Rule Q1 và xử lý review

1. **Fail closed khi chưa có judge adapter (`[P1]`):** `createQueueWorker` và `createDefaultSubmissionEvaluator` bắt buộc cấu hình tường minh `evaluator` hoặc `judgeSubmission`; không mặc định chấm giả lập `AC`. Tiến trình CLI (`src/worker/cli.ts`) từ chối khởi chạy và giữ submission ở trạng thái `'queued'` trừ khi chế độ test mô phỏng được bật tường minh bằng `WORKER_ALLOW_SIMULATED_JUDGE=1` và `WORKER_SIMULATE_JUDGE_VERDICT`.
2. **Giữ vòng lặp polling chạy nền ổn định qua idle timeout của Postgres pool (`[P2]`):** Trong `waitForNextPoll()` của `src/worker/runner.ts`, timer polling giữ reference của event loop khi `running === true` (chỉ hủy trong `stop()`), nên tiến trình `dist/worker/index.js` không tự thoát khi `pg.Pool` (`idleTimeoutMillis: 1000`) đóng kết nối rảnh lúc `WORKER_POLL_INTERVAL_MS` lớn hơn `1000 ms`.
3. **Outbox & journal bền vững cho `modelCalls` sau `complete` (`[P2]`):** Sau khi `store.complete` đã commit thành công, mọi lỗi tạm thời của `store.recordModelCall` được xử lý tách biệt hoàn toàn khỏi khối `catch` gọi `store.fail`; worker không bao giờ báo nhầm `stale_lease` hay chạy lại phần chấm đã hoàn tất, đồng thời lưu vào outbox (kèm file journal bền vững tùy chọn `modelCallJournalPath`) để retry trong `flushPendingModelCalls()` ở các chu kỳ `runOnce()` tiếp theo và khi `stop()`.
4. **Claim / Lease Token / Retry / Crash Recovery:** `claim` và `fail` dùng chung `maxAttempts`; gia hạn lease theo chuỗi tuần tự (`heartbeatIntervalMs` / `renewLease()`) kèm `AbortController`; worker zombie dùng token cũ gặp `stale_lease` và không ghi đè verdict hay nhân đôi `modelCalls`; submission không đạt `AC` lưu `0` verdict theo FAQ-04 và constraint ban-list do `runHardRules` quyết không đi qua đánh giá ngữ nghĩa.

## Kết quả kiểm chứng (sau vòng sửa 3 findings + sync `origin/develop` `f2a4f04`)

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm run lint` | exit `0` | `oxlint --deny-warnings src tests scripts` (`0` warnings, `0` errors trên 127 files) |
| `npm run format-check` | exit `0` | `prettier --check .` |
| `npm run type-check` | exit `0` | `tsc -p tsconfig.check.json` |
| `npm test` | exit `0` | `369` tests (`367` pass, `0` fail, `2` skip khi chưa đặt `TEST_DATABASE_URL`; riêng `worker.test.mjs` `9/9` pass), không cần Postgres hay Docker |
| `npm run db:migrate` | exit `0` | Áp dụng migrations `0001_init`–`0005_submission_intake` trên `postgres:17-alpine` |
| `npm run test:db` | exit `0` | `91/91` tests pass (`86` tests Postgres store của T03/T04 + `5` tests tiến trình OS worker tách biệt: fail-closed mặc định, dừng/nộp/khởi động lại, giữ chạy nền qua idle timeout `1000 ms` của pool, crash `exit 137` + reclaim sau hết lease, retry `fail()` và non-AC FAQ-04) |
| `git diff --check` | exit `0` | Không lỗi whitespace |

## Phạm vi bàn giao cho T05 / T08 / T11

- Worker process đã chạy độc lập qua `npm run worker` trên Postgres queue thật (`claim` + `extendLease` + `complete` + `fail`), mặc định fail-closed cho tới khi T11 truyền `judgeSubmission` (T05 sandbox) và `evaluateSemanticConstraints` (T08 model).

Xem thêm [nhật ký AI theo task](AI-LOG.md).
