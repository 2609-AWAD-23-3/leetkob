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

## 4. Bước 2 — Checker đi qua proxy tới model host

**Vấn đề.** Container của người chấm chỉ ra ngoài được qua proxy. SDK model (`@anthropic-ai/sdk` 1.12.0) dùng `fetch` toàn cục của Node; `fetch` chỉ đọc `HTTPS_PROXY` khi bật `NODE_USE_ENV_PROXY=1`. Checker image trước bước này không bật cờ đó.

**Script thử** (`npm run test:held-out-proxy`, file `scripts/test-held-out-proxy.mjs` và `scripts/held-out-proxy.mjs`):

1. Build checker image.
2. Tạo mạng Docker `--internal` (không ra được Internet).
3. Chạy proxy CONNECT tự viết trong một container dùng chính base image của checker (`node:24.22.3-bookworm-slim`, không tải image khác), nối cả mạng internal lẫn mạng thường, chỉ cho CONNECT tới `api.anthropic.com:443`; mỗi kết nối ghi một dòng log (host, cho phép hay từ chối), không ghi nội dung.
4. Kiểm môi trường thử: từ mạng internal không gọi thẳng được model host; qua proxy thì host khác bị từ chối.
5. Chạy checker như lệnh sẽ ghi trong README: chỉ `--env-file <file env>` và `-e HTTPS_PROXY=…`; **không** truyền `NODE_USE_ENV_PROXY`, để kiểm đúng cấu hình trong image.
6. Chấm bằng `leetkob-eval/eval.mjs`; kiểm call log (mọi call `ok`, có request id `req_…`) và log proxy (chỉ có kết nối tới model host được cho qua).
7. Dọn container, mạng và file env tạm.

Key: mặc định script lấy `MODEL_API_KEY` và `MODEL_TIMEOUT_MS` từ `.env` vào một file env tạm (quyền 600, xoá khi xong) và không in giá trị; `--env-file marking.env` dùng đúng file sẽ nộp (bước 6).

**Thay đổi.** `docker/checker.Dockerfile` thêm `ENV NODE_USE_ENV_PROXY=1` ở image chạy. Không có `HTTPS_PROXY` thì cờ không làm gì.

**Kết quả** (`eval-cases`, model `claude-haiku-5-5`, key dev trong `.env`):

| Lần chạy | Image | Kết quả script | Model call | `eval.mjs` | Evidence |
| --- | --- | --- | --- | --- | --- |
| Trước khi sửa | Chưa có cờ | `FAIL` | 22 call đều `provider_error`, 0 request id; proxy không thấy kết nối nào tới model host | exit 1: recall 26.7%, unsure 55.1% (bằng mức model tắt) | `step2-red/` |
| Sau khi sửa | Có cờ | `PASS` | 22 call `ok`, 22 request id; proxy chỉ cho qua `api.anthropic.com:443`, từ chối 1 kết nối (lần thử host khác) | exit 0 `PASS`: 0 khấu trừ sai, recall 100%, unsure 0%; checker 14 s; $0.005516 | `step2-green/` |

Lần chạy đỏ cho thấy rủi ro thật: checker vẫn exit 0 và ghi file hợp lệ, nhưng mọi constraint ngữ nghĩa thành `unsure`, nên nếu nộp image cũ, lần chạy held-out của người chấm sẽ ra kết quả như model tắt.

**Ghi chú:**

- Có hai lần chạy xanh trước lần trong bảng, cùng image: lần đầu dòng kiểm "proxy từ chối host khác" in chi tiết lỗi không rõ nghĩa (`0`), nên script được sửa để in thông điệp lỗi; lần hai, sau đó lint yêu cầu đổi một kiểm tra `^req_` bằng regex sang `startsWith` (cùng ý nghĩa). Lần trong bảng chạy bằng đúng script được commit. Lần hai có 1 cặp `unsure` (`rotate-array/s04` C3, cause `model_unsure`: model tự trả `unsure`, không phải guardrail), recall 93.3%, vẫn `PASS`. Log đỏ trong `step2-red/` tạo bằng script trước hai lần sửa này; phần kiểm tra không đổi.
- `npm run test:checker-image` (4 cách chạy image với model tắt) vẫn đạt sau khi thêm cờ.
- Một lần `npm test` có test `application logger redacts authorization and request bodies` (`tests/integration/auth-runtime.test.mjs`) lỗi `spawnSync … ETIMEDOUT` ngay sau khi build Docker; chạy lại thì đạt (572 test, 569 pass, 3 skipped). Test này không liên quan tới thay đổi của bước 2.
- Lint, format-check, type-check, `git diff --check` exit 0.

**Sau review của Vượng (bước 2, trước commit).**

- **Rủi ro lộ key khi nén repo.** Requirement bắt nộp zip cả repo kèm `.git`, `marking.env` để cạnh zip. `.env` (key dev) và `marking.env` đều nằm ở thư mục gốc; nén nguyên thư mục làm việc sẽ đưa cả hai vào zip, `.gitignore` không chặn được. README (mục "Lần chạy held-out") ghi cách nén từ một bản clone sạch ở tag `pa4` và hai lệnh kiểm nội dung zip, dành cho T10. Đã thử trên một bản clone local: zip tạo bằng `tar.exe` của Windows là zip thật (header `PK`, .NET đọc được 3 074 mục), có `.git` (2 326 mục dưới `leetkob/.git/`), không có `.env` hay `marking.env`. `tar` trong Git Bash là GNU tar 1.35 và tạo **file tar** dù đặt đuôi `.zip`, nên README chỉ dùng `tar.exe` trong PowerShell.
- **Comment trong Dockerfile đã cũ.** Ví dụ ở đầu file chỉ có cách chạy khi tắt model, và một comment ghi người chấm chạy với `--network none`. Đã thêm ví dụ chạy qua proxy (`--env-file marking.env -e HTTPS_PROXY=…`) và sửa comment: lần chạy held-out chỉ ra ngoài qua proxy, lần chạy model tắt dùng `--network none`.
- **README chưa có hướng dẫn held-out.** Thêm mục "Lần chạy held-out (PA04)" trong phần checker: model host `api.anthropic.com:443`, nội dung `marking.env`, lệnh Linux và PowerShell qua proxy, cách chạy khi không có key (`MODEL_OFF=1`), vì sao `--env-file` dùng được cho checker mà bị cấm cho sandbox, lệnh `npm run test:held-out-proxy`. Dòng hướng dẫn cũ "truyền key bằng `-e MODEL_API_KEY`" cập nhật thêm `--env-file marking.env`. Thời gian chạy và concurrency bổ sung ở bước 4.
- **Lệnh clone chạy trong repo sẽ lồng thư mục.** Vượng nhắc `git clone … leetkob` chạy ngay trong repo sẽ tạo `leetkob/leetkob`; README ghi thêm là chạy ở thư mục ngoài repo, và tag `pa4` do T10 tạo trước khi nộp (chưa tồn tại lúc này là bình thường).
