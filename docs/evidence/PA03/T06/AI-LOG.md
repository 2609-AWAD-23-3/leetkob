# Đầu vào AI-log — PA03-T06

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 2026-11-22 — Queue worker process riêng, claim/lease/retry và tích hợp Postgres

**Công cụ (Tool):** Antigravity assistant (Orchestrator), Node `v24.22.1`, Postgres `17-alpine` (`docker/compose.postgres.yml` trên Ubuntu 24.04 qua SSH tunnel tạm thời).

**Yêu cầu (Asked for):** Triển khai PA03-T06 (Issue #35): worker process riêng chạy `claim` + `lease` + `retry` trên Postgres queue từ T03, lưu đúng một bộ verdict trong transaction (Rule Q1), kiểm chứng cả unit offline lẫn tiến trình worker tách biệt trên Postgres thật cho kịch bản dừng worker → nộp → khởi động lại.

**Phần giữ lại (Kept):** Tách hẳn `npm test` offline với `npm run test:db` (tự skip `worker-postgres.test.mjs` khi thiếu `TEST_DATABASE_URL`); dùng trực tiếp `Store`/`JobQueue` và `runHardRules` đã nghiệm thu từ T03 và T07; giữ ranh giới module của `project-structure.md` (`src/worker/` không import từ `src/api/` hay `src/cli/`).

**Phần điều chỉnh (Changed):**
- Chú ý `exactOptionalPropertyTypes: true` trong `tsconfig.json` khi cấu hình tùy chọn `schema` cho `createPostgresStore` và cấu trúc `WorkerStepResult` trả về từ `runOnce()`.
- Trong chế độ giả lập crash giữa chừng ở CLI worker (`WORKER_SIMULATE_CRASH_AFTER_CLAIM`), dùng `writeSync(1, ...)` đồng bộ trước `process.exit(137)` thay vì `process.stdout.write` bất đồng bộ để tránh mất dòng log sự kiện trước khi tiến trình thoát trên Windows/Linux.
- Không dựa vào `SIGTERM` để dừng tiến trình con trong suite `worker-postgres.test.mjs` đa nền tảng vì Windows `TerminateProcess` không gửi tín hiệu catchable; thay vào đó dùng `WORKER_EXIT_WHEN_IDLE=1` cho tiến trình con OS thật trên Postgres (và `start()`/`stop()` polling loop được test trực tiếp trong `worker.test.mjs`).
- Mở rộng `scripts/test-db.mjs` để chạy cả `tests/integration/postgres-store.test.mjs` lẫn `tests/integration/worker-postgres.test.mjs` (đồng bộ với CI job `postgres-store`).

**Phần không chọn (Rejected):**
- Không nối cứng lệnh `docker` sandbox hay model HTTP trực tiếp bên trong `src/worker/cli.ts` của T06 để giữ tách biệt trách nhiệm theo plan (T06 chịu trách nhiệm queue/worker/lease/retry/hard-rules-first và unique verdict; T11 ghép T04 + T05 + T06 + T08 + T09 end-to-end).

**Phần làm tay (By hand):** Phúc yêu cầu bắt đầu và chạy kiểm chứng T06 từ nền `origin/develop`. Assistant viết unit tests, Postgres integration tests, code `src/worker/`, chứng minh chạy thật trên Postgres 17 và dừng trước khi commit/push để chờ duyệt.

## 2026-11-22 — Xử lý 3 findings review của `@vinny2707` và sync `origin/develop` (`f2a4f04`)

**Công cụ (Tool):** Antigravity assistant (Planner + Execution), Node `v24.22.1`, Postgres `17-alpine` (`docker/compose.postgres.yml` trên Ubuntu 24.04 qua SSH tunnel tạm thời).

**Yêu cầu (Asked for):** Sync `origin/develop` sau khi PR #51 (T04) merge và xử lý đủ 3 findings review của `@vinny2707` trên PR #50 (`[P1]` không mặc định ghi `AC` giả lập, `[P2]` giữ worker chạy nền sống khi poll interval > idle timeout của pool, `[P2]` không mất `modelCalls` hay báo sai `stale_lease` khi `recordModelCall` lỗi sau `complete`).

**Phần điều chỉnh (Changed):**
- Đổi `createDefaultJudgeSubmission` thành `createSimulatedJudgeSubmission` dành riêng cho test; bắt buộc truyền `judgeSubmission` hoặc `evaluator` vào `createQueueWorker` và `createDefaultSubmissionEvaluator`, còn CLI `src/worker/cli.ts` fail-closed từ chối chạy nếu thiếu `WORKER_ALLOW_SIMULATED_JUDGE=1` + `WORKER_SIMULATE_JUDGE_VERDICT` tường minh.
- Bỏ `sleepTimer.unref()` trong `waitForNextPoll()` của `src/worker/runner.ts` để giữ event loop sống khi queue rỗng qua mốc `idleTimeoutMillis: 1000` của `pg.Pool`; timer được dọn ngay khi `stop()` gọi `wakeSleep()`.
- Tách việc lưu `modelCalls` ra khỏi khối `try/catch` đánh giá gọi `store.fail()`, bổ sung hàng đợi `pendingModelCalls` (có tùy chọn journal bền vững `modelCallJournalPath` và `modelCallRetryAttempts`) cùng `flushPendingModelCalls()` chạy sau `complete`, đầu mỗi `runOnce()` và trong `stop()`.
- Bổ sung tests offline (`9/9` trong `tests/unit/worker.test.mjs`) và tiến trình OS thật trên Postgres 17 (`npm run test:db` `91/91` gồm test fail-closed, test giữ daemon chạy nền với `WORKER_POLL_INTERVAL_MS=1800` qua ngưỡng pool `1000 ms`, và test outbox/journal retry không re-judge).

**Phần không chọn (Rejected):**
- Không giữ `sleepTimer.unref()` rồi mở kết nối DB giả để giữ event loop vì vừa tốn kết nối Postgres không cần thiết vừa che giấu vấn đề vòng đời timer thật của worker loop.
- Không gọi lại toàn bộ quá trình chấm (`evaluator` + `complete`) khi `recordModelCall` lỗi vì bài nộp đã được `complete` nguyên tử và việc chạy lại model vừa sai trạng thái vừa tốn chi phí.

**Phần làm tay (By hand):** Phúc chỉ đạo xử lý dứt điểm PR #46 trước rồi xử lý tiếp PR #50. Assistant chạy kiểm chứng offline (`npm test` `367` pass / `2` skip) và Postgres thật (`91/91` pass).
