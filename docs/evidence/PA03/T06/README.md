# PA03-T06 — Queue và worker chấm đúng một lần

Nhánh `feat/pa03-t06-queue-worker` (`Refs #35`), người thực hiện `@BHVPhuc`, reviewer độc lập `@vinny2707`.

## Môi trường kiểm chứng thực tế

- Kiểm thử offline (`lint`, `format-check`, `type-check`, `npm test`) chạy trên Windows PowerShell với Node `v24.22.1`, npm `11.19.1` (`npm.cmd`).
- Kiểm thử Postgres thật (`npm run db:migrate`, `npm run test:db`) chạy với `postgres:17-alpine` (`docker/compose.postgres.yml`) trên host Linux của nhóm (`Ubuntu 24.04.5 LTS`, Docker `29.10.0`) qua tunnel SSH tạm thời tới cổng `127.0.0.1:5433` và Docker socket (đã đóng/dọn container ngay sau khi chạy xong).

## Thành phần triển khai

- Worker core và CLI: [src/worker/types.ts](../../../../src/worker/types.ts), [src/worker/runner.ts](../../../../src/worker/runner.ts), [src/worker/cli.ts](../../../../src/worker/cli.ts), [src/worker/index.ts](../../../../src/worker/index.ts) (entry point cho `npm run worker`, chỉ chạy tiến trình CLI khi gọi trực tiếp bằng `node dist/worker/index.js`).
- Tuân thủ chia tầng của [project-structure.md](../../../architecture/project-structure.md): `src/worker/` chỉ import từ `src/db/`, `src/pipeline/`, `src/shared/`, không import chéo từ `src/api/` hay `src/cli/`.
- Unit tests offline (không cần Postgres hay Docker): [tests/unit/worker.test.mjs](../../../../tests/unit/worker.test.mjs) (`7/7` tests).
- Integration tests với worker process OS riêng và Postgres 17 thật: [tests/integration/worker-postgres.test.mjs](../../../../tests/integration/worker-postgres.test.mjs) chạy qua [scripts/test-db.mjs](../../../../scripts/test-db.mjs) (`npm run test:db`; tự skip khi không đặt `TEST_DATABASE_URL` để giữ `npm test` offline).

## Cơ chế đảm bảo Rule Q1 (claim / lease / retry / chấm đúng một lần)

1. **Claim & Lease Token (`JobQueue.claim`):** Worker lấy job chưa xong với `leaseMs` và `maxAttempts` thống nhất cho cả `claim` lẫn `fail`. Mỗi lần claim cấp một `leaseToken` mới (`randomUUID()`); mọi thao tác `extendLease`, `complete`, `fail` đều bắt buộc đối chiếu đúng `leaseToken` đang còn hạn.
2. **Gia hạn lease & phát hiện mất lease (`renewLease` / `heartbeatIntervalMs`):** Trong khi đánh giá bài nộp, worker gửi heartbeat định kỳ (chuỗi tuần tự tránh chồng chéo request). Nếu `extendLease` trả `false` (lease đã hết hạn hoặc bị worker khác reclaim), `AbortController` kích hoạt `context.signal` ngay và đánh dấu kết quả là `stale_lease`.
3. **Commit nguyên tử một bộ verdict (`JobQueue.complete`):** Kết quả chấm (`JudgeResult`) và danh sách verdict được ghi trong cùng một transaction với ràng buộc khóa duy nhất `(submission_id, constraint_id)` và kiểm tra lại hạn lease trước khi ghi. Worker cũ thức dậy muộn (`zombie`) nhận `stale_lease` và không thể ghi đè `judgeResult`, nhân đôi verdict hay ghi trùng `modelCalls`.
4. **Retry & Crash Recovery (`fail` / `requeue`):** Lỗi tạm thời gọi `store.fail(..., maxAttempts)` để đưa submission về `'queued'` cho lượt thử kế tiếp cho tới `maxAttempts` (`'failed'`, khôi phục bằng `requeue`). Nếu worker crash đột ngột giữa chừng (không gọi `complete`/`fail`), khi hết hạn `leaseMs` một tiến trình worker mới sẽ reclaim và hoàn tất đúng một bộ verdict.
5. **Hard rules trước model & quy tắc FAQ-04:** Với submission `AC`, `createDefaultSubmissionEvaluator` gọi `runHardRules` trước; các constraint ban-list đã quyết (`pass` hoặc `violation` kèm chứng cứ dòng) không bao giờ đi qua `evaluateSemanticConstraints`. Constraint ngữ nghĩa còn lại dùng đánh giá ngữ nghĩa (hoặc mặc định `'unsure'` với `unsureCause: 'model_unsure'` ở pha trước khi ghép T08/T11). Submission không đạt `AC` (`WA`, `TLE`, `MLE`, `RE`, `CE`) lưu `judgeResult` với `0` verdict theo FAQ-04.

## Kết quả kiểm chứng

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm run lint` | exit `0` | `oxlint --deny-warnings src tests scripts` (`0` warnings, `0` errors trên 81 files) |
| `npm run format-check` | exit `0` | `prettier --check .` |
| `npm run type-check` | exit `0` | `tsc -p tsconfig.check.json` |
| `npm test` | exit `0` | `313` tests (`311` pass, `0` fail, `2` skip khi chưa đặt `TEST_DATABASE_URL`; riêng `worker.test.mjs` `7/7` pass), không cần Postgres hay Docker |
| `npm run db:migrate` | exit `0` | Áp dụng migrations `0001_init, 0002_model_call_metrics` trên `postgres:17-alpine` |
| `npm run test:db` | exit `0` | `72/72` tests pass (`69` tests Postgres store của T03 + `3` tests process worker tách biệt: dừng/nộp/khởi động lại, crash `exit 137` + reclaim sau hết lease, retry qua `fail()` và non-AC FAQ-04) |
| `git diff --check` | exit `0` | Không lỗi whitespace |

## Phạm vi bàn giao cho T05 / T08 / T11

- Worker process đã chạy độc lập qua `npm run worker` trên Postgres queue thật (`claim` + `extendLease` + `complete` + `fail`), phân tách rõ phần `judgeSubmission` (T05 sandbox sẽ nối vào ở T11) và `evaluateSemanticConstraints` (T08 model pipeline sẽ nối vào ở T11).

Xem thêm [nhật ký AI theo task](AI-LOG.md).
