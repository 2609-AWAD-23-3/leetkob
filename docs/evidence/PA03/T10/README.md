# Evidence PA03-T10 — Checker command, case riêng và dev run

**Thực hiện:** Vượng · **Reviewer:** Phúc · **Issue:** #39 · **Nhánh:** `feat/pa03-t10-checker` (tách từ `origin/develop` `80f25e3`).
**Trạng thái:** đã commit trên nhánh `feat/pa03-t10-checker` và mở [PR #81](https://github.com/2609-AWAD-23-3/leetkob/pull/81) vào `develop`; CI 3 job (`quality-gate`, `postgres-store`, `sandbox-attacks`) xanh tại `8d2c628`. Vỹ đã review (request changes chỉ về tài liệu, đã sửa); chờ review của Phúc. Dev run model thật đã chạy ngày 23/11/2026 (mục 6).

## 1. Quyết định thiết kế (Vượng chốt 23/11/2026)

| # | Quyết định | Chọn | Ghi chú |
| --- | --- | --- | --- |
| A | Verdict semantic khi `MODEL_OFF=1` | **A2**: thêm `UnsureCause` `model_off` | Domain, `UNSURE_CAUSES`, migration mới `0006_unsure_cause_model_off` (đổi CHECK, không sửa `0001`), OpenAPI, `docs/contract/review-queue.md`. File prediction vẫn chỉ có `unsure`; cause nằm trong call log của checker. |
| B | Danh tính khi dataset không có sinh viên | **B3**: identity có kiểu ở T08 | `getIdentity` trả `{kind:'student', parts}` (hoặc mảng chuỗi như cũ, hiểu là student, vẫn fail-closed) hoặc `NO_STUDENT_IDENTITY_DATASET` = `{kind:'none', reason:'dataset'}`. Mọi hình dạng khác bị từ chối trước khi dựng prompt. `PromptRecord.identity` ghi `student` hoặc `none:dataset`. Không có cờ boolean. |
| C | Lỗi khi bật model | **C1** | Thiếu key, không bật `MODEL_OFF`: exit 2, không ghi file. Lỗi provider ở một bài: các cặp semantic của bài đó `unsure`, call log ghi `outcome: provider_error` và `unsureCause: provider_error`, chạy tiếp. Giá trị `provider_error` chỉ có trong call log của checker (kiểu `CheckerUnsureCause`), không thuộc `UnsureCause` của domain/DB vì worker không bao giờ ghi nó thành verdict (review của Vượng, hướng A chốt 23/11; bản trước ghi `unsureCause: null` kèm trường `cause` riêng). Lỗi khác (cấu hình, bug) dừng lần chạy. |
| D | Interface lệnh | **D1**, sửa theo review | `checker <dataset> [--out <file> \| --out -] [--call-log <file>] [--concurrency <n>]`, nhận cả `--data`. Không có `--out` (hoặc `--out -`): prediction ra stdout, log ra stderr (Vượng chốt 23/11 sau review P1; bản đầu bắt buộc `--out`). Thứ tự output cố định: bài → solution → constraint. |
| E | Image chạy bằng user nào | root, kèm stdout | Vượng chốt 23/11 để không mất điểm tiêu chí 6: lệnh README dùng stdout (container không ghi file, chạy được với mọi `--user`, `--cap-drop ALL`, `--read-only`); image vẫn chạy bằng root để người tự mount `/out` (thư mục thuộc root hoặc user khác) vẫn ghi được. Còn hỏng một trường hợp: tự mount thư mục thuộc user khác **và** `--cap-drop ALL` (checker báo `EACCES`, exit khác 0). |

Ảnh hưởng tới task khác: B3 sửa code T08 của Vỹ (`src/pipeline/model/`), A2 sửa domain/DB của T03. Toàn bộ test của T08 (`tests/unit/model-*.test.*`, 117 test kể cả test mới) vẫn xanh, không đổi kỳ vọng nào. T11 khi nối worker: tiếp tục trả danh tính sinh viên từ DB (mảng hoặc `{kind:'student'}`), không dùng `NO_STUDENT_IDENTITY_DATASET`.

## 2. File chính

| Phần | File |
| --- | --- |
| Lệnh | `src/cli/checker.ts` (tham số, `MODEL_OFF`, exit code), `src/cli/dataset.ts` (chỉ đọc `statement.md`, `constraints.json`, `solutions/*.cpp`), `src/cli/run.ts` (hard rules → model/`model_off`, call log, concurrency) |
| B3 | `src/pipeline/model/identity.ts`, `types.ts`, `evaluate.ts`, `index.ts` |
| A2 | `src/shared/domain/verdicts.ts`, `src/db/validation.ts`, `src/db/migrations/0006_unsure_cause_model_off.ts`, `src/api/modules/api-docs/review-openapi.ts`, `docs/contract/review-queue.md` |
| Docker | `docker/checker.Dockerfile` (multi-stage `node:24.22.3-bookworm-slim`, chạy bằng root trong container theo quyết định E, không secret), `.dockerignore` (loại `.env`, `.git`, `node_modules`, dữ liệu) |
| Dev set | `leetkob-eval/` (128 file, commit `552c811db2d35a23d641bc4fdffc1ac120be1a28`), `.gitattributes` `leetkob-eval/** -text`, `.prettierignore` `leetkob-eval/`, manifest `tests/support/leetkob-eval.sha256` |
| Case riêng | `eval-cases/` (bài `digit-sum`, 6 solution, 12 cặp), `scripts/verify-eval-cases.mjs` |
| Test | `tests/unit/{leetkob-eval-integrity,model-identity,checker-run,eval-cases}.test.mjs`, `tests/integration/{checker-cli,checker-eval}.test.mjs`, thêm vào `store-conformance.mjs`, `review-queue.test.mjs`, `postgres-store.test.mjs`; helper `tests/support/{checker-dataset,no-network}.mjs` |

## 3. Dev set nguyên byte

Máy dev bật `core.autocrlf=true`: `git checkout`/`git archive` của repo dev set đổi sang CRLF và SHA sai (`eval.mjs` thành `fd2a2ce8…`). Vì vậy dev set được xuất bằng `git cat-file blob 552c811:<path>` cho từng file (không chuyển eol) và manifest SHA-256 sinh từ cùng các blob đó. `eval.mjs` `c836edd8713521bb…`, `labels.jsonl` `262cda7b0ef5612e…` khớp rubric. `tests/unit/leetkob-eval-integrity.test.mjs` so từng file trong `leetkob-eval/` với manifest và báo file lạ; `-text` giữ byte khi commit/checkout.

## 4. Test trước, log đỏ (`red/`)

Log đã bỏ tên máy và đường dẫn local (`<repo>`, `<home>`, `<user>`).

| Log | Test | Lý do đỏ |
| --- | --- | --- |
| `01-devset-integrity.log` | so SHA dev set | `ENOENT`: chưa có `leetkob-eval/` |
| `02-unsure-cause-model-off.log` | store in-memory lưu cause `model_off` | `TypeError` từ validation. Test OpenAPI trong log này đặt sai chỗ (`api-docs.test.mjs` không bật review docs nên đỏ vì `ReviewItem` không tồn tại); đã chuyển sang `review-queue.test.mjs` và chạy đỏ lại ở `02b` |
| `02b-openapi-model-off.log` | OpenAPI liệt kê `model_off` | enum thiếu `model_off` (chạy trên bản đã gỡ tạm `model_off` khỏi OpenAPI, sau đó trả lại) |
| `03-unsure-cause-model-off-postgres.log` | store Postgres lưu `model_off` | CHECK `verdicts_unsure_cause_check` từ chối |
| `04-prompt-identity.log` | identity có kiểu | chưa có export `NO_STUDENT_IDENTITY_DATASET` |
| `05-checker.log` | lõi checker, CLI, dev set qua `eval.mjs` | chưa có `dist/cli/dataset.js`, CLI chưa làm gì |
| `06-eval-cases.log` | layout, label/tag, chấm eval-cases | chưa có `eval-cases/` |
| `07-checker-image-root-out.log` | `scripts/test-checker-image.mjs`: image ghi vào `/out` thuộc root | `EACCES`, checker exit 1, không có file (image cũ chạy bằng user `node`) |
| `08-provider-error-cause.log` | call log khi provider lỗi ghi lý do ở `unsureCause` | `unsureCause` là `null` (lý do nằm ở trường `cause` riêng) |
| `09-checker-stdout-cli.log` | không có `--out` / `--out -` thì prediction ra stdout | thiếu `--out` là lỗi tham số (exit 2) |
| `10-checker-image-stdout.log` | image: stdout với `--cap-drop ALL --read-only --user 12345:12345`, `--out -`, mount `/out` thuộc root và thuộc user khác | hai cách stdout không ra prediction (exit 2; `--out -` ghi vào một file tên `-` trong container) |

Thay đổi test sau khi đỏ, ghi trung thực:
- `postgres-store.test.mjs`: hai danh sách migration mong đợi thêm `0006_unsure_cause_model_off` (và số dòng 5 → 6) vì contract DB đổi có chủ đích (A2). Không nới assertion nào khác.
- `checker-run.test.mjs`: regex của model giả viết `/s += x/` (dấu `+` chưa escape) nên không khớp code; sửa thành `/s \+= x/`. Đây là lỗi của test, không phải nới kỳ vọng.
- `checker-cli.test.mjs`: bỏ trường hợp "chỉ có dataset, không `--out` → exit 2" khỏi test lỗi tham số, vì Vượng chốt đổi contract: thiếu `--out` nghĩa là ghi ra stdout (test mới cho hành vi này chạy đỏ ở `09`).
- `checker-run.test.mjs` (lỗi provider): kỳ vọng đổi từ `decision.cause` sang `decision.unsureCause` theo hướng A Vượng chốt (đỏ ở `08`).
- `eval-cases.test.mjs`: trước khi có case, đổi luật "mọi cặp có tag" thành "mọi solution có ít nhất một tag" cho khớp dev set (cặp pass thường có `tags: []`) và rubric ("mỗi case có label và tag").

## 5. Kết quả chạy

Chi tiết lệnh và exit code: `logs/quality-checks.txt`. Tóm tắt bản mới nhất: lint, format-check, type-check, `git diff --check` exit 0; `npm test` có `TEST_DATABASE_URL` 651/651 pass, 0 skip (không có biến này thì ba bộ Postgres tự skip); `npm run test:checker-image` exit 0.

**Model tắt, chạy image như người chấm** (`--network none`, giới hạn memory/pids): `model-off/` (dev set) và `model-off/eval-cases/`. Mỗi thư mục có `predictions.jsonl`, `call-log.jsonl`, `eval-report.txt`, `eval-summary.json`.

| Dataset | `eval.mjs` exit | Wrongful | Recall | Unsure |
| --- | --- | --- | --- | --- |
| dev set (102 cặp) | 1 | 0 | 40.5% (15/37) | 46.1% (47/102) |
| eval-cases (12 cặp) | 1 | 0 | 33.3% (2/6) | 50.0% (6/12) |

Mọi cặp ban-list được hard rules quyết (15/15 vi phạm ban-list của dev set bắt được, đúng dòng và text); mọi cặp semantic là `unsure` với `unsureCause: model_off`, không có model call. Exit 1 do recall và unsure vượt ngưỡng, đúng kỳ vọng khi tắt model; PA03 không có ngưỡng eval. `tests/integration/checker-eval.test.mjs` kiểm lại điều này trong `npm test` (process có preload chặn mọi kết nối network).

**Thư mục output thuộc root (review của Vượng, P1).** Trên Linux, `-v "$PWD/out:/out"` với `out/` chưa có khiến Docker tạo thư mục thuộc root; image cũ chạy bằng user `node` nên báo `EACCES` và không ghi file (Docker Desktop trên Windows không kiểm quyền nên lần chạy ở trên không thấy). `scripts/test-checker-image.mjs` (`npm run test:checker-image`) tái hiện bằng một Docker volume mới thuộc `root:root 755`: đỏ ở `red/07-checker-image-root-out.log`, xanh ở `logs/checker-image.log` sau khi bỏ `USER node` (checker chạy bằng root trong container; chỉ đọc text, người chấm chạy `--network none`). Kết quả trong `model-off/` được tạo bằng image trước bản sửa; logic chấm không đổi nên file prediction giống byte với lần chạy mới bằng lệnh stdout của README (đã `cmp`).

**Ghi ra stdout (Vượng chốt sau khi Claude chỉ ra cách root còn hỏng khi người chấm dùng `--cap-drop ALL` với thư mục thuộc user khác).** Lệnh chính trong README là `docker run ... leetkob-checker /data > predictions.jsonl`: container không ghi file nào. `npm run test:checker-image` chạy 4 cấu hình (stdout với `--cap-drop ALL --read-only --no-new-privileges --user 12345:12345`; `--out -`; mount `/out` thuộc `0:0 755`; mount `/out` thuộc `4242:4242 755`), tất cả checker exit 0, 102 dòng, `eval.mjs` exit 1, và 4 file giống nhau: đỏ `red/10-checker-image-stdout.log`, xanh `logs/checker-image.log`. Thử thêm trên máy dev: redirect `>` của PowerShell ghi file kèm BOM nên `eval.mjs` exit 2; README vì vậy hướng dẫn PowerShell dùng cách mount `--out` (đã thử: `eval.mjs` exit 1).

**Case riêng `eval-cases/`** (bài mới, không chép bài hay code dev set — test kiểm): 6 solution, tag `obvious`, `trap`, `injection`, `disguised` ×2, `style`. Cả 6 Accepted trong sandbox thật của sản phẩm (`g++ -std=c++17 -O2`, 3 test): `logs/verify-eval-cases.log`.

## 6. Dev run model thật (23/11/2026)

Vượng đặt `MODEL_API_KEY` và `MODEL_TIMEOUT_MS=30000` vào `.env` (bị Git ignore); Claude không đọc hay in giá trị key, chỉ kiểm key có mặt. Model `claude-haiku-5-5` (Anthropic, ADR 0001). Lệnh, chạy từ root repo sau `npm run build`:

```sh
node --env-file=.env dist/cli/checker.js leetkob-eval \
  --out docs/evidence/PA03/T10/dev-run/predictions.jsonl \
  --call-log docs/evidence/PA03/T10/dev-run/call-log.jsonl \
  2> docs/evidence/PA03/T10/dev-run/checker-stderr.txt
node leetkob-eval/eval.mjs --data leetkob-eval \
  --predictions docs/evidence/PA03/T10/dev-run/predictions.jsonl \
  --json docs/evidence/PA03/T10/dev-run/eval-summary.json > docs/evidence/PA03/T10/dev-run/eval-report.txt
```

File trong `dev-run/`: `predictions.jsonl` (102 dòng, do checker tạo), `call-log.jsonl` (quyết định từng cặp + mọi model call), `eval-report.txt` và `eval-summary.json` (báo cáo `eval.mjs`, đường dẫn local thay bằng `<repo>`), `checker-stderr.txt`. Chạy thử trước trên case riêng: `dev-run/eval-cases/`.

| Dataset | Call | `eval.mjs` exit | Wrongful | Recall | Unsure | Token in / out | Chi phí |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dev set (102 cặp) | 39 | **1** | **1** | 100% (37/37) | 0% (0/102) | 64 725 / 5 369 | $0.009157 |
| eval-cases (12 cặp) | 6 | 0 | 0 | 100% (6/6) | 0% (0/12) | 8 373 / 607 | $0.001141 |

- **Khấu trừ sai duy nhất:** một cặp của bài `reverse-words`, constraint C2 (semantic, "đảo từng từ tại chỗ"), label `pass`, model trả `violation` (chi tiết trong `eval-report.txt`). Đây là lỗi phán đoán của model; PA03 không có ngưỡng eval nên báo cáo nguyên trạng. Không chỉnh prompt hay rule theo cặp này (AGENTS.md cấm tinh chỉnh theo dev set); xử lý false positive thuộc PA04 (eval làm required check, lấy mẫu TA).
- **39 call, không phải 47:** bài `reverse-recursive` chỉ có hai constraint ban-list, hard rules quyết cả hai nên 8 bài của nó không gọi model. Mỗi bài còn lại một call cho mọi constraint semantic của nó.
- **Call log** (kiểm bằng script, kết quả ghi lại ở đây): 39 call đều `outcome: ok`, có request id của provider (`req_…`, 39 id khác nhau), model, token, thời gian (trung bình 1 876 ms, tối đa 5 205 ms), chi phí, `identity: none:dataset`, `promptSha256`, prompt `system`/`user` đã gửi. Không prompt nào chứa `//` hay `/*` (comment đã bị bỏ trước khi gửi). 55 quyết định `route: hard_rule` đều `modelCalled: false`, và không call nào hỏi model về constraint mà hard rule đã quyết. Không file nào trong `dev-run/` chứa key.
- **Chấm lại:** chạy lại `eval.mjs` trên `predictions.jsonl` đã lưu cho `eval-summary.json` giống hệt (exit 1).
- **Chi phí lab 80 bài:** chi phí trung bình một call trên dev set là $0.009157 / 39 ≈ $0.000235; một lab 80 bài nộp với một call mỗi bài ≈ 80 × $0.000235 ≈ **$0.019**. Đây là số đo được trên dev set với `claude-haiku-5-5`; bài dài hơn hoặc nhiều constraint semantic hơn sẽ tăng token đầu vào.

## 7. Giới hạn và việc còn lại

- Dev run model thật có 1 khấu trừ sai trên dev set (mục 6); PA03 không có ngưỡng eval nên báo cáo nguyên trạng, không chỉnh prompt theo dev set.
- `eval.mjs` của dev set in đường dẫn tuyệt đối ở dòng đầu báo cáo; bản commit đã thay bằng `<repo>`.
- Image checker build toàn bộ `src/` (kể cả API) vì một lần build TypeScript; chỉ entry point checker được chạy. Image chạy bằng root trong container (đổi để ghi được output trên Linux; rủi ro chấp nhận vì checker không chạy code sinh viên).
- Bảng `model_calls` của DB không có cột `identity`; nhãn identity chỉ nằm trong `PromptRecord` và call log của checker.
- Checklist review của Phúc (SHA dev set, `docker run --network none -e MODEL_OFF=1`, chấm lại dev run) để Phúc tự tick.
