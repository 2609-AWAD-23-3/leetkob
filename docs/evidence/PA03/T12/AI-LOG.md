# Đầu vào AI-log — PA03-T12

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 2026-11-23/24 — Chuẩn bị cấu hình, bảo vệ seed/proxy và triển khai lên VPS Azure

**Công cụ (Tool):** Antigravity assistant (Planner + Execution), Node `v24.22.1`, Docker `29.10.0`, Docker Compose `v5.8.0` trên VM Azure `70.153.86.114`.

**Yêu cầu (Asked for):** Triển khai PA03-T12 (Issue #41): cấu hình `trustProxy` theo IP/CIDR của reverse proxy, tách và chặn seed dev `password123` trên production, viết Compose + Dockerfiles + Caddyfile HTTPS + runbook, đẩy lên VPS `70.153.86.114` và chạy kiểm chứng Tiêu chí 1 thật với `MODEL_API_KEY`.

**Phần giữ lại (Kept):** Tái sử dụng `leetkob-sandbox:pa03` từ T05, worker fail-closed từ T11 và host/model `claude-haiku-5-5` từ ADR 0001 (T02). Không lưu key/password trong repo hay in ra log; chỉ nạp `deploy/.env` qua stdin SSH với quyền `chmod 600`.

**Phần điều chỉnh (Changed):**
- Viết test-first (`f9f9ef7`) cho `loadTrustProxy` (từ chối `true`/`*`/`0.0.0.0/0`/`::/0`), bucket IP riêng qua proxy tin cậy và chặn giả mạo `X-Forwarded-For` trực tiếp, cùng test `assertDevSeedAllowed` / `loadDeploySeedAccounts`.
- Triển khai `loadTrustProxy` trong `src/shared/config.ts` nối vào `src/api/{app,runtime}.ts`; thêm `assertDevSeedAllowed` vào `src/db/seeds/demo-accounts.ts` & `scripts/seed-demo.mjs`; tách seed 5 tài khoản PA03 vào `src/db/seeds/deploy-accounts.ts` & `scripts/seed-deploy.mjs` (`--confirm-deploy-seed`).
- Trong `docker/worker.Dockerfile`, thay `apt-get install docker.io` bằng `COPY --from=docker:29-cli /usr/local/bin/docker /usr/local/bin/docker` để CLI khớp Docker Engine `29.10.0` trên VM và build gọn nhẹ hơn.
- Deploy 4 container (`postgres`, `api`, `worker`, `caddy`) lên `70.153.86.114`, xác minh `seed-demo.mjs` bị chặn (`exit 1`), sandbox không có secret (`env`), và chạy thật luồng Tiêu chí 1 (lab `sort-merge` + 3 bài C++ qua Docker sandbox + `claude-haiku-5-5` cho 3 `requestId` thật `req_...`).

**Phần không chọn (Rejected):**
- Không cho phép `TRUST_PROXY=true` hoặc `0.0.0.0/0` để tránh tin mù quáng `X-Forwarded-For` từ client ngoài Internet.
- Không mở cổng 3000 hay 5432 trực tiếp ra ngoài VM trong `deploy/compose.yml`; chỉ Caddy giữ cổng 80/443 trước `api`.

**Phần làm tay (By hand):** Phúc cung cấp `MODEL_API_KEY` trong `.env` local (gitignored), chỉ đạo rebase nhánh T12 lên `develop` (`b239d94`) và điều phối mở cổng 80/443 Azure NSG; Vượng mở NSG ports 80/443 trên Azure. Assistant thực hiện code/tests/compose, deploy và xác minh cả nội bộ lẫn public HTTPS trên VPS.

## 2026-11-24 — Kiểm chứng cổng và chạy lại Tiêu chí 1 qua public HTTPS

**Công cụ (Tool):** Antigravity assistant (Execution), PowerShell TCP/HTTPS port checks + Node script qua `https://70.153.86.114.sslip.io`, SSH kiểm tra bảng `submissions`/`verdicts`/`model_calls` trên VPS Postgres.

**Yêu cầu (Asked for):** Kiểm tra lại các cổng với timeout và chạy lại luồng Tiêu chí 1 qua URL public HTTPS sau khi Azure NSG đã mở cổng `80` và `443`.

**Phần giữ lại (Kept):** Cấu hình Caddy HTTPS `70.153.86.114.sslip.io`, không mở cổng `3000`/`5432` ra Internet, giữ `TRUST_PROXY=172.28.0.0/24` và 5 tài khoản deploy cô lập.

**Phần điều chỉnh (Changed):**
- Rà soát cổng TCP (timeout 3s): `22`/`80`/`443` OPEN (`HTTP` chuyển hướng `308` -> `HTTPS /health` `200`, `/docs/` `200`), còn `3000`/`5432` TIMEOUT/FILTERED.
- Chạy hết luồng Tiêu chí 1 từ bên ngoài qua `https://70.153.86.114.sslip.io` (lab `3962d1dc-1236-422e-befd-e6bccfb03809`, 3 bài `AC` trong Docker sandbox + `claude-haiku-5-5` cho 3 `requestId` mới `req_011ChLK6HZ2nGMMALsCPK46B`, `req_011ChLK6e2648XNXS2jfAJ2R`, `req_011ChLK6yzPGnCJCWbT6b4wh`; RBAC `403`/`404`/`200` khớp; Postgres ghi đủ 6 verdict và 3 bản ghi `model_calls`).
- Gỡ blocker NSG và hoàn tất checklist thực hiện trong [Evidence T12](./README.md) và [plan PA03](../../../plans/PA03.md#t12--deployment-public).
- Xử lý review PR #82 của `@tranquocvy`: chuẩn hóa hash commit sau rebase (`f9f9ef7`, `4c5402b`, `df8f06e`, `7b4b89a`, `999a91f`, `3c3c560`), đồng bộ trạng thái PR #82 trong plan, thống nhất nhánh `develop` ở [runbook](../../../deploy/pa03-runbook.md), tránh lộ mật khẩu seed qua `-e` trong `docker compose exec`, và bổ sung ghi chú rủi ro `docker.sock` trong container `worker`.

**Phần làm tay (By hand):** Vượng mở cổng `80`/`443` trên Azure NSG; Phúc yêu cầu test lại cổng với timeout và chạy kiểm chứng lại trên deployment.
