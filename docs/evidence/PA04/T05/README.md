# Evidence PA04-T05 — Eval gate trong CI

**Thực hiện:** Phúc (`@BHVPhuc`) · **Reviewer:** Vượng (`@vinny2707`) · **Issue:** #58 · **Nhánh:** `feat/pa04-t05-eval-gate` (tách từ `develop` `1c060f8`) · **PR:** #96.

## 1. Cấu hình workflow và tính chất không thể bypass

Thay đổi tại `.github/workflows/ci.yml` và test `tests/unit/eval-gate-workflow.test.mjs`:

- **Trigger release tag**: bổ sung `'pa4'` và `'pa04*'` vào `on.push.tags` để tag nộp bài PA04 chạy đầy đủ 4 job (`quality-gate`, `postgres-store`, `sandbox-attacks`, `eval-gate`).
- **Fail-closed khi thiếu secret (PR từ fork)**:
  - `MODEL_API_KEY` chỉ lấy từ `${{ secrets.MODEL_API_KEY }}`.
  - Bước `Require MODEL_API_KEY secret (fail closed on fork PRs)` kiểm tra `[ -z "${MODEL_API_KEY}" ]` và thoát với `exit 1` ngay đầu job. PR từ fork không nhận repository secrets nên job fail rõ ràng, không xanh giả.
  - **Quy trình xử lý PR từ fork (ghi cho `PA4.md`)**: maintainer đọc toàn bộ diff của PR từ fork để kiểm tra an toàn (không lộ secret, không sửa eval data/workflow để bypass); nếu hợp lệ, maintainer đẩy nhánh của PR fork lên repo chính để `eval-gate` chạy thật với `secrets.MODEL_API_KEY`.
- **Kiểm tra toàn vẹn dev set ngay trong job**: chạy `(cd leetkob-eval && sha256sum -c ../tests/support/leetkob-eval.sha256 --quiet)` và `node --test tests/unit/leetkob-eval-integrity.test.mjs` trước khi build/chạy checker.
- **Tạo predictions mới trong job bằng model thật**: chạy `node dist/cli/checker.js` với `MODEL_OFF='0'` trên cả `leetkob-eval` và `eval-cases`, xuất `predictions.jsonl` và `call-log.jsonl` vào `$RUNNER_TEMP/eval-gate/`, sau đó chấm cả hai bằng `node leetkob-eval/eval.mjs`. Không đọc bất kỳ file predictions có sẵn nào trong repo.
- **Mọi exit code khác 0 đều làm job fail**: không dùng `continue-on-error`, `|| true` hay `set +e`.

## 2. Kết quả kiểm thử workflow test (test trước, code sau)

| Thời điểm | Lệnh | Kết quả |
| --- | --- | --- |
| Trước khi sửa `.github/workflows/ci.yml` | `node --test tests/unit/eval-gate-workflow.test.mjs` | Đỏ **5/5** (exit 1) |
| Sau khi sửa `.github/workflows/ci.yml` & format | `node --test tests/unit/eval-gate-workflow.test.mjs` | Pass **5/5** (exit 0) |
| Suite và kiểm tra chất lượng trên `feat/pa04-t05-eval-gate` | `npm run lint`, `npm run format-check`, `npm run type-check`, `git diff --check`, `npm test` | Exit 0 (`npm test`: 618 test, 615 pass, 3 skipped Postgres, 0 fail) |

## 3. Lần chạy CI `eval-gate` thật trên GitHub Actions

