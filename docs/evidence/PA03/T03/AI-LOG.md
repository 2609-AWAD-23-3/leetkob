# Đầu vào AI-log — PA03-T03

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 19–20/11/2026 — Giai đoạn 1: kiểu dữ liệu, interface và bản fake

**Công cụ (Tool):** Claude Code (desktop app).

**Yêu cầu (Asked for):** thiết kế và code kiểu dữ liệu, interface `Store`/`Queue`, bản fake in-memory và JSON schema verdict cho T04, T06, T08, T09; lập plan để Vượng review trước khi code.

**Phần giữ lại (Kept):** cấu trúc chia tầng của PA03-T00; store PA02 (`PublishStore`, fixtures, 83 test) giữ nguyên; quy ước ID, thời gian và lỗi `TypeError` cho seed sai của PA02; mô hình review queue một mục cho mỗi cặp bài được tính × constraint.

**Phần điều chỉnh (Changed):**
- Bản nháp đầu đặt toàn bộ kiểu trong một file `domain.ts` và một `types.ts`; Vượng hỏi về chia theo domain, nên tách file theo domain trong `src/shared/domain/` và `src/db/`, vẫn giữ tầng của T00 vì `src/pipeline/` không được import `src/db/`.
- Bản nháp đề xuất chuyển `PublishStore` sang async ngay; Vượng chọn để sang giai đoạn 2, nên giai đoạn 1 không sửa code hay test PA02.
- Sau khi đọc FAQ của product owners: giới hạn chạy thành thuộc tính của lab (FAQ-05), mã kết quả chấm `AC`…`CE` kèm verdict từng test (FAQ-02), bài không Accepted không vào queue (FAQ-04), `unsureCause` theo năm nguyên nhân (FAQ-09), nhật ký mỗi lần TA đổi quyết định (FAQ-10).
- Một test mới ban đầu dùng đồng hồ thật nên bài nộp rơi sau deadline của fixture; sửa test cho dùng clock cố định.

**Phần không chọn (Rejected):** module có domain và store riêng (vertical slice) vì đụng cấu trúc T00 và luật import của pipeline; bảng review queue riêng vì phải đồng bộ khi student nộp lại; thư viện validate JSON Schema vì không thêm dependency, viết `parseModelVerdicts` thuần.

**Phần làm tay (By hand):** Vượng chốt cấu trúc, thời điểm async hóa Publish, hạn 21/11 và cung cấp file FAQ; review plan trước khi code.

## 20/11/2026 — Sửa theo tự review của Vượng

**Công cụ (Tool):** Claude Code.

**Yêu cầu (Asked for):** sửa 7 điểm Vượng tìm ra khi review code giai đoạn 1 trước khi mở PR.

**Phần điều chỉnh (Changed):**
- Worker crash liên tục mà không gọi `fail` thì job bị claim mãi và Publish bị chặn vĩnh viễn: `claim` nhận `maxAttempts`, job hết lượt bị kết thúc và submission thành `failed`.
- `complete` từng lưu nguyên verdict sai dạng (`verdict: 'bogus'`, `evidence` không phải mảng, `source` lạ, `reason` là số, `unsureCause` trên verdict không phải `unsure`) và bỏ qua cặp trùng trong cùng lần gọi: thêm `src/db/validation.ts` dùng chung, từ chối các trường hợp này và bắt bài AC có đủ verdict cho mọi constraint.
- `fail` không kiểm `maxAttempts`, nên `undefined` làm job thử lại vô hạn: thêm kiểm tra.
- `decide`/`confirmPasses` nhận reviewer không tồn tại và evidence sai dạng, nhật ký bỏ sót đổi evidence hoặc người review: kiểm reviewer như khóa ngoại, validate evidence, ghi nhật ký mọi thay đổi.
- Bài AC thiếu verdict làm lab pending mãi: nay `complete` từ chối; tài liệu ghi pipeline phải trả `unsure` thay vì bỏ trống.
- Plan: bỏ tick mục bàn giao cho tới khi merge; evidence ghi đủ lệnh, exit code, SHA base và phiên bản Node.
- Vòng review thứ hai: so sánh evidence bằng `JSON.stringify` làm đổi thứ tự key tạo dòng nhật ký thừa, nay so theo `line` và `text`; evidence, verdict, kết quả chấm và kết quả từng test có field lạ (ví dụ `deduction`) từng được lưu nguyên, nay bị từ chối và store chỉ chép các field đã định nghĩa.
- Assistant chỉ ra `createLab` cũng giữ field lạ; Vượng yêu cầu sửa: kiểm tra lab chuyển sang `src/db/validation.ts`, lab, `limits`, test và constraint phải đúng field, store chỉ chép field đã biết.
- Mốc "mở nhận bài" của FAQ: brief, rubric và plan không yêu cầu giờ mở riêng nên assistant ban đầu chỉ ghi quy ước lab mở khi tạo; Vượng quyết định thêm `opensAt` vì FAQ là mô tả của product owner. `opensAt` tùy chọn khi tạo (mặc định `createdAt`), phải trước `deadline`; thêm `labPhase` và chỉ tính bài nhận trong khoảng mở.
- Thêm test vào bộ conformance chung cho từng lỗi trên; bỏ test "bài AC thiếu verdict vẫn pending" vì trạng thái đó không còn tạo được qua store.

