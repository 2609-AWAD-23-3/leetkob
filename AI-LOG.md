# AI-LOG — PA03

Hợp nhất từ các bản ghi theo task trong `docs/evidence/PA03/T*/AI-LOG.md` (bản đầy đủ, ghi ngay khi làm). Đây không phải transcript. Mỗi mục ghi công cụ, phần việc, phần giữ lại, phần nhóm sửa hoặc bác, và phần người làm. AI-LOG của PA02 nằm ở tag `pa2`.

## Công cụ đã dùng

| Công cụ                                          | Phần việc                                                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code (desktop app)                        | Plan và Issues (T01), host/model (T02), dữ liệu/Postgres (T03), hard rules (T07), model (T08), review queue (T09), checker và dev run (T10), review PR cho Vỹ, hồ sơ (T13) |
| Codex                                            | Skeleton (T00), auth/lab/nộp bài (T04)                                                                                                                                     |
| Antigravity assistant (Gemini)                   | Sandbox (T05), queue/worker (T06), tích hợp (T11), deployment (T12)                                                                                                        |
| GitHub CLI, Docker, Azure Portal, Claude Console | PR/Issue, chạy Postgres/sandbox, dựng VM, đặt spending cap (người làm tay)                                                                                                 |

## Model và chi phí

Sản phẩm gọi `claude-haiku-5-5` (Anthropic), $0.10 / $0.50 cho 1M token input / output, một call cho mỗi bài nộp Accepted còn constraint semantic. Dev run thật trên dev set: 39 call, 64 725 token input, 5 369 token output, $0.009157, tức ≈ $0.000235 một call. Một lab 80 bài: 80 × $0.000235 ≈ **$0.019** (bài dài gấp đôi ≈ $0.038). Phép tính đầy đủ: [README](README.md#model-và-chi-phí). Spending cap: workspace $5/tháng, Auto-reload tắt.

## Lỗi của assistant nhóm bắt được

| Lỗi                                                                                                                                          | Cách phát hiện                                                                    | Xử lý                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T08: che danh tính thay mảnh tên "Mai" ở mọi nơi nên `main` thành `STUDENTn` trong prompt (cùng loại: "Nam"/`namespace`, "Long"/`long long`) | Đọc prompt thật trong call log của lượt gọi model đầu tiên; test offline chưa bắt | Mảnh tên 3–4 chữ chỉ thay khi đứng riêng, không thay trong từ khoá C++; thêm 3 test; giữ log lượt lỗi ở `real-calls-run1-before-fix/` |
| T08: bỏ retry của SDK (`maxRetries: 0`) với lý do sai là retry nhân thời gian chờ                                                            | Review của Vượng trên PR #52                                                      | Test đỏ trước (`f7070f0`), rồi bật `maxRetries: 2` trong cùng deadline (`383d53a`)                                                    |
| T05: mọi exit `137` bị coi là hết memory, bài tự `kill(getpid(), SIGKILL)` bị báo nhầm MLE                                                   | Ca kiểm thử bài tự gửi SIGKILL trong T05                                          | Runner đọc `memory.events` (`oom_kill`) để trả mã riêng; thêm test                                                                    |
| T05: CPU limit chỉ áp cho process chính, cây `fork()` vượt tổng budget                                                                       | Review của Vượng trên PR #46                                                      | Giám sát `cpu.stat` của cgroup, kill cả cây; thêm test fork                                                                           |
| T07: test viết trước chạy lần đầu 8 test đỏ (lỗi đọc `#define`, tên tham số bị tính là lần dùng)                                             | Chạy test trước code                                                              | Sửa theo lớp cú pháp tổng quát, không theo bài; không đưa id hay code dev set vào rule                                                |
| T10: image checker chạy bằng user `node` không ghi được `/out` thuộc root trên Linux                                                         | Review của Vượng; Docker Desktop trên Windows không lộ lỗi                        | Script tái hiện chạy đỏ trước, rồi ghi prediction ra stdout và chạy image bằng root                                                   |
| T10: redirect `>` của PowerShell ghi BOM nên `eval.mjs` exit 2                                                                               | Assistant thử lại lệnh README trên máy dev                                        | README tách lệnh PowerShell dùng mount `--out`                                                                                        |
| T11: compile dùng memory limit của lab, lab 64 MiB với `<bits/stdc++.h>` báo CE giả                                                          | Review của Vỹ trên PR #80                                                         | Compile dùng giới hạn cố định 256 MiB; test đỏ trước (`d7643d8`)                                                                      |
| T12: hash commit trong evidence là hash trước rebase, không có trong nhánh                                                                   | Review của Vỹ trên PR #82                                                         | Sửa hash theo nhánh sau rebase                                                                                                        |
| T01/T10: `core.autocrlf` làm SHA-256 file dev set sai                                                                                        | So SHA với rubric                                                                 | Xuất từng git blob, thêm `leetkob-eval/** -text`, test so manifest                                                                    |

## Nhật ký theo task

### 17–18/11 — T01: plan PA03, quy ước và Issues

Tool: Claude Code; GitHub CLI.
Asked for: đọc rubric, brief, FAQ, dev set; lập plan vừa đủ rubric, chia task theo độ phức tạp, tạo milestone và Issues.
Kept: cấu trúc plan/Issue của PA02; quyết định Postgres, phân loại constraint theo README dev set.
Changed: Task ID kèm milestone (`PA03-Txx`) vì trùng PA02; thêm T00 theo phản hồi nhóm. Sửa theo review của Vượng: Publish chặn khi còn bất kỳ verdict nào chưa review (plan cũ chỉ chặn `violation`/`unsure`), `npm test` không cần network/Docker/Postgres.
Rejected: Judge0; checker cấu hình theo từng bài; tạo prediction từ `labels.jsonl`; đưa lấy mẫu 10% vào PA03.
By hand: Vỹ chốt Postgres, quy ước ngôn ngữ, phân công; Vượng tìm 4 điểm review. Nguồn: [T01](docs/evidence/PA03/T01/AI-LOG.md).

### 17/11 — T00: cấu trúc thư mục cuối

Tool: Codex.
Asked for: chuyển code và test PA02 sang cấu trúc `src/api|worker|pipeline|sandbox|db|shared|cli` không đổi hành vi.
Kept: một package, ba entry point API/worker/checker; 83 test PA02 vẫn xanh.
Changed: giữ RFC 9457 trong cụm auth của API vì đang gắn Fastify; dùng Node 24.22.1 ở thư mục tạm.
Rejected: tạo thư mục rỗng cho phần chưa làm; siết glob lint/format.
By hand: Vỹ viết prompt và review nội bộ PR #44. Nguồn: [T00](docs/evidence/PA03/T00/AI-LOG.md).

### 18–19/11 — T02: host, model và spending cap

Tool: Claude Code, SSH, Azure Portal, Claude Console.
Asked for: so sánh host và model, dựng VM, cài Docker, viết ADR.
Kept: VM Ubuntu 24.04 (cgroup v2) trên Azure for Students; `claude-haiku-5-5`; spend limit workspace và Auto-reload tắt làm hard cap.
Changed: region East/Southeast Asia bị policy chặn nên chọn Indonesia Central; lệnh `ssh-keygen -f ~/.ssh/...` hỏng trên PowerShell 5.1, đổi sang `$HOME`; ảnh billing/key được che thông tin.
Rejected: PaaS (không có Docker daemon cho sandbox); DeepSeek (đắt hơn ~2.5 lần, dữ liệu ra ngoài); OpenRouter; model free tier.
By hand: Vượng tạo VM, đặt limit organization, tạo key không qua assistant; Vỹ nạp $5 và đặt limit workspace. Nguồn: [T02](docs/evidence/PA03/T02/AI-LOG.md).

### 19–21/11 — T03: dữ liệu dùng chung và Postgres

Tool: Claude Code, Docker Desktop, Postgres 17.
Asked for: kiểu dữ liệu, interface `Store`/`Queue`, bản fake, schema verdict; rồi adapter Postgres, migration, job CI.
Kept: tầng của T00 (`src/pipeline` không import `src/db`); store PA02 và 83 test giữ nguyên.
Changed: sau 7 điểm tự review của Vượng: `claim` có `maxAttempts` để job crash mãi không chặn Publish; `complete` từ chối verdict sai dạng hoặc thiếu; store chỉ chép field đã định nghĩa (chặn `deduction` lọt vào verdict); thêm `opensAt` theo FAQ. Test Postgres sửa để luôn xoá schema test.
Rejected: ORM; thư viện JSON Schema; dùng `now()` của DB; đổi `PublishStore` PA02 sang async trong T03.
By hand: Vượng review code, chỉ ra dòng lỗi, chọn chạy Postgres local. Nguồn: [T03](docs/evidence/PA03/T03/AI-LOG.md).

### 21–22/11 — T04: auth, lab và API nộp bài

Tool: Codex, PostgreSQL, Swagger.
Asked for: đăng ký/login/session, TA tạo lab (JSON hoặc file), student nộp bài, chống tạo trùng.
Kept: session phía server, token chỉ lưu hash; idempotency key TTL 24 giờ; bài nộp và job ghi nguyên tử.
Changed: multipart đếm byte trên stream gốc và kiểm UTF-8 thay vì chỉ dựa `bodyLimit`; sửa sau review: pool idle, password Unicode lỗi.
Rejected: JWT/refresh token; ZIP nhiều file; coi bài `queued` là đã chấm.
By hand: Vượng chốt luồng auth, giới hạn một file/64 KiB và chính sách seed dev. Nguồn: [T04](docs/evidence/PA03/T04/AI-LOG.md).

### 20–22/11 — T05: sandbox và 9 bài tấn công

Tool: Antigravity assistant; Docker Engine 29.10 trên Ubuntu 24.04 qua SSH tunnel.
Asked for: runner compile/run C++17 trong container đạt 9 minimums, 9 bài tấn công, job CI `sandbox-attacks`.
Kept: truyền source/binary qua stdin/stdout, không bind mount; `--pids-limit` theo cgroup; tách `npm test` khỏi `npm run test:sandbox`.
Changed: phân biệt OOM với SIGKILL; giám sát CPU cả cây process; status frame có nonce để `return 125` của bài không bị coi là lỗi Docker; fallback kill có giới hạn; CPU limit theo millisecond. Siết M7 (`CapEff` 0), M8 (`/` read-only, `/tmp` tmpfs), M9 (canary `#include`).
Rejected: Judge0; mount thư mục code từ host; truyền token qua env.
By hand: Phúc duyệt kế hoạch sửa và chạy lại trên Docker thật; Vượng review. Nguồn: [T05](docs/evidence/PA03/T05/AI-LOG.md).

### 22/11 — T06: queue và worker chấm đúng một lần

Tool: Antigravity assistant, Postgres 17.
Asked for: worker process riêng với claim/lease/retry, lưu đúng một bộ verdict; test dừng worker → nộp → khởi động lại.
Kept: `Store`/`JobQueue` của T03, `runHardRules` của T07; test tiến trình OS riêng trên Postgres thật.
Changed: sau review của Vượng: worker fail-closed khi chưa cấu hình judge (bản đầu mặc định chấm giả `AC`); giữ timer poll để daemon không tự thoát; outbox cho `modelCalls` thay vì gọi `fail` sau `complete`.
Rejected: chạy lại cả lượt chấm khi ghi call log lỗi (tốn chi phí, sai trạng thái).
By hand: Phúc chỉ đạo thứ tự sửa PR #46 rồi #50. Nguồn: [T06](docs/evidence/PA03/T06/AI-LOG.md).

### 21/11 — T07: hard rules cho constraint ban-list

Tool: Claude Code.
Asked for: spike cách phân tích C++, viết test trước, implement hard rules, chạy model-off trên dev set.
Kept: lexer tự viết có scope và khai triển macro, không thêm dependency; API `classifyConstraint`, `checkBanList`, `runHardRules`.
Changed: 8 test đỏ lần đầu (lỗi lệch chỉ số khi đọc `#define`, tên tham số bị tính là lần dùng, vài số dòng kỳ vọng đếm sai); thêm nhãn `goto` và hằng enum là tên sinh viên khai báo. Prompt ghi 18 vi phạm ban-list, đếm thật là 15, evidence ghi 15.
Rejected: tree-sitter-cpp; đồng nhất `std::string` với `std::basic_string`; mô phỏng ADL; id hay code dev set trong rule/test.
By hand: Vỹ viết prompt và đọc lại code. Nguồn: [T07](docs/evidence/PA03/T07/AI-LOG.md).

### 22/11 — T08: model cho constraint semantic, schema và timeout

Tool: Claude Code; `@anthropic-ai/sdk`.
Asked for: test với fake model trước, implement sanitize/prompt/schema/client/evaluate, gọi model thật tối đa 10 call.
Kept: một call mỗi bài nộp; schema `additionalProperties: false` và validate trong code; timeout hai lớp; evidence lấy từ dòng gốc; lỗi provider ném để worker retry.
Changed: lỗi "Mai"/`main` ở bảng trên; call log ghi model provider báo thay vì model của client; sau review của Vượng: retry trong deadline, `retryable` theo status, fail-closed khi không có danh tính.
Rejected: `zod`/thư viện schema; biến lỗi provider tạm thời thành `unsure`; xoá log lượt gọi lỗi.
By hand: Vỹ viết prompt, tự đặt key vào `.env` local, cho phép 3 call (tổng 6 call, $0.0011). Nguồn: [T08](docs/evidence/PA03/T08/AI-LOG.md).

### 23/11 — T09: review queue và chặn Publish

Tool: Claude Code.
Asked for: bốn endpoint review queue theo session T04, chặn Publish khi còn verdict chưa review, test trước.
Kept: TA lớp khác nhận `404` như API labs (FAQ-01); code đầy đủ chỉ ở trang chi tiết; student không có endpoint nào trả verdict (FAQ-08).
Changed: bắt buộc chỉ dòng khi chọn `violation` làm ngay ở PA03 (Vượng chọn); server lấy text dòng từ code đã nộp; 2 test đỏ do lỗi của chính test (`call(undefined)` vẫn gửi token TA), sửa thành `call(null)`. Status Publish cho TA lớp khác: đã đổi sang `404` rồi hoàn lại `403` khi assistant chỉ ra contract v1 cấm đổi status; Vượng chốt phương án B.
Rejected: `/v2` cho Publish; nhận `taId` từ body.
By hand: Vượng tìm hai lỗi (`confirm-passes` race với Publish, lộ lab qua `403`) và ra quyết định cuối; Vỹ review PR #79. Nguồn: [T09](docs/evidence/PA03/T09/AI-LOG.md).

### 23/11 — T10: checker, case riêng và dev run

Tool: Claude Code.
Asked for: lệnh checker + Dockerfile + `MODEL_OFF=1`, dev set nguyên byte, ≥5 case riêng, dev run thật.
Kept: quyết định của Vượng: `UnsureCause` `model_off` kèm migration mới; identity có kiểu cho dataset không có sinh viên; lỗi provider một bài thành `unsure` và chạy tiếp.
Changed: lỗi `/out` thuộc root và BOM của PowerShell (bảng trên); regex `+` chưa escape trong model giả của test.
Rejected: chạy dev run nhiều lần để chọn lần đẹp; chỉnh prompt theo cặp khấu trừ sai của dev set; dùng `labels.jsonl` hay `tests/` trong checker.
By hand: Vượng cấp key qua `.env`, chốt 5 quyết định thiết kế; Vỹ review PR #81. Nguồn: [T10](docs/evidence/PA03/T10/AI-LOG.md).

### 23/11 — T11: tích hợp pipeline end-to-end

Tool: Antigravity assistant.
Asked for: nối submit → worker → sandbox → hard rules → model → verdict → review queue; e2e offline cho ba bài tiêu chí 1.
Kept: ranh giới module; `npm test` offline với fake sandbox và fake model.
Changed: resolver danh tính đọc `studentId` từ store thay vì sửa interface T08; e2e đỏ `401` ở Publish do đẩy clock quá TTL session, sửa cửa sổ deadline của test; sau review của Vỹ: compile dùng memory cố định.
Rejected: thêm `studentId` vào interface đã merge của T08; tự retry lỗi `401`.
By hand: Phúc điều phối và yêu cầu xử lý dứt điểm review PR #80. Nguồn: [T11](docs/evidence/PA03/T11/AI-LOG.md).

### 23–24/11 — T12: deployment public

Tool: Antigravity assistant; Docker Compose trên VM Azure.
Asked for: `trustProxy` theo IP/CIDR của proxy, chặn seed dev trên production, Compose + Caddy HTTPS + runbook, chạy tiêu chí 1 thật qua URL public.
Kept: chỉ Caddy mở `80`/`443`; key và password chỉ trong `deploy/.env` quyền 600; sandbox không nhận env của worker.
Changed: test trước cho `loadTrustProxy` (từ chối `true`, `*`, `0.0.0.0/0`); seed 5 tài khoản riêng; Docker CLI trong worker lấy từ image `docker:29-cli`; truyền password seed qua stdin thay vì `-e`; hash commit sửa theo review.
Rejected: `TRUST_PROXY=true`; mở cổng 3000/5432.
By hand: Vượng mở NSG; Phúc cấp key và đổi domain sang `app.flytest.io.vn`; Vỹ chạy độc lập 48/48 kiểm tra tiêu chí 1 qua public HTTPS bằng script tự chạy trên máy mình và kiểm sandbox trên VPS. Nguồn: [T12](docs/evidence/PA03/T12/AI-LOG.md).

### 17–24/11 — Review PR cho Vỹ

Tool: Claude Code.
Asked for: đọc diff, chạy lint/type-check/test trên head của PR, soạn review có file:line và mức độ để Vỹ đăng.
Kept: chỉ review, không viết code của task người khác; verdict theo mức độ (lỗi phải sửa trước merge thì Request changes).
Changed: review PR #82 lần đầu là Request changes vì hash commit cũ, plan ghi sai trạng thái và runbook kéo `main`; Approve sau khi sửa.
Rejected: tự nhập password để đăng nhập deployment production; viết script kiểm tra để Vỹ tự chạy với 5 tài khoản test.
By hand: Vỹ quyết định đăng từng review và tự chạy script kiểm tiêu chí 1.

### 24/11 — T13: hồ sơ và bản nộp

Tool: Claude Code.
Asked for: đối chiếu requirement, rubric, plan và 14 Issues; soạn `PA3.md`, `SELF_ASSESSMENT_REPORT.md`, hợp nhất AI-LOG, cập nhật README (model, chi phí lab 80 bài).
Kept: số liệu lấy từ evidence đã commit; chấm lại `predictions.jsonl` của dev run bằng `eval.mjs` ra đúng 1 / 100% / 0%; chạy lại lint, format-check, type-check, `npm test` trên bản `git archive` sạch của `develop`.
Changed: README còn mô tả PA02 ("T06/T07 deferred", "Publish chưa nối runtime", "phase này chưa chạy worker"); cập nhật theo trạng thái PA03. Chi phí lab 80 bài tính lại từ dev run (39 call) thay vì chỉ 2 call của T08.
Theo yêu cầu của Vỹ, kiểm chứng các ô review còn trống trên Issue #32, #34, #35, #37 (chạy test model với preload chặn network 116/116, đọc lệnh Docker của sandbox, test restart worker, schema output) rồi tick, ghi rõ trên Issue là Vỹ kiểm chứng thay reviewer.
Rejected: ghi password test do assistant điền (Vỹ tự điền); trừ điểm theo những điểm yếu rubric không chấm (Vỹ yêu cầu chấm đúng theo từng mức của rubric; tiêu chí 7 Vỹ chốt 5/5).
By hand: Vỹ điền password, quay video, promote `develop` → `main`, gắn và push tag `pa3`, đóng gói ZIP và nộp.
