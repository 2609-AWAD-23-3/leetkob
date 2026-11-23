# PA03-T12 — Runbook Deploy & Vận hành trên VPS

Tài liệu hướng dẫn triển khai LeeTKOB lên VM Azure `leetkob-vm` (`70.153.86.114`, Ubuntu 24.04.5 LTS, user `deploy` thuộc nhóm `docker`) theo [ADR 0001](../architecture/decisions/0001-host-model-and-spending-cap.md) và [Issue #41](https://github.com/2609-AWAD-23-3/leetkob/issues/41).

## 1. Điều kiện tiên quyết trước khi deploy

1. **PR T11 đã merge vào `develop`** (hoặc deploy từ nhánh/commit đã qua kiểm chứng của T11).
2. **Mở firewall trên Azure NSG** (chủ subscription Azure `@vinny2707` thực hiện trên Azure Portal):
   - Mở inbound TCP cổng **`80`** và **`443`** cho `leetkob-vm` (`70.153.86.114`) để Caddy cấp chứng chỉ TLS Let's Encrypt và phục vụ HTTPS.
3. **Nhận `MODEL_API_KEY`** từ `@tranquocvy` qua kênh riêng (tuyệt đối không gửi qua Git, Issue, PR hay chat nhóm).
4. **Kiểm tra SSH trên máy deploy:**
   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\vps_key" deploy@70.153.86.114
   ```

## 2. Chuẩn bị mã nguồn và sandbox image trên VPS

Trên VPS (bằng user `deploy`):

```bash
git clone https://github.com/2609-AWAD-23-3/leetkob.git ~/leetkob
cd ~/leetkob
git checkout develop && git pull --ff-only origin develop

# Build image sandbox cho C++17 (PA03-T05)
docker build -f docker/sandbox.Dockerfile -t leetkob-sandbox:pa03 docker
```

## 3. Cấu hình môi trường production (`deploy/.env`)

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

Điền đầy đủ giá trị vào `deploy/.env` (file này được `.gitignore` bỏ qua, không bao giờ commit):

- `LEETKOB_SITE`: domain HTTPS trỏ về `70.153.86.114` (nếu chưa mua domain riêng, dùng `70.153.86.114.sslip.io` để Caddy tự cấp TLS hợp lệ).
- `POSTGRES_PASSWORD`: mật khẩu ngẫu nhiên mạnh cho database production (nên chỉ dùng chữ và số, hoặc phải URL-encode nếu chứa ký tự đặc biệt như `@`, `/`, `:` để `DATABASE_URL` trong `compose.yml` không bị sai).
- `TRUST_PROXY`: giữ `172.28.0.0/24` (khớp subnet mạng nội bộ `leetkob_net` nơi Caddy đứng trước `api`).
- `MODEL_API_KEY`: key workspace `leetkob` do `@tranquocvy` gửi qua kênh riêng.
- 5 biến `DEPLOY_ADMIN_PASSWORD`, `DEPLOY_TA1_PASSWORD`, `DEPLOY_TA2_PASSWORD`, `DEPLOY_STUDENT1_PASSWORD`, `DEPLOY_STUDENT2_PASSWORD`: mỗi mật khẩu dài **15–128 ký tự**, tuyệt đối không dùng `password123`.

## 4. Khởi chạy stack và seed 5 tài khoản test

```bash
cd ~/leetkob
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build
```

Kiểm tra container đang chạy và chạy migrate + seed 5 tài khoản test cô lập (chỉ thực hiện trong container `api`, nạp thêm `DEPLOY_*_PASSWORD` qua stdin để không lộ mật khẩu trong dòng lệnh tiến trình `docker compose exec` trên host; `DATABASE_URL` đã có sẵn từ `compose.yml`):

```bash
docker compose --env-file deploy/.env -f deploy/compose.yml ps

# Chạy migration + seed 5 tài khoản test (bắt buộc --confirm-deploy-seed)
grep '^DEPLOY_.*_PASSWORD=' deploy/.env | docker compose --env-file deploy/.env -f deploy/compose.yml exec -T api \
  sh -c 'set -a; . /dev/stdin; set +a; exec node scripts/seed-deploy.mjs --confirm-deploy-seed'
```

### Kiểm tra bảo vệ seed dev và sandbox

- Chạy thử `db:seed` trong container `api` phải **bị chặn** (`NODE_ENV=production`, `ALLOW_DEV_SEED=0`):
  ```bash
  docker compose --env-file deploy/.env -f deploy/compose.yml exec api node scripts/seed-demo.mjs
  # Kỳ vọng: báo lỗi "Development seed is blocked in production environments." và thoát mã 1
  ```
- Kiểm tra container sandbox không nhận bất kỳ secret nào khi chạy thật (`MODEL_API_KEY`, `DATABASE_URL`):
  ```bash
  docker run --rm --network none --read-only --user 10001:10001 --entrypoint env leetkob-sandbox:pa03
  # Kỳ vọng: không có MODEL_API_KEY hay DATABASE_URL
  ```

## 5. Kiểm tra luồng Tiêu chí 1 & `trustProxy`

1. Truy cập `https://<LEETKOB_SITE>/health` (kỳ vọng `200 {"status":"ok"}`) và `https://<LEETKOB_SITE>/docs/`.
2. Login `pa3.ta1` tạo lab `sort-merge` (`POST /classes/pa3-class-1/labs`) với 2 test và 2 constraints (1 ban-list `std::sort`, 1 semantic merge sort).
3. Login `pa3.student1`, `pa3.student2` nộp 3 bài (tuân thủ, vi phạm, prompt injection) qua `POST /labs/{labId}/submissions`; theo dõi worker log (`docker compose -f deploy/compose.yml logs -f worker`) thấy bài chuyển `queued` → `judged`, student đọc `judgeResult` nhưng bị chặn `403` ở `/review-queue`; `pa3.ta2` nhận `404`; `pa3.ta1` thấy đủ verdict + evidence + mức trừ ở `/labs/{labId}/review-queue`.
4. Kiểm chứng `trustProxy`: gọi từ hai IP khác nhau hoặc qua proxy không lặp chung bucket rate-limit, và gửi header `X-Forwarded-For` giả mạo trực tiếp không thể vượt giới hạn login sai.

## 6. Khởi động lại, cập nhật và sao lưu

```bash
# Xem log
docker compose --env-file deploy/.env -f deploy/compose.yml logs -f api worker

# Khởi động lại sau khi cập nhật code hoặc .env (thống nhất cùng nhánh develop ở mục 2)
git pull --ff-only origin develop
docker build -f docker/sandbox.Dockerfile -t leetkob-sandbox:pa03 docker
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build

# Sao lưu Postgres
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T postgres \
  pg_dump -U leetkob leetkob > backup-$(date +%Y%m%d-%H%M%S).sql
```