**Phần làm tay (By hand):** Vượng review code, chạy thử các trường hợp lỗi và chỉ ra dòng code cụ thể.

## 20/11/2026 — Giai đoạn 2: Postgres

**Công cụ (Tool):** Claude Code, Docker Desktop, Postgres 17 trong Docker.

**Yêu cầu (Asked for):** cài `Store` trên Postgres, migration, chạy Postgres local bằng Docker, thêm job CI có Postgres và tag Phúc, dùng `pg`; chờ Vượng review rồi mới commit, push và mở PR.

**Phần giữ lại (Kept):** interface, `validation.ts` và bộ test conformance của giai đoạn 1; route Publish, `PublishStore` sync và 83 test PA02.

**Phần điều chỉnh (Changed):**
- Plan ghi chuyển `PublishStore` PA02 sang Postgres; assistant đề xuất đưa thao tác publish (cùng ngữ nghĩa PA02) vào `Store` async qua `PublicationStore` thay vì đổi `PublishStore` sync, vì đổi sang async kéo theo sửa route, hàm phân quyền và khoảng 80 lời gọi trong test cũ, còn việc nối route là của T09. `decide` và `confirmPasses` không đổi được quyết định sau Publish trên cả hai bản cài đặt.
- Lần chạy test Postgres đầu: bộ conformance pass, nhưng `close()` bị gọi hai lần trên cùng pool trong test khởi động lại và `after()` dừng trước khi xóa schema test; sửa `close()` chạy lặp được, `after()` luôn xóa schema, và dọn 46 schema sót trong database local.
- Vượng hỏi có đưa Postgres lên VM không; assistant ghi rõ đó là phần deploy của T12, T03 chỉ cung cấp Compose, migration và `DATABASE_URL`.

**Phần không chọn (Rejected):** ORM; dùng `now()` của database cho thời gian (test không xác định được); đổi `PublishStore` PA02 sang async trong T03; chạy test Postgres trong `npm test` mặc định.

**Phần làm tay (By hand):** Vượng bật Docker Desktop, chọn chạy Postgres trên máy, thêm job CI kèm tag Phúc và dùng `pg`; yêu cầu chờ review trước khi commit.

## 20/11/2026 — Sửa theo review giai đoạn 2 của Vượng

**Công cụ (Tool):** Claude Code, Postgres 17 trong Docker.

**Yêu cầu (Asked for):** kiểm tra và sửa ba điểm Vượng tìm ra khi review giai đoạn 2.

**Phần điều chỉnh (Changed):**
- Review và Publish đồng thời có thể làm summary công bố lệch dữ liệu: `decide`/`confirmPasses` chỉ khóa verdict còn `publishLab` khóa lab. Nay cả ba khóa dòng lab trước. Thêm test cạnh tranh: một transaction giữ khóa lab như Publish, review phải chờ và thấy lab đã công bố. Đã xác nhận test fail khi bỏ khóa, pass khi có khóa.
- Lease không phân biệt từng lần claim của cùng worker: Vượng tái hiện `fail` của lần claim cũ vẫn trả `true`. Thêm `leaseToken` mới cho mỗi lần claim; `extendLease`, `complete`, `fail` nhận token thay cho `workerId`; thêm cột `lease_token` vào migration `0001_init` (chưa merge). Thêm regression test vào bộ conformance chạy trên cả hai bản cài đặt.
- Test "restart process" thực ra chỉ đóng và mở lại store trong cùng process: đổi tên cho đúng, thêm test dùng process riêng claim job rồi thoát giữa chừng, process mới lấy lại job sau khi hết lease và chỉ lưu một bộ verdict.
- Lần đầu chạy kiểm chứng test cạnh tranh khi bỏ khóa bị treo vì test không giải phóng transaction giữ khóa khi assertion fail; sửa test luôn rollback trong `finally` và dọn schema sót.
- Ghi rõ ranh giới nghiệm thu: endpoint Publish chưa dùng Postgres; kết quả local chạy trên Node 24.14.0.

