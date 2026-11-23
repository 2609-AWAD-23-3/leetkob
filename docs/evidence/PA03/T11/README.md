# PA03-T11 — Tích hợp pipeline end-to-end

- Task: [Issue #40](https://github.com/2609-AWAD-23-3/leetkob/issues/40), mục T11 trong [plan PA03](../../../plans/PA03.md#t11--t%C3%ADch-h%E1%BB%A3p-pipeline-end-to-end).
- Người thực hiện: Phúc (`@BHVPhuc`). Reviewer độc lập: Vỹ (`@tranquocvy`).
- Nhánh: `feat/pa03-t11-e2e-integration` tách từ `origin/develop` (`80f25e3`).
- Commits:
  - Test-first: `408ad97` (`tests/unit/worker-integration.test.mjs`, `tests/e2e/pipeline.test.mjs`)
  - Implementation: `66ccfda` (`src/worker/adapters.ts`, `src/worker/types.ts`, `src/worker/runner.ts`, `src/worker/cli.ts`, `src/worker/index.ts`, `tests/integration/worker-postgres.test.mjs`)

## 1. Phạm vi nối pipeline

Luồng tích hợp end-to-end:

`POST /labs/:labId/submissions` (T04) ➔ `jobs` trong Store (T03) ➔ `createQueueWorker` (T06) ➔ `createSandboxJudgeSubmission` / `createDockerSandboxRunner` (T05) ➔ `runHardRules` (T07) ➔ `createSemanticEvaluator` (T08) ➔ `Store.complete` ➔ `review-queue` & `publish` gate (T09).

### Chi tiết triển khai trong `src/worker/`

1. **`src/worker/adapters.ts`:**
   - `buildSandboxLimitsFromLab`: ánh xạ `LabLimits` (`cpuTimeMs`, `memoryMb`) và `FIXED_JUDGE_LIMITS` sang `SandboxLimits` (CPU tính theo giây, wall = 3×CPU, 16 processes, 1 MiB output, compile 10s/30s).
   - `mapSandboxResultToJudgeResult`: chuyển `SandboxSubmissionResult` (`Accepted`/`CompileError`/`WrongAnswer`/`TimeLimitExceeded`/`MemoryLimitExceeded`/`OutputLimitExceeded`/`RuntimeError`) sang `JudgeResult` (`AC`/`CE`/`WA`/`TLE`/`MLE`/`RE`).
   - `createSandboxJudgeSubmission`: bọc `createDockerSandboxRunner` thành `JudgeSubmissionFn` (cho phép inject `createRunner` cho test offline).
   - `createStoreIdentityResolver`: lấy `displayName`, `username` và các phần tên từ `store.getUser(studentId)` (hỗ trợ lookup qua `store.getSubmission(id)` khi context chỉ có `id`/`code`), trả `[]` nếu thiếu user để `createSemanticEvaluator` fail-closed bằng `ModelConfigError`.
2. **Retry policy, backoff và log lỗi (`src/worker/runner.ts`, `src/worker/types.ts`):**
   - Bổ sung `retryBackoffMs` (mặc định `500 ms`), `maxRetryBackoffMs` (`30_000 ms`) và `computeRetryBackoffMs`; vòng `start()` chờ backoff khi job thất bại có `willRetry === true`.
   - Khi `ModelConfigError` hoặc `ModelProviderError` với `retryable === false` (`400`/`401`/`403`/`404`) xảy ra, worker fail job ngay lập tức (`effectiveMaxAttempts = Math.min(maxAttempts, job.attempts)`) thay vì retry vô ích.
   - Khi `ModelProviderError` mang `error.modelCall` (`outcome: 'provider_error'`), worker đẩy vào `pendingModelCalls` và flush qua `store.recordModelCall` trước khi gọi `store.fail(...)`.
   - Thêm callback `onHardRulesDecision` nhận `decisionLog` từ `runHardRules` (`modelCalled: false` cho constraint ban-list).
3. **Nối chế độ chạy thật trong `src/worker/cli.ts`:**
   - Khi không ở chế độ test simulation, `loadWorkerProcessConfig` gọi `readModelConfig(env)` (fail-closed nếu thiếu `MODEL_API_KEY`) và đọc `SANDBOX_IMAGE`, `DOCKER_COMMAND`, `WORKER_RETRY_BACKOFF_MS`.
   - `buildProcessEvaluator` nối trực tiếp `createSandboxJudgeSubmission` + `createAnthropicModelClient` + `createSemanticEvaluator` + `createStoreIdentityResolver(store)` vào `createDefaultSubmissionEvaluator`.

## 2. Kết quả kiểm chứng

### Đỏ trước cài đặt (commit `408ad97` trước `66ccfda`)

- `npm test` thoát mã `1`: `517` test, `512` pass, `2` fail (`tests/e2e/pipeline.test.mjs`, `tests/unit/worker-integration.test.mjs` báo thiếu export `createSandboxJudgeSubmission` và `DEFAULT_WORKER_RETRY_BACKOFF_MS` từ `dist/worker/index.js`), `3` skip.

### Xanh sau cài đặt (commit `66ccfda`)

| Kiểm tra | Mã thoát | Kết quả |
| --- | ---: | --- |
| `npm run lint` | `0` | 0 warnings, 0 errors (156 files) |
| `npm run format-check` | `0` | Toàn bộ file đạt Prettier |
| `npm run type-check` | `0` | TypeScript strict (`tsconfig.check.json`) đạt |
| `git diff --check` | `0` | Không lỗi whitespace |
| `npm test` | `0` | **525** tests: **522** pass, **0** fail, **3** skip (3 suite Postgres tự bỏ qua khi chưa đặt `TEST_DATABASE_URL`) |

Phạm vi test mới:
- `tests/unit/worker-integration.test.mjs` (`9/9` pass): ánh xạ limits/verdicts sandbox, `createSandboxJudgeSubmission`, `createStoreIdentityResolver` fail-closed với `ModelConfigError`, `ModelProviderError` (`retryable: false` fail ngay và ghi `provider_error`, `retryable: true` chờ backoff và ghi cả 2 log), `onHardRulesDecision` (`modelCalled: false`), và `loadWorkerProcessConfig`.
- `tests/e2e/pipeline.test.mjs` (`1/1` pass): kịch bản đầy đủ Tiêu chí 1 (`sort-merge`) qua HTTP thật (`createApp` + `createInMemoryStore`), fake sandbox, `runHardRules`, fake model (`createSemanticEvaluator`), cho 4 bài nộp (`WA` không soát theo FAQ-04; tuân thủ; vi phạm `std::sort` + bubble sort; prompt injection kèm tên sinh viên bị xóa comment/danh tính). Kiểm tra `GET /submissions/:id` và `/mine` chỉ trả `judgeResult` (FAQ-08), student `403` và TA lớp khác `404` trên review queue (FAQ-01), Publish bị chặn `409 pending-reviews` trước khi TA duyệt đủ, và Publish `200` sau khi `confirm-passes` + duyệt `violation` kèm `evidenceLines`.

## 3. Giới hạn và bàn giao

- Chế độ offline (`npm test`) dùng `createInMemoryStore`, fake `SandboxRunner` và fake `ModelClient` để không phụ thuộc mạng, Docker hay Postgres theo đúng ranh giới PA03; kiểm chứng Docker sandbox thật + Postgres thật trên VPS công khai thuộc **T12** (`#41`).
- Không mở rộng bảng `model_calls` để thêm cột `prompt_sha256` trong T11 để tránh sửa migration DB ngoài `src/worker/`; có thể bổ sung ở PA04/PA05 nếu cần.
