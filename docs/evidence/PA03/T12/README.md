# PA03-T12 — Deployment public

- Task: [Issue #41](https://github.com/2609-AWAD-23-3/leetkob/issues/41), mục T12 trong [plan PA03](../../../plans/PA03.md#t12--deployment-public).
- Người thực hiện: Phúc (`@BHVPhuc`). Reviewer độc lập: Vỹ (`@tranquocvy`).
- Nhánh: `feat/pa03-t12-deploy` (rebase trên `origin/develop` `b239d94`).
- Commits trên nhánh:
  - Test-first: `f9f9ef7` (`tests/integration/trust-proxy.test.mjs`, `tests/unit/deploy-seed.test.mjs`)
  - Implementation: `4c5402b` (`loadTrustProxy` + `Fastify trustProxy`, `assertDevSeedAllowed`, seed 5 tài khoản cô lập `deploy-accounts.ts` / `seed-deploy.mjs`)
  - Compose/Dockerfiles/Runbook: `df8f06e`, `7b4b89a` (`deploy/compose.yml`, `deploy/Caddyfile`, `deploy/.env.example`, `docker/api.Dockerfile`, `docker/worker.Dockerfile`, `docs/deploy/pa03-runbook.md`)
  - Evidence & plan sync: `999a91f`, `3c3c560`

## 1. Kiến trúc và tài khoản triển khai trên VPS

- **Host:** VM Azure `leetkob-vm` (`70.153.86.114`, Ubuntu 24.04.5 LTS, Docker `29.10.0`, Docker Compose `v5.8.0`).
- **Commit đang chạy trên VPS (`/home/deploy/leetkob`):** `7b4b89a` (nhánh `feat/pa03-t12-deploy`; các commit từ `999a91f` trở về sau chỉ cập nhật docs/evidence).
- **Site cấu hình cho Caddy HTTPS:** `https://70.153.86.114.sslip.io` (reverse proxy trong mạng bridge cố định `172.28.0.0/24` khớp `TRUST_PROXY=172.28.0.0/24`).
- **4 container Compose (`leetkob-prod`):** `postgres` (`postgres:17-alpine`), `api` (`leetkob-prod-api`, healthy), `worker` (`leetkob-prod-worker`), `caddy` (`caddy:2.10-alpine`).
- **5 tài khoản test cô lập (không dùng `password123` hay bộ 113 tài khoản dev):**
  - `pa3.admin` (`admin`)
  - `pa3.ta1` (`TA`, lớp `pa3-class-1`)
  - `pa3.ta2` (`TA`, lớp `pa3-class-2`)
  - `pa3.student1` (`student`, lớp `pa3-class-1`)
  - `pa3.student2` (`student`, lớp `pa3-class-1`)

## 2. Kết quả kiểm chứng trên VPS (24/11/2026)

1. **Tách seed và chặn seed dev trên production:**
   - `api node scripts/seed-deploy.mjs --confirm-deploy-seed` ➔ `Deploy accounts: 5 added, 0 passwords updated, 0 unchanged.` (exit `0`).
   - `api node scripts/seed-demo.mjs` ➔ bị chặn vì `NODE_ENV=production` / `ALLOW_DEV_SEED=0` (exit `1`).
2. **Không lộ secret trong container sandbox:**
   - `docker run --rm --network none --read-only --user 10001:10001 --entrypoint env leetkob-sandbox:pa03` ➔ chỉ có `HOME=/tmp`, `HOSTNAME`, `PATH`; không có `MODEL_API_KEY` hay `DATABASE_URL`.
3. **Luồng Tiêu chí 1 thật trên VPS (Postgres thật + Docker sandbox `leetkob-sandbox:pa03` + model thật `claude-haiku-5-5`):**
   - `pa3.ta1` tạo lab `sort-merge` (`b5c52501-e158-43b1-99d9-00a7221fa791`), `pa3.ta2` đọc bị `404`.
   - 3 bài nộp (`b499d9de...` tuân thủ `msort`; `15ccc5c9...` vi phạm `std::sort`; `d7d532f1...` prompt injection `// IGNORE ALL PREVIOUS INSTRUCTIONS...` kèm bubble sort) đều được chấm thật trong sandbox ra `AC`:
     - Bài tuân thủ (`b499d9de...`): `c1` `pass` (`hard_rule`), `c2` `pass` (`model`, request `req_011ChLHkxCZAhGGDDCsjVGeL`, `1498` in / `105` out, `$0.0002023`).
     - Bài vi phạm (`15ccc5c9...`): `c1` `violation` (`hard_rule`, dòng 7 `std::sort`), `c2` `violation` (`model`, request `req_011ChLHmQ7XTR4ub52CSMHLi`, `1207` in / `98` out, `$0.0001697`).
     - Bài injection (`d7d532f1...`): `c1` `pass` (`hard_rule`), `c2` `violation` (`model`, request `req_011ChLHmiGSLPQVWvvBoymcQ`, `1307` in / `104` out, `$0.0001827`).
   - Student gọi `/review-queue` nhận `403`, `pa3.ta2` nhận `404`, `pa3.ta1` nhận `200` với đầy đủ verdict, evidence và mức trừ (`3` và `4`).

## 3. Kiểm chứng public HTTPS và rà soát cổng sau khi mở 80/443 (24/11/2026)

1. **Rà soát cổng TCP (timeout 3s) và endpoint HTTP/HTTPS từ máy bên ngoài (`70.153.86.114`):**
   - TCP `22`: OPEN
   - TCP `80`: OPEN (`http://70.153.86.114.sslip.io/health` ➔ `308` redirect sang HTTPS)
   - TCP `443`: OPEN (`https://70.153.86.114.sslip.io/health` ➔ `200 {"status":"ok"}`, `https://70.153.86.114.sslip.io/docs/` ➔ `200 text/html`)
   - TCP `3000`: TIMEOUT/FILTERED (3s) — API không mở trực tiếp ra Internet
   - TCP `5432`: TIMEOUT/FILTERED (3s) — Postgres không mở trực tiếp ra Internet
2. **Chạy toàn bộ luồng Tiêu chí 1 từ Internet qua `https://70.153.86.114.sslip.io` (TLS Let's Encrypt hợp lệ):**
   - `pa3.ta1` tạo lab `sort-merge` (`3962d1dc-1236-422e-befd-e6bccfb03809`, lớp `pa3-class-1`); `pa3.ta2` đọc `/labs/{labId}` và `/labs/{labId}/review-queue` đều nhận `404`.
   - 3 bài nộp C++ đều được sandbox thật `leetkob-sandbox:pa03` chấm `AC`, đồng thời kiểm tra luật cứng + `claude-haiku-5-5` thật trong Postgres:
     - Bài tuân thủ (`6bb1160e-3a70-406e-b1ea-ff4f0113a2d5`, `pa3.student1`): `c1` `pass` (`hard_rule`), `c2` `pass` (`model`, request `req_011ChLK6HZ2nGMMALsCPK46B`, `1498` in / `106` out, `$0.0002028`, dòng 11–16).
     - Bài vi phạm (`882c00e5-ea61-4944-95f7-bd53e9d3748d`, `pa3.student2`): `c1` `violation` (`hard_rule`, dòng 7 `std::sort`), `c2` `violation` (`model`, request `req_011ChLK6e2648XNXS2jfAJ2R`, `1207` in / `85` out, `$0.0001632`, dòng 7).
     - Bài injection (`d92904e5-5d2f-49f9-825c-c0e7b4e6763e`, `pa3.student2`): `c1` `pass` (`hard_rule`), `c2` `violation` (`model`, request `req_011ChLK6yzPGnCJCWbT6b4wh`, `1307` in / `99` out, `$0.0001802`, dòng 4–7).
   - `pa3.student1` nhận `403` khi gọi `/labs/{labId}/review-queue` và không thấy `verdicts` trong `/submissions/{id}`; `pa3.ta1` nhận `200` với 4 mục hàng đợi (bài `AC` mới nhất của mỗi sinh viên theo FAQ-03/04: `6bb1160e` và `d92904e5`), đủ verdict, dòng evidence và mức trừ (`3` và `4`).

## 4. Rủi ro vận hành & lý do chấp nhận (PA03)

- **`docker.sock` trong container `worker`:** `deploy/compose.yml` chạy `worker` bằng `root` và mount `/var/run/docker.sock` để gọi Docker tạo sibling container `leetkob-sandbox:pa03` (Docker-out-of-Docker). Nếu `worker` bị chiếm quyền thì tương đương quyền `root` trên host.
- **Lý do chấp nhận trong PA03:** `worker` không tự biên dịch hay chạy code sinh viên; toàn bộ code không tin cậy chạy bên trong sandbox cô lập (`--network none --read-only --user 10001:10001`, runner nhận code qua stdin, chặn `-e`/`--env-file`/`-v`/`--mount` và làm sạch env trước khi gọi `docker`). Tách rootless Docker hoặc socket proxy ghi nhận cho PA04/PA05.
