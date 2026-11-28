# Evidence PA04-T08 — Sẵn sàng cho lần chạy held-out

**Thực hiện:** Vượng · **Reviewer:** Vỹ · **Issue:** #61 · **Nhánh:** `feat/pa04-t08-held-out` (tách từ `develop` `5037508`).
**Trạng thái:** đang làm từng bước; mỗi bước được Vượng review rồi mới commit. Chưa push, chưa mở PR.

## 1. Mục tiêu

Rubric PA04 tiêu chí 2 (20 điểm): người chấm build checker image, chạy lệnh checker **một lần** trên held-out set trong container của họ, không có network ngoài một proxy chỉ cho đi tới model host ghi trong README, container bị dừng sau 30 phút, rồi chấm output bằng bản `eval.mjs` của họ. Model được gọi bằng key trong `marking.env` nhóm đính kèm cạnh file zip. Lệnh lỗi, file không hợp lệ (`eval.mjs` exit 2) hoặc bị dừng trước khi ghi file là 0 điểm; không có `marking.env` dùng được thì chạy với model tắt.

T08 bảo đảm lần chạy đó không thất bại vì môi trường.

## 2. Quyết định (Vượng chốt 28/11)

| # | Vấn đề | Chọn |
| --- | --- | --- |
| 1 | Checker đi qua proxy | Đặt `ENV NODE_USE_ENV_PROXY=1` trong checker image; chỉ sửa code client nếu thử thật cho thấy SDK không đi qua proxy |
| 2 | Cách thử proxy ở local | Tự viết proxy CONNECT nhỏ bằng Node trong `scripts/`, chỉ cho đi tới `api.anthropic.com:443`; checker chạy trong mạng Docker `internal`. Không tải image proxy bên ngoài |
| 3 | Truyền key vào container | `docker run --env-file marking.env …`. Quy tắc `AGENTS.md` cấm `--env-file` áp cho container **sandbox** chạy code sinh viên; checker không chạy code sinh viên |
| 4 | Nội dung `marking.env` | Chỉ `MODEL_API_KEY` và `MODEL_TIMEOUT_MS` |
| 5 | Call log khi `unsure` | Ghi thêm `reason` của verdict, không ghi nguyên output của model |

Key cho `marking.env`: Vượng tạo một key riêng (`pa04-held-out-run`) trong workspace Anthropic của nhóm, dùng chung giới hạn chi tiêu của workspace (còn khoảng $4.94 ngày 28/11); thu hồi khi có điểm PA04. Vỹ nộp bài nên nhận `marking.env` qua tin nhắn riêng ngay trước khi nộp. Key không bao giờ nằm trong repo, image, file zip, Issue hay PR.

## 3. Bước 1 — `marking.env` không vào Git và image

**Vấn đề.** `.gitignore` và `.dockerignore` chỉ loại `.env` và `.env.*`; không mục nào khớp `marking.env`. Nếu file nằm trong thư mục repo, `git add .` sẽ đưa key lên repo public và `docker build` sẽ chép key vào build context của checker image.

**Thay đổi.**

- `.gitignore`: thêm `marking.env` (tên không có `/` khớp ở mọi thư mục).
- `.dockerignore`: thêm `marking.env` (gốc context) và `**/marking.env` (mọi thư mục).
- Test `tests/unit/held-out-secrets.test.mjs`: hai file ignore có các dòng trên và không có dòng `!` nào đưa `marking.env` trở lại. Test chỉ đọc file, không gọi `git` hay Docker.

**Kiểm chứng.**

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Test trước khi sửa hai file ignore | Đỏ, 2/2 fail | `step1-red.txt` |
| Test sau khi sửa | 2/2 pass | |
| `git check-ignore -v --no-index marking.env docs/marking.env eval-cases/marking.env` | Cả ba khớp `.gitignore:26:marking.env` | |
| `.env.example` vẫn được Git theo dõi | Có (`git check-ignore` không khớp) | |
| `npm run lint`, `npm run format-check`, `npm run type-check`, `git diff --check` | exit 0 | |
| `npm test` (Node `v24.22.3`, Windows 11) | exit 0: 572 test, 569 pass, 3 skipped (Postgres), 0 fail | |
