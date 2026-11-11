# AI-LOG — PA02

Tổng hợp theo task từ các fragments có sẵn; không phải transcript. Các thao tác assistant thực hiện không được chuyển thành công việc sinh viên làm tay. By hand dưới đây chỉ ghi đóng góp đã có nguồn; các khai báo của đồng đội được dẫn nguồn, không phải quan sát trực tiếp của người tổng hợp. T06/T07 deferred; Chưa có hoạt động release được ghi nhận trong bản log này.

## 2026-11-02–07 — Setup và scope PA02

Tool: OpenClaw assistant.
Asked for: tổ chức plan/workflow và xác định phạm vi harness/quality gate theo đề.
Kept: task có executor/reviewer, workflow PR, một endpoint publish và các hồ sơ bắt buộc.
Changed: giảm phạm vi về publish; bỏ dependencies vào submissions/review-queue đã hoãn, giữ CI required trên main.
Rejected: nhân số endpoints theo số thành viên, database/login production và coi deferred là hoàn thành.
By hand: nhóm lựa chọn/chấp thuận scope; assistant soạn tài liệu/workflow, không khai là code sinh viên tự viết.
Nguồn: [setup fragment](docs/evidence/PA02/SETUP-AI-LOG.md), [scope fragment](docs/evidence/PA02/scope-2026-11-07.md).

## 2026-11-02–08 — T01: skeleton