**Phần làm tay (By hand):** Vượng review code, tái hiện lỗi lease trên bản fake và chỉ ra dòng code cụ thể.

## 20/11/2026 — Codex sửa năm lỗi sau kiểm chứng Postgres

**Công cụ (Tool):** Codex, PowerShell, Node.js, bộ test của repo và Postgres local trong Docker. Không gọi model provider từ code/test.

**Yêu cầu (Asked for):** người dùng yêu cầu sửa cả năm lỗi đã tái hiện: Publish bỏ sót pending, migration lần đầu cạnh tranh, lease dùng clock cũ, call log nhận metrics âm và seed fake/Postgres khác nhau.

**Phần điều chỉnh (Changed):**
- `reviewState` tính queue, quyết định và bài chưa hoàn tất trong một SQL statement để có cùng snapshot. Regression test cho worker hoàn tất sau lần đọc đầu của Publish xác nhận không công bố khi còn mục cần review.
- Migration lấy transaction advisory lock trước khi tạo schema và bảng metadata; vẫn khóa metadata cho từng migration. Test bốn store khởi tạo cùng schema mới và test nâng cấp từ `0001_init` giữ dữ liệu cũ.
- `extendLease`, `complete`, `fail` lấy khóa job trước khi đọc clock; `complete` kiểm lại sau khóa submission và trước khi ghi. Bảy regression tests điều khiển clock sau khi thao tác đã chờ connection/khóa, xác nhận lease hết hạn không đổi dữ liệu.
- Hai adapter dùng chung validation cho metrics: token/latency là số nguyên không âm trong miền integer Postgres, cost hữu hạn và không âm. Migration mới `0002_model_call_metrics` thêm CHECK, không sửa migration cũ. Test cả store API và SQL trực tiếp, gồm âm, phân số, vượt miền, NaN, Infinity và trường hợp zero hợp lệ.
- `buildState` từ chối người tạo lab không tồn tại. Conformance test kiểm seed lúc tạo và reset sai giữ nguyên dữ liệu trên cả hai adapter.
- Sửa comment mô tả recovery: process riêng claim rồi thoát; store phục hồi được tạo trong process test, không gọi đó là một process mới.
- Lần chạy Postgres đầu sau sửa có 62 pass / 4 fail: các test mới dùng snapshot thống kê cũ khi quan sát backend chờ khóa. Sửa harness bằng `pg_stat_clear_snapshot()` trước mỗi lần quan sát; chạy riêng bảy test lease pass, rồi chạy lại toàn suite. Không nới kỳ vọng của test.

**Phần không chọn (Rejected):** không sửa label/eval; không bỏ lease-token hoặc pending gate để test xanh; không xóa dữ liệu ứng dụng để áp CHECK; không đổi route Publish PA02, workflow, dependency hoặc ownership trong bản vá này.

**Kiểm chứng:** working tree trên source base `9a099dcaecafdd4115d1479deb4190ed444804c1`, nhánh `feat/pa03-t03-shared-data`; đây không phải SHA của một commit bản vá. Local Node `v24.14.0`, npm `11.9.0`, thấp hơn mức Node tối thiểu `24.22.1` của repo. `npm.cmd run lint`, `npm.cmd run format-check`, `npm.cmd run type-check`, `npm.cmd run build`, `git diff --check` exit 0; `npm.cmd test` exit 0 (152 pass, 1 skip vì không đặt `TEST_DATABASE_URL`); `npm.cmd run test:db` với Postgres local exit 0 (67/67 pass). Các fixture Postgres dùng schema riêng và được dọn bởi suite. Chưa có kết quả CI/runtime được hỗ trợ; chưa commit, push hoặc cập nhật PR/Issue.

**Phần làm tay (By hand):** người dùng review mô tả các lỗi và cho phép sửa; implementation và kiểm chứng trong entry này do Codex thực hiện, chưa có review độc lập.

## 20/11/2026 — Cập nhật runtime và chạy lại T03 trên phiên bản được hỗ trợ

**Công cụ (Tool):** Codex, PowerShell, bộ phân phối Node.js chính thức cho Windows x64, npm và Postgres local.