- **Run 1 (`a7ffa16d36e4d408420cb6d3d32492499cef452f`)**: [#46177013367](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/46177013367) (job `eval-gate` ID `141077894129`, model `anthropic claude-haiku-5-5`, chạy trong 42s) — toàn bộ 4/4 job xanh (`quality-gate`, `eval-gate`, `sandbox-attacks`, `postgres-store`).
- **Run 2 (`9d016f841228e1db42cdd86d699f6e6c18d8a11a`)**: [#46177390862](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/46177390862) (job `eval-gate` ID `141079074416`, 48s) — toàn bộ 4/4 job xanh; `leetkob-eval` PASS (`100.0%` recall, `0` wrongful, `0%` unsure, `$0.010177`), `eval-cases` PASS (`100.0%` recall, `0` wrongful, `0%` unsure, `$0.006083`), tổng `$0.016261` (61/61 calls ok).

| Dataset (Run 1 — `a7ffa16`) | Pairs | Wrongful | Recall | Unsure | `eval.mjs` | Calls (ok / not ok) | Tokens (in / out) | Chi phí |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |
| `leetkob-eval` | 102 | 0 | 100.0% (37/37) | 0.0% (0/102) | `PASS` (exit 0) | 39 (39 / 0) | 68 703 / 6 727 | `$0.010234` |
| `eval-cases` | 49 | 0 | 100.0% (15/15) | 0.0% (0/49) | `PASS` (exit 0) | 22 (22 / 0) | 38 170 / 4 774 | `$0.006204` |
| **Tổng 1 CI run** | **151** | **0** | — | — | **PASS** | **61 (61 / 0)** | **106 873 / 11 501** | **`$0.016438`** |

## 4. Ba lần chạy lặp trên cùng commit (`a7ffa16`)

Chạy liên tiếp 3 lần từ cùng commit `a7ffa16` (`node --env-file=.env dist/cli/checker.js` + `node leetkob-eval/eval.mjs`), lưu toàn bộ `predictions.jsonl`, `call-log.jsonl`, `eval-summary.json`, `eval-report.txt`, `checker-stderr.txt` tại `repeat-runs/run{1,2,3}/{leetkob-eval,eval-cases}/` (đường dẫn máy local thay bằng `<repo>`). Mọi `model_call` đều có `outcome: ok` và provider `requestId` (`req_...`).

### 4.1. `leetkob-eval` (102 cặp: 65 pass, 37 violation)

| Lần chạy | `eval.mjs` | Wrongful | Recall | Unsure | Calls (`ok`) | Tokens (in / out) | Chi phí |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| Run 1 | `PASS` (exit 0) | 0 | 97.3% (36/37) | 1.0% (1/102) | 39 (39) | 68 703 / 6 307 | `$0.010024` |
| Run 2 | `PASS` (exit 0) | 0 | 97.3% (36/37) | 1.0% (1/102) | 39 (39) | 68 703 / 6 172 | `$0.009956` |
| Run 3 | `PASS` (exit 0) | 0 | 100.0% (37/37) | 0.0% (0/102) | 39 (39) | 68 703 / 6 426 | `$0.010083` |

- **Số cặp đổi verdict giữa 3 lần chạy**: **1 / 102** (`dynamic-array/s05` `C2`: `unsure -> unsure -> violation`, không có cặp nào đổi giữa `pass` và `violation`).
- **Recall min – max**: **97.3% – 100.0%**.
- **Unsure rate min – max**: **0.0% – 1.0%**.
- **Wrongful deductions**: **0** ở cả 3 lần.

### 4.2. `eval-cases` (49 cặp: 34 pass, 15 violation)

| Lần chạy | `eval.mjs` | Wrongful | Recall | Unsure | Calls (`ok`) | Tokens (in / out) | Chi phí |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| Run 1 | `PASS` (exit 0) | 0 | 100.0% (15/15) | 0.0% (0/49) | 22 (22) | 38 170 / 4 276 | `$0.005955` |
| Run 2 | `PASS` (exit 0) | 0 | 100.0% (15/15) | 0.0% (0/49) | 22 (22) | 38 170 / 4 908 | `$0.006271` |
| Run 3 | `PASS` (exit 0) | 0 | 100.0% (15/15) | 0.0% (0/49) | 22 (22) | 38 170 / 4 690 | `$0.006162` |

- **Số cặp đổi verdict giữa 3 lần chạy**: **0 / 49**.
- **Recall min – max**: **100.0% – 100.0%**.
- **Unsure rate min – max**: **0.0% – 0.0%**.
- **Wrongful deductions**: **0** ở cả 3 lần.

### 4.3. Tổng hợp 3 lần lặp & chi phí

- **Tổng cặp đổi verdict trên cả 151 cặp**: **1 / 151** (`dynamic-array/s05` `C2`).
- **Chi phí tổng hợp (dev set + case riêng) qua 3 lần chạy local**: `$0.015979` (Run 1), `$0.016227` (Run 2), `$0.016245` (Run 3); trên GitHub Actions CI run `#46177013367`: **`$0.016438`**.

## 5. Branch protection & chứng minh gate đỏ chặn merge

### 5.1. Branch protection đã bật và kiểm chứng (`gh api`)

Đã cấu hình `eval-gate` (cùng `quality-gate`, GitHub Actions `app_id: 15368`) làm **required status check** trên cả hai nhánh bảo vệ:

- **`main`**: `strict: true`, `contexts: ["quality-gate", "eval-gate"]` (`gh api repos/2609-AWAD-23-3/leetkob/branches/main/protection/required_status_checks`).
- **`develop`**: `strict: false`, `contexts: ["quality-gate", "eval-gate"]` (`gh api repos/2609-AWAD-23-3/leetkob/branches/develop/protection/required_status_checks`).

### 5.2. Chứng minh job đỏ khi `eval.mjs` exit ≠ 0 và PR bị chặn merge

- **PR kiểm chứng tạm (đã đóng không merge, đã xoá nhánh)**: [#97](https://github.com/2609-AWAD-23-3/leetkob/pull/97) (`test/pa04-t05-red-gate-check` ➔ `develop`, commit `1c72a30`).
- **Cách thử**: sửa tạm output semantic trong `src/cli/run.ts` thành `unsure` trên nhánh tạm (không sửa `leetkob-eval/`, `eval-cases/` hay `labels.jsonl`).
- **CI Run đỏ**: [#46177996891](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/46177996891) (job `eval-gate` ID `141080959388`):
  - Checker vẫn chạy model thật (`39` calls ok, `$0.010264`), ghi predictions vào `$RUNNER_TEMP/eval-gate/dev-predictions.jsonl`.
  - `node leetkob-eval/eval.mjs` báo `recall 40.5% (15/37) FAIL`, `unsure rate 46.1% (47/102) FAIL`, kết luận `FAIL (recall 40.5% < 90.0%; unsure 46.1% > 20.0%)` và thoát `exit code 1`.
  - Job `eval-gate` dừng với trạng thái `FAILURE` (không chạy step `eval-cases`), và `gh pr view 97` ghi nhận `mergeStateStatus: "BLOCKED"`.
- **Ghi chú**: PR #97 chỉ để chứng minh cơ chế gate đỏ chặn merge cho `T05`; PR bị chặn thật của checker nộp trong `PA4.md` thuộc `PA04-T06` (`#59`), và checklist review của `@vinny2707` còn phần mở PR thử có label sai nếu cần kiểm tra độc lập.