Tool: OpenClaw assistant; worker QA chỉ đọc, không dùng Codex CLI trong triển khai T01.
Asked for: xây app factory, listener/config riêng và nền TypeScript/Fastify kiểm thử được.
Kept: module seams, lockfile, health route và smoke tests.
Changed: assistant sửa regex content-type trong smoke test, thêm noEmitOnError.
Rejected: business responses giả thành công, auth/store tự suy diễn và coi smoke checks là CI evidence.
By hand: không có nguồn xác nhận implementation viết tay; không gán edits/tests của assistant cho sinh viên.
Nguồn: [fragment T01](docs/evidence/PA02/T01/AI-LOG.md), [PR #14](https://github.com/2609-AWAD-23-3/leetkob/pull/14).

## 2026-11-09 — T02: state/fixtures

Tool: Codex assistant.
Asked for: thiết kế và triển khai store/fixtures tối thiểu phục vụ publish.
Kept: in-memory store đồng bộ, seed/reset riêng theo instance và data tests.
Changed: summary thống kê quyết định TA thay snapshot điểm; ghi rõ giới hạn restart/concurrency.
Rejected: coi verdict model là quyết định TA, pipeline tính điểm và endpoints deferred.
By hand: nguồn T02 ghi Vỹ review PR; implementation/tests/docs do assistant viết.
Nguồn: [fragment T02](docs/evidence/PA02/T02/AI-LOG.md), [PR #18](https://github.com/2609-AWAD-23-3/leetkob/pull/18).

## 2026-11-09 — T03: identity/ownership/errors

Tool: Antigravity assistant (Gemini), theo fragment của executor.
Asked for: xây trusted Bearer identity, TA/class ownership và errors RFC 9457.
Kept: token resolver, test identity mặc định tắt, error mapping và 18 auth tests.
Changed: khớp PublishResult của T02; kiểm tra role trước lookup lab để chống dò tài nguyên.
Rejected: lấy role/userId từ body/query, bật test headers mặc định hoặc xây OAuth ngoài scope.
By hand: fragment ghi executor rà soát kết quả; source/tests/docs do assistant viết, không khai viết tay.
Nguồn: [fragment T03](docs/evidence/PA02/T03/AI-LOG.md), [PR #19](https://github.com/2609-AWAD-23-3/leetkob/pull/19).

## 2026-11-08–10 — T04: quality harness

Tool: OpenClaw/Codex (GPT-6), shell/npm.
Asked for: commands lint/format/type-check/test, discovery và cleanup/isolation.
Kept: quality configs/scripts, real-app helper và negative probes.
Changed: chuyển ESLint/typescript-eslint sang Oxlint do peer conflict TS7; thêm guard không có test, giữ exit/signal failure; thêm .gitattributes LF theo feedback review.
Rejected: ép peer deps, downgrade TypeScript, fake publish handler hoặc coi local tests là CI.
By hand: người dùng báo tự chạy checks pass, không cung cấp terminal log; không coi đó là independent review. Edits/commands/logs do assistant thực hiện.
Nguồn: [fragment T04](docs/evidence/PA02/T04/AI-LOG.md), [PR #17](https://github.com/2609-AWAD-23-3/leetkob/pull/17).

## 2026-11-10–11 — T05: rules/security/cost

Tool: Codex assistant, Gitleaks 8.30.1, formatter theo lockfile.
Asked for: rules bốn phần, permissions ba mức, env hygiene, scan/triage và model/cost records.
Kept: rules truy vết hai sự cố thật; scan history/refs/config và redacted reports.
Changed: làm rõ kiểm tra đúng worktree và ranh giới publication trong rules; triage chỉ nhận digest khi khớp source/hash cụ thể; sửa formatting không đổi AST; ghi cost estimate thay vì measured usage.
Rejected: suppress findings để ép scan xanh, coi budget alert/estimate là spending cap, bịa usage hoặc gọi model trong tests.
By hand: nguồn ghi Vỹ review kỹ thuật; collector/edits/checks do assistant thực hiện. Chưa có bằng chứng cap từ người quản lý key.
Nguồn: [fragment và hai rule incidents T05](docs/evidence/PA02/T05/AI-LOG.md), [scan](docs/evidence/PA02/T05/security-scan.md), [cost](docs/evidence/PA02/T05/model-cost.md), [PR #21](https://github.com/2609-AWAD-23-3/leetkob/pull/21).

## 2026-11-10–11 — T08: publish contract/implementation/tests

Tool: Antigravity assistant (Gemini), theo fragment của executor.
Asked for: contract theo IA03, publish module và HTTP-boundary tests.
Kept: natural idempotency, immutable publication metadata, deadline/pending gate và ownership.
Changed: đồng bộ summary/pendingCount với T02; theo feedback review bổ sung 413/415, precedence parser/auth/role và nâng contract suite từ 11 lên 16 tests (toàn bộ 83).
Rejected: body override identity/state, mock endpoint và triển khai endpoints deferred.
By hand: fragment ghi executor duyệt kế hoạch, kiểm tra diff và chạy checks; chưa có xác nhận riêng về phần code viết tay.
Nguồn: [fragment T08](docs/evidence/PA02/T08/AI-LOG.md), [PR #20](https://github.com/2609-AWAD-23-3/leetkob/pull/20).

## 2026-11-11 — T09: CI/protection

Tool: Antigravity assistant (Gemini), theo fragment của executor.
Asked for: CI dùng bốn commands chung, required quality-gate và main protection.
Kept: Node 24/Ubuntu, minimal contents:read, PR/push/tag triggers và stable check name.
Changed: bổ sung live settings/protection evidence và làm rõ .github nằm ngoài format-check.
Rejected: matrix từng module, đổi scripts/tests chỉ để CI pass hoặc coi YAML là protection đã enforce.
By hand: fragment ghi executor gọi/kiểm tra GitHub API và chạy local commands; người tổng hợp chưa quan sát độc lập các thao tác làm tay đó.
Nguồn: [fragment T09](docs/evidence/PA02/T09/AI-LOG.md), [PR #22](https://github.com/2609-AWAD-23-3/leetkob/pull/22).

## 2026-11-11 — T10: deliberate break/fix

Tool: Antigravity assistant (Gemini), theo fragment của executor.
Asked for: chứng minh contract assertion bắt implementation break và merge policy từ chối PR đỏ.
Kept: cùng PR #24, break 934af86e, fix 65097bab, contract/tests không đổi và run permalinks.
Changed: cố tình bỏ pending gate để nhận 200 thay 409, rồi khôi phục gate; evidence ghi rõ lúc blocked còn đồng thời thiếu approval.
Rejected: lỗi syntax/setup thay contract assertion, sửa test để xanh, bypass hoặc squash mất break/fix history.
By hand: fragment ghi executor probe merge policy/chạy checks; review cuối được GitHub ghi bởi tranquocvy, không nhận approval đã dismissed là review cuối.
Nguồn: [fragment T10](docs/evidence/PA02/T10/AI-LOG.md), [PR #24](https://github.com/2609-AWAD-23-3/leetkob/pull/24).

## 2026-11-08 — Scope: tích hợp PR #16

Tool: OpenClaw/Codex assistant.
Asked for: tích hợp scope publish-only với develop và bảo toàn tiến độ đã có.
Kept: một endpoint, 12 task IDs, phần T01 đã tích hợp và review provenance theo source SHA.
Changed: resolve conflict tại section T01 để giữ acceptance publish-only cùng kết quả/evidence đã tích hợp; sửa trạng thái PR #14 trong hồ sơ scope.
Rejected: khôi phục scope ba endpoints, mất tiến độ T01 hoặc nhận review cũ là review cho head mới.
By hand: fragment ghi người thực hiện đã kiểm tra scope; assistant resolve và soạn tài liệu, không có business code mới.
Nguồn: [scope, bổ sung tích hợp](docs/evidence/PA02/scope-2026-11-07.md).

## 2026-11-02 — T01: bổ sung kiểm chứng và khôi phục tài liệu

Tool: OpenClaw assistant.
Asked for: giữ bản tài liệu English và bổ sung hồ sơ build/smoke/setup sạch.
Kept: README/architecture/comments tại 738b183, logic, manifest, lockfile và trạng thái acceptance.
Changed: hoàn tác 12 file bản dịch; sửa escaping newline của collector để parse được, kiểm tra syntax rồi chạy lại.
Rejected: dùng lỗi collector/smoke syntax làm evidence deliberate implementation-only contract break của T10.
By hand: nguồn T01 ghi quyết định giữ ngôn ngữ English của người thực hiện; assistant hoàn tác, soạn records và chạy checks.
Nguồn: [fragment T01](docs/evidence/PA02/T01/AI-LOG.md), [verification](docs/evidence/PA02/T01/verification.json).

## 2026-11-11 — T05: rút gọn rules

Tool: Codex assistant.
Asked for: rút gọn rules đúng bốn sections, gắn với repo và giữ trace hai sự cố thật.
Kept: stack/commands/conventions/never, hai incident references T02.
Changed: bỏ chi tiết phân công/checkpoint/store khỏi rules root; dẫn scope theo task và rules trực tiếp tới incident anchors.
Rejected: dùng kết quả scan cũ để nhận đã kiểm chứng bản rules mới.
By hand: nguồn T05 ghi người thực hiện đối chiếu rubric; assistant chỉnh file rules.
Nguồn: [fragment T05](docs/evidence/PA02/T05/AI-LOG.md).

## 2026-11-11 — T05: đồng bộ baseline

Tool: Codex assistant, Git.
Asked for: đồng bộ develop mà không mất các thay đổi tài liệu hiện có.
Kept: incident sources, nội dung AI-log T02 và các JSON verification lịch sử.
Changed: sao lưu 16 file, fast-forward từ 2dfff8f tới 09245d7 bằng autostash rồi áp lại; cập nhật commands từ T04, phân biệt snapshot lịch sử với baseline mới.
Rejected: sửa thủ công SHA/ngày/kết quả JSON để giả nhận đã scan baseline mới.
By hand: assistant đồng bộ và kiểm tra bảo toàn nội dung; không khai các edits này là sinh viên viết tay.
Nguồn: [fragment T05](docs/evidence/PA02/T05/AI-LOG.md).

## 2026-11-11 — T05: scan và quality checks

Tool: Codex assistant, Node 24.22.1/npm 11.19.1, Gitleaks 8.30.1.
Asked for: kiểm chứng rules/security và các commands trên baseline 09245d7.
Kept: exit codes gốc, kể cả format-check thất bại và scanner có findings.
Changed: phân loại 10 findings history và 2 working tree là file digests; đối chiếu snapshot bằng hash. Lint/type-check và 67 tests pass; format-check lỗi 15 file ở checkout local và 7 file ở checkout sạch cùng SHA.
Rejected: nhận full gate đạt khi format-check còn lỗi, đổi ignore để giấu findings hoặc ghi cap/usage chưa có nguồn.
By hand: assistant chạy kiểm tra và cập nhật hồ sơ; không ghi nhận code sinh viên viết tay.
Nguồn: [fragment T05](docs/evidence/PA02/T05/AI-LOG.md), [verification](docs/evidence/PA02/T05/verification.json).

## 2026-11-11 — T05: sửa formatting

Tool: Codex assistant, Prettier theo lockfile, Gitleaks 8.30.1.
Asked for: sửa formatting nhưng giữ nguyên logic và assertions.
Kept: bản sao trước format, kết quả failed checks và evidence T03 lịch sử.
Changed: format 15 file, bảy file có Git diff style; dùng parser TypeScript của Prettier đối chiếu AST sau khi loại metadata vị trí. Bốn quality commands exit 0, 67 tests pass; cập nhật scan snapshot theo bytes mới.
Rejected: sửa source semantics/assertions hoặc viết lại digest lịch sử để ép khớp source đã format. API JavaScript TypeScript 7 không dùng được cho helper nên đổi parser, không đổi kỳ vọng kiểm chứng.
By hand: assistant format, đối chiếu AST và chạy checks; không khai thao tác này là code sinh viên tự viết.
Nguồn: [fragment T05](docs/evidence/PA02/T05/AI-LOG.md).

## 2026-11-11 — T05: cost estimate

Tool: Codex assistant, tài liệu giá chính thức và phép tính local; không gọi model API.
Asked for: ước tính chi phí khi chưa có model key hoặc measured usage.
Kept: phân biệt model tham chiếu với model triển khai, estimate với số đo thực tế.
Changed: lập hai kịch bản 80 bài, 3/5 constraints, ngân sách input/output và 20% retry; kết quả khoảng 1,73/5,76 USD mỗi lab theo giá tham chiếu ngày 11/11/2026. Output budget tính cả reasoning bị tính phí nếu có.
Rejected: dùng estimate thay spending cap, bịa billing/usage hoặc gọi model thật để tạo số đo trong tests.
By hand: nguồn T05 ghi Vỹ là người dự kiến giữ key; assistant tra nguồn, tính và viết hồ sơ. Chưa có bằng chứng key/cap hoạt động.
Nguồn: [model-cost](docs/evidence/PA02/T05/model-cost.md), [fragment T05](docs/evidence/PA02/T05/AI-LOG.md).

## 2026-11-11 — T05: chỉnh sửa theo review PR #21

Tool: Codex assistant, Gitleaks 8.30.1 và formatter local.
Asked for: làm rõ cap evidence và khả năng chạy lại scan/triage sau commit 444add2.
Kept: scan exit codes, file digests và source/revision của từng manifest.
Changed: helper kiểm chứng từng digest T03/T05 với snapshot đúng; 13 findings history và 2 working tree được xác minh. Bốn negative probes ngoài manifest/dòng sai/snapshot sai/digest sai đều bị từ chối; thêm phiếu cap, làm rõ formatter local trong AGENTS.md.
Rejected: suppress report/rule, bịa cap, gọi model hoặc chốt production model chỉ để có evidence.
By hand: Vỹ cung cấp review kỹ thuật; assistant sửa helper/docs và chạy probes.
Nguồn: [fragment T05](docs/evidence/PA02/T05/AI-LOG.md), [PR #21](https://github.com/2609-AWAD-23-3/leetkob/pull/21).

## 2026-11-11 — T08: bổ sung theo review PR #20

Tool: Antigravity assistant (Gemini), theo fragment executor.
Asked for: xử lý lỗi import/format, làm rõ precedence, bổ sung 413/415 và demo tích hợp.
Kept: TA role check trước lab lookup; fixtures/store và repeat safety đã có.
Changed: bỏ import thừa; thêm bodyLimit 65536, lỗi/test payload quá lớn và unsupported media type; loại text/plain parser mặc định, test malformed JSON/media type trước auth và role trước lookup. Contract suite tăng từ 11 lên 16, tổng 83; đồng bộ verification và demo truyền cả store/identityResolver.
Rejected: sửa server.ts ngoài file ownership hoặc đảo role check làm lộ existence của lab cho student/admin.
By hand: fragment executor ghi kiểm tra diff và chạy commands; source/tests/docs do assistant hỗ trợ, không khai riêng phần code viết tay chưa có nguồn.
Nguồn: [fragment T08](docs/evidence/PA02/T08/AI-LOG.md), [PR #20](https://github.com/2609-AWAD-23-3/leetkob/pull/20).

## 2026-11-11 — T09: live protection và sửa theo review

Tool: Antigravity assistant (Gemini), theo fragment executor.
Asked for: xác minh main protection trên repo public và làm rõ phạm vi formatter.
Kept: workflow và bốn quality commands đã được review, không thay scripts/tests.
Changed: cấu hình strict quality-gate, một approving review, dismiss stale reviews và enforce admins; lưu API snapshot. Sửa mô tả format-check để phản ánh .github nằm trong .prettierignore.
Rejected: đổi formatter scope chỉ để đưa workflow vào check hoặc thực hiện deliberate break trong T09 thay vì T10.
By hand: fragment ghi executor gọi/đọc GitHub API và chạy checks; đây là khai báo của executor, không phải quan sát trực tiếp của người tổng hợp.
Nguồn: [fragment T09](docs/evidence/PA02/T09/AI-LOG.md), [PR #22](https://github.com/2609-AWAD-23-3/leetkob/pull/22).

## 2026-11-11 — T11: hồ sơ nộp

Tool: Codex (GPT-6) trong OpenClaw, GitHub CLI, Node.js/npm và Prettier theo lockfile.
Asked for: đối chiếu T11 với requirement, rubric và class brief gốc; hoàn thiện README, PA2.md, AI-LOG.md và SELF_ASSESSMENT_REPORT.md.
Kept: evidence kỹ thuật theo task; contract publish; links PR/commit/CI; metadata ba thành viên; bảng tự chấm bảy tiêu chí và phần chưa làm được.
Changed: thay README skeleton lỗi thời bằng setup/commands/publish demo hiện tại; tổng hợp AI fragments theo task thay sao chép toàn bộ log; phân biệt estimate với measured cost và cap; sửa tên reviewer trong hồ sơ T08; đồng bộ trạng thái/checklist plan với Issues/PR đã xác nhận; bỏ câu dẫn bản nháp và nội dung điều phối khỏi báo cáo nộp, giữ giới hạn kỹ thuật thực tế.
Rejected: tự điền thông tin sinh viên, gán phần assistant viết thành code làm tay, chép trao đổi riêng, coi estimate là cap hoặc dùng PR run thay CI run của tag.
By hand: Vỹ cung cấp ba họ tên và StudentID, kiểm tra nội dung hồ sơ. Assistant soạn/chỉnh tài liệu và thực hiện các commands; không ghi nhận code T11 do sinh viên viết tay.

Kiểm chứng: clone local sạch trên baseline b9fcd4c, cài từ lockfile, bốn quality commands exit 0 và 83/83 tests pass; demo README xác minh initial/repeat publish, body không đổi và replay header. Sau các chỉnh sửa báo cáo, format-check và diff-check đều đạt; không đổi source/tests.
Nguồn: [evidence T11](docs/evidence/PA02/T11/README.md), [README](README.md), [PA2.md](PA2.md), [self-assessment](SELF_ASSESSMENT_REPORT.md).

## 2026-11-11 — T11: sửa tính nhất quán hồ sơ theo review PR #26

Tool: Codex (GPT-6) trong OpenClaw, GitHub CLI và Prettier theo lockfile.
Asked for: xử lý các phát hiện về trạng thái task, tiêu chí checklist và các liên kết evidence.
Kept: R2 tự chấm 8/10, tổng 95/100 và khai báo spending cap chưa xác minh.
Changed: đổi summary T05 thành chưa hoàn tất do thiếu evidence cap; khôi phục câu gốc của checklist PA2/tag-run và bỏ tick; chuyển phương án tag-run sang phần evidence của plan; dùng snapshot protection công khai làm nguồn chính; diễn đạt liên kết tag CI trung tính để phù hợp commit freeze.
Rejected: thay câu tiêu chí để đánh dấu đạt, dùng Issue Closed thay acceptance hoặc mô tả trạng thái tag-run tạm thời trong bản freeze.
By hand: Vượng cung cấp nhận xét kỹ thuật tại PR #26; assistant chỉnh tài liệu và chạy kiểm tra. Không thay source/tests.
Nguồn: [review comment](https://github.com/2609-AWAD-23-3/leetkob/pull/26#issuecomment-6795965312), [plan](docs/plans/PA02.md), [PA2.md](PA2.md).

## 2026-11-11 — T12: audit trước release

Tool: Codex trong OpenClaw, GitHub CLI, Git, Node/npm và Gitleaks 8.30.1.
Asked for: kiểm chứng baseline đã tích hợp trước khi freeze, tag và đóng gói bản nộp PA02.
Kept: hồ sơ T11 đã review, self-assessment 95/100, commands/contract/tests và break/fix history.
Changed: clone mới baseline 8d79ba1, cài/chạy bốn quality commands; kiểm tra lại public/main protection và security tree/history/refs/config. Phân loại riêng 7 public fixture headers và 26 file digests sau khi helper T05 từ chối findings mới hoặc source hash đã format. Đồng bộ hoàn tất T11 theo approval đúng head và merge PR #26; giữ các mục tag/ZIP/submission T12 chưa đạt.
Rejected: ép scanner exit 0, suppress findings, coi model cost estimate là cap, lấy PR run thay tag CI hoặc đóng ZIP từ workspace có dependencies/private configuration.
By hand: Vượng review độc lập T11 trên PR #26. Assistant thực hiện audit và soạn records; chưa ghi nhận thao tác tag/đóng gói/nộp đã hoàn thành.
Nguồn: [evidence T12](docs/evidence/PA02/T12/README.md), [verification](docs/evidence/PA02/T12/verification.json).