**Yêu cầu (Asked for):** người dùng yêu cầu cập nhật Node/npm trên máy cho phù hợp `engines` và `packageManager` của repo.

**Phần điều chỉnh (Changed):**
- Tải `node-v24.22.3-win-x64.zip` từ [máy chủ Node.js](https://nodejs.org/download/release/v24.22.3/), đối chiếu SHA-256 với `SHASUMS256.txt` cùng máy chủ: `e612af99f626ab415ea225af6bce5c971feb448cb5cae250bb1c3fa50c5f7d9f`.
- Gói đã kiểm chứa Node `v24.22.3` và npm `11.19.1`. Thay bản cài tại `D:\App Data\nodejs`, không đổi PATH hoặc yêu cầu phiên bản của repo. Bản cũ giữ tại `D:\App Data\nodejs-backup-24.14.0-20261120-complete`.
- Lần thay thế đầu bị Windows từ chối vì thư mục thuộc SYSTEM và tài khoản chỉ có quyền đọc/chạy; bản cũ không bị đổi. Cập nhật hoàn tất qua tiến trình Administrator/UAC, kiểm version ngay sau thay thế và kiểm lại trong shell của task.

**Kiểm chứng:** working tree trên source base `9a099dcaecafdd4115d1479deb4190ed444804c1`, nhánh `feat/pa03-t03-shared-data`; chưa commit bản vá. `node --version` trả `v24.22.3`, `node -p "process.execPath"` trả `D:\App Data\nodejs\node.exe`, `npm.cmd --version` trả `11.19.1`. Trên runtime mới: `npm.cmd run lint`, `npm.cmd run format-check`, `npm.cmd run type-check`, `git diff --check` exit 0; `npm.cmd test` exit 0 (152 pass / 1 skip vì không đặt `TEST_DATABASE_URL`); `npm.cmd run test:db` với Postgres local exit 0 (67/67 pass). Cả hai script test đã chạy build thành công. Bộ Postgres tạo schema riêng và tự dọn sau test.

**Phần không chọn (Rejected):** không hạ `engines`, không sửa lockfile/dependencies hoặc app wiring để khớp runtime cũ; không gọi kết quả local là CI hay review độc lập. Lần kiểm chứng này thay thế giới hạn runtime của các lần chạy trước, không xóa evidence lịch sử.

**Phần làm tay (By hand):** người dùng yêu cầu cập nhật hệ thống; thao tác cập nhật và chạy checks do Codex thực hiện. Chưa commit, push hoặc cập nhật PR/Issue.

## 20/11/2026 — Khôi phục metadata nền tảng trong lockfile

**Công cụ (Tool):** Codex, Git, Node `v24.22.3`, npm `11.19.1`, PowerShell và Postgres local.

**Yêu cầu (Asked for):** người dùng yêu cầu giữ metadata dependency không liên quan, bảo toàn dependency Postgres và xác minh cài đặt sau khi sửa.

**Phần điều chỉnh (Changed):** khôi phục tám trường `libc` của các package `@oxlint/binding-linux-*` từ `HEAD:package-lock.json`. Kiểm tra bằng so sánh object rằng mọi package đã có trong HEAD giữ nguyên toàn bộ metadata; vẫn giữ `pg@8.23.1`, `@types/pg@8.23.1` và các dependency mới cần thiết (14 package entries mới). Không đổi manifest hoặc phiên bản package.

**Kiểm chứng:** working tree trên base `9a099dcaecafdd4115d1479deb4190ed444804c1`, nhánh `feat/pa03-t03-shared-data`. `npm.cmd ci --ignore-scripts` exit 0, cài 72 packages; SHA-256 lockfile trước và sau cài giống nhau: `e18491d5438430f9a25dfa33e75306361f28d437c69bd03a479c9702c9e63650`. Sau cài sạch: lint, format-check, type-check, diff-check exit 0; `npm.cmd test` exit 0 (152 pass / 1 skip), `npm.cmd run test:db` exit 0 (67/67 pass). Hai script test gồm build. Đây là kiểm chứng Windows local; chưa chạy lại CI Linux hoặc deploy VPS trong lượt này.

**Phần không chọn (Rejected):** không hoàn nguyên toàn bộ lockfile, không bỏ dependency Postgres, không cập nhật các package ngoài scope, không nới test hoặc thay runtime requirements.

**Phần làm tay (By hand):** người dùng cho phép chỉnh lockfile và kiểm chứng; thao tác do Codex thực hiện. Chưa commit, push hoặc cập nhật PR/Issue.

## 21/11/2026 — Giữ thời điểm nhận bài trước khi chờ database

**Công cụ (Tool):** Codex, Node `v24.22.3`, npm `11.19.1`, Postgres local và node:test.

**Yêu cầu (Asked for):** người dùng yêu cầu sửa việc fake và Postgres ghi thời điểm nhận bài khác nhau khi database chờ qua deadline.

**Phần điều chỉnh (Changed):** hai adapter chụp `submittedAt` từ clock ngay khi vào `submit`, trước readiness/connection/I/O. INSERT dùng lại thời điểm đã chụp; client không cung cấp timestamp, transaction ghi submission và job không đổi. Cập nhật mô tả `SubmissionStore` và quyết định thiết kế.

**Kiểm chứng:** thêm một conformance test cho cả hai adapter (gọi trước deadline 1 ms, cho clock qua hạn trước khi Promise resolve) và một test Postgres giữ connection để tạo thời gian chờ thật, kiểm bài vẫn được tính, timestamp đọc lại không đổi và chỉ có một job. Test cũng kiểm nộp đúng deadline vẫn không được tính. Trước sửa, chạy riêng ba ca: fake pass, hai ca Postgres fail với timestamp sau hạn. Sau sửa, `npm.cmd test` exit 0 (153 pass / 1 skip), `npm.cmd run test:db` exit 0 (69/69 pass); build, lint, type-check, format-check và diff-check exit 0. Working tree trên source base `9a099dcaecafdd4115d1479deb4190ed444804c1`, nhánh `feat/pa03-t03-shared-data`; không phải commit SHA của bản sửa. Fixture/probe dùng schema riêng và tự dọn.

**Phần không chọn (Rejected):** không đổi deadline hay quy tắc `opensAt <= submittedAt < deadline`, không nhận thời gian do client tự khai, không sửa kỳ vọng tests cũ hoặc dữ liệu eval. Vấn đề nâng cấp schema nháp thiếu lease token đã nêu trong chat không được sửa trong lượt này.

**Phần làm tay (By hand):** người dùng xác nhận sửa lỗi receive time; code và kiểm chứng do Codex thực hiện. Chưa commit, push hoặc cập nhật PR/Issue; chưa có CI/review độc lập cho bản sửa.

## 21/11/2026 — Chuẩn bị commit và PR T03 theo yêu cầu

**Công cụ (Tool):** Codex, Git, GitHub CLI, Node/npm và Postgres local.

**Yêu cầu (Asked for):** người dùng chấp thuận quy trình commit, push nhánh, mở PR vào `develop` và request reviewer; không giao merge hoặc tự đóng Issue.

**Phần điều chỉnh (Changed):** giữ bốn commit phase 1 đã có; tạo commit implementation/tests Postgres `c0f7789c645a932bce7ce640dd437469f307f8ec`. Stage đúng source, migrations, Compose, scripts, dependency/lockfile, CI job và regression tests T03. Tài liệu/evidence được commit riêng sau khi kiểm chứng source này. Fetch xác nhận nhánh dựa trên `origin/develop`, không có commit develop mới cần merge; GitHub chưa có PR trùng nhánh ở thời điểm kiểm tra.

**Kiểm chứng:** trên source SHA trên, Node `v24.22.3`, npm `11.19.1`: lint, format-check, type-check, diff-check exit 0; `npm.cmd test` exit 0 (153 pass / 1 skip), `npm.cmd run test:db` exit 0 (69/69 pass), gồm build. Scan heuristic chỉ đọc staged diff và commit branch không tìm thấy mẫu private key/provider token có độ tin cậy cao; đây không phải audit bảo mật toàn diện. Source/tests Publish PA02 và dữ liệu eval không bị sửa. Evidence tái lập và giới hạn được ghi trong [README.md](README.md).

**Phần không chọn (Rejected):** không squash/rewrite bốn commit phase 1, không force-push, không tự approve/merge, không dùng closing keyword cho Issue #32. Không thêm migration tương thích schema nháp trước lease token vì người dùng xác nhận chỉ mình chạy bản cũ và database hiện tại đã có cột. Ranh giới nối HTTP Publish vẫn bàn giao T09, cần reviewer xác nhận.

**Phần làm tay (By hand):** người dùng cấp quyền commit/push/PR. Code, kiểm chứng và thao tác chuẩn bị do Codex thực hiện; kết quả CI và review độc lập phải lấy từ checks/review của PR, không suy ra từ local.
