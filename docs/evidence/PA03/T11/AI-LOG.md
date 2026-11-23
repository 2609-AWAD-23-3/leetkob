# Đầu vào AI-log — PA03-T11

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 2026-11-23 — Tích hợp pipeline end-to-end trong worker và e2e offline

**Công cụ (Tool):** Antigravity assistant (Planner + Execution), Node `v24.22.1`.

**Yêu cầu (Asked for):** Triển khai PA03-T11 (Issue #40): nối `submit → worker → sandbox → hard rules → model → verdict → review queue` trong `src/worker/`, áp dụng các điểm bàn giao từ PR #52 (T08: `getIdentity` fail-closed, không retry khi `retryable === false`, backoff retry job, lưu `error.modelCall`, ghi `decisionLog` từ T07), và viết unit + e2e tests offline cho 3 bài Tiêu chí 1.

**Phần giữ lại (Kept):** Giữ nguyên kiến trúc tách biệt `src/pipeline/model/` không import `src/worker/` và `src/worker/` không import `src/api/`; giữ `npm test` chạy hoàn toàn offline (dùng `createInMemoryStore`, fake `SandboxRunner`, fake `ModelClient`), không sửa `src/db/`, `src/api/` hay migration Postgres.

**Phần điều chỉnh (Changed):**
- Thêm `src/worker/adapters.ts` (`buildSandboxLimitsFromLab`, `mapSandboxResultToJudgeResult`, `createSandboxJudgeSubmission`, `createStoreIdentityResolver`). Khi kiểm tra `type-check` phát hiện `SemanticEvaluationContext.submission` chỉ có `'id' | 'code'` (không có `'studentId'`), đã mở rộng `createStoreIdentityResolver` nhận `Pick<Submission, 'id'> & { readonly studentId?: string | undefined }` và fallback sang `store.getSubmission(submission.id)` khi thiếu `studentId` thay vì sửa interface trong `src/pipeline/model/`.
- Cập nhật `src/worker/runner.ts` và `src/worker/types.ts`: bổ sung `computeRetryBackoffMs`, backoff trong vòng `start()`, dừng retry ngay với `ModelConfigError` / `ModelProviderError.retryable === false`, lưu `error.modelCall` (`provider_error`) trước khi `store.fail()`, và callback `onHardRulesDecision`.
- Nối chế độ chạy thật (`createSandboxJudgeSubmission` + `createAnthropicModelClient` + `createSemanticEvaluator` + `createStoreIdentityResolver`) vào `src/worker/cli.ts`, vẫn fail-closed khi thiếu `MODEL_API_KEY`; cập nhật assertion stderr tương ứng trong `tests/integration/worker-postgres.test.mjs`.
- Trong `tests/e2e/pipeline.test.mjs`, sau lần chạy đầu báo `401` ở bước `POST /labs/:labId/publish` do đẩy clock vượt quá 12 giờ làm hết hạn session TA, đã chỉnh cửa sổ `DEADLINE` của test từ `+12h` xuống `+1h` để khớp TTL session thật.

**Phần không chọn (Rejected):**
- Không sửa `SemanticEvaluationContext` trong `src/pipeline/model/types.ts` để thêm `studentId` vì hợp đồng kiểu của T08 đã được review và merge ở PR #52.
- Không thêm migration `prompt_sha256` vào `model_calls` trong T11 để tránh đụng schema DB ngoài scope tích hợp worker.

**Phần làm tay (By hand):** Phúc rà soát tiến độ PA03, cập nhật Issue #40/#41 theo PR #52 và yêu cầu thực hiện T11 trên nền `origin/develop` (`80f25e3`). Assistant thực hiện code/tests/docs và dừng trước khi push/mở PR để chờ Phúc kiểm tra.
