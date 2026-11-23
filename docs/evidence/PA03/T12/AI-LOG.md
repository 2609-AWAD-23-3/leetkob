# Đầu vào AI-log — PA03-T12

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 2026-11-23/24 — Chuẩn bị cấu hình, bảo vệ seed/proxy và triển khai lên VPS Azure

**Công cụ (Tool):** Antigravity assistant (Planner + Execution), Node `v24.22.1`, Docker `29.10.0`, Docker Compose `v5.8.0` trên VM Azure `70.153.86.114`.

**Yêu cầu (Asked for):** Triển khai PA03-T12 (Issue #41): cấu hình `trustProxy` theo IP/CIDR của reverse proxy, tách và chặn seed dev `password123` trên production, viết Compose + Dockerfiles + Caddyfile HTTPS + runbook, đẩy lên VPS `70.153.86.114` và chạy kiểm chứng Tiêu chí 1 thật với `MODEL_API_KEY`.

**Phần giữ lại (Kept):** Tái sử dụng `leetkob-sandbox:pa03` từ T05, worker fail-closed từ T11 và host/model `claude-haiku-5-5` từ ADR 0001 (T02). Không lưu key/password trong repo hay in ra log; chỉ nạp `deploy/.env` qua stdin SSH với quyền `chmod 600`.

**Phần điều chỉnh (Changed):**
- Viết test-first (`358fa2a`) cho `loadTrustProxy` (từ chối `true`/`*`/`0.0.0.0/0`/`::/0`), bucket IP riêng qua proxy tin cậy và chặn giả mạo `X-Forwarded-For` trực tiếp, cùng test `assertDevSeedAllowed` / `loadDeploySeedAccounts`.
- Triển khai `loadTrustProxy` trong `src/shared/config.ts` nối vào `src/api/{app,runtime}.ts`; thêm `assertDevSeedAllowed` vào `src/db/seeds/demo-accounts.ts` & `scripts/seed-demo.mjs`; tách seed 5 tài khoản PA03 vào `src/db/seeds/deploy-accounts.ts` & `scripts/seed-deploy.mjs` (`--confirm-deploy-seed`).
- Trong `docker/worker.Dockerfile`, thay `apt-get install docker.io` bằng `COPY --from=docker:29-cli /usr/local/bin/docker /usr/local/bin/docker` để CLI khớp Docker Engine `29.10.0` trên VM và build gọn nhẹ hơn.
- Deploy 4 container (`postgres`, `api`, `worker`, `caddy`) lên `70.153.86.114`, xác minh `seed-demo.mjs` bị chặn (`exit 1`), sandbox không có secret (`env`), và chạy thật luồng Tiêu chí 1 (lab `sort-merge` + 3 bài C++ qua Docker sandbox + `claude-haiku-5-5` cho 3 `requestId` thật `req_...`).

**Phần không chọn (Rejected):**
- Không cho phép `TRUST_PROXY=true` hoặc `0.0.0.0/0` để tránh tin mù quáng `X-Forwarded-For` từ client ngoài Internet.
- Không mở cổng 3000 hay 5432 trực tiếp ra ngoài VM trong `deploy/compose.yml`; chỉ Caddy giữ cổng 80/443 trước `api`.

**Phần làm tay (By hand):** Phúc cung cấp `MODEL_API_KEY` trong `.env` local (gitignored) và chỉ đạo rebase nhánh T12 lên `develop` (`b239d94`) rồi triển khai lên VPS. Assistant thực hiện code/tests/compose, deploy và xác minh trên VPS, ghi nhận blocker mở cổng 80/443 Azure NSG.
