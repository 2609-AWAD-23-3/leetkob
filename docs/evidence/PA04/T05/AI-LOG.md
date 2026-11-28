# AI log — PA04-T05

## 2026-11-29 — Eval gate trong CI, test trước và 3 lần chạy lặp

Tool: Antigravity (Gemini 4).
Asked for: Phúc yêu cầu thực hiện `PA04-T05` theo `docs/plans/PA04.md` và Issue `#58`: viết test workflow trước, thêm job `eval-gate` vào `.github/workflows/ci.yml` chạy checker bằng model thật ngay trong CI (trên cả `leetkob-eval` và `eval-cases`), kiểm SHA-256 dev set, xử lý fail-closed với PR từ fork, chạy 3 lần lặp đo ổn định và chi phí.
Kept:
- Tách `eval-gate` thành job riêng chạy trên `ubuntu-latest`, lấy `MODEL_API_KEY` từ repo secret và fail ngay bằng `exit 1` nếu biến rỗng (PR từ fork).
- Kiểm SHA-256 dev set bằng cả `sha256sum -c` và `tests/unit/leetkob-eval-integrity.test.mjs` để chặn cả sửa byte lẫn thêm file lạ trong `leetkob-eval/`.
- Sinh predictions và call log vào `$RUNNER_TEMP/eval-gate/`, chấm bằng `leetkob-eval/eval.mjs` mà không dùng `continue-on-error`, `|| true` hay `set +e`.
Changed:
- Tạo `tests/unit/eval-gate-workflow.test.mjs` trước (đỏ 5/5 trước khi sửa `ci.yml`).
- Cập nhật `.github/workflows/ci.yml`: thêm tag `'pa4'`, `'pa04*'` và job `eval-gate`.
- Mở PR #96 trên commit `a7ffa16`: CI run `#46177013367` pass 4/4 job (`eval-gate` tốn `$0.016438`, recall 100% trên cả hai tập).
- Chạy 3 lần lặp trên cùng commit `a7ffa16`, lưu toàn bộ artifact vào `docs/evidence/PA04/T05/repeat-runs/` (đã thay đường dẫn local thành `<repo>`): ghi nhận 1/151 cặp đổi verdict (`dynamic-array/s05` `C2` dao động `unsure` -> `unsure` -> `violation`, không wrongful deduction).
Rejected:
- Regex kiểm tra lệnh trong `tests/unit/eval-gate-workflow.test.mjs` bản đầu chỉ khớp khoảng trắng `\s+`, dẫn tới fail sai khi `.github/workflows/ci.yml` ngắt dòng bằng `\` ở step chạy `eval.mjs`: đã sửa bằng cách nối lại `\\\r?\n\s*` trước khi kiểm, giữ nguyên định dạng dễ đọc của YAML.
- Bản đầu `eval-gate-workflow.test.mjs` và script 3 lần lặp tạo file với CRLF trên Windows làm `prettier --check .` báo lỗi (file `.prettierrc.json` quy định `endOfLine: lf`): chuẩn hoá LF bằng Prettier/script và chạy lại `npm run format-check` exit 0.
- Script tổng hợp 3 lần lặp ban đầu đọc nhầm `evalJson.metrics.recall` trong khi `eval.mjs` xuất `recall` ở top-level; sửa script đọc đúng schema của `eval-summary.json` mà không cần chạy lại model.
By hand: Phúc tự tạo và thêm `MODEL_API_KEY` vào GitHub Repository Secrets, kiểm tra đối chiếu tiến độ và yêu cầu giải thích rõ quy trình để phục vụ vấn đáp. Assistant viết code/test/evidence, chạy kiểm tra local, theo dõi CI và tổng hợp số liệu.
