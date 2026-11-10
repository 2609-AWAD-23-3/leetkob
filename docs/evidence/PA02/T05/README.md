# T05 — Rules, permissions, secrets và hồ sơ chi phí

**Thực hiện:** Nguyễn Khắc Vượng (vinny2707). **Reviewer độc lập:** Vỹ (tranquocvy).
Nguồn acceptance: [T05 trong plan PA02](../../../plans/PA02.md#t05--rules-permissions-v%C3%A0-secrets), [Issue #5](https://github.com/2609-AWAD-23-3/leetkob/issues/5).

**Trạng thái:** người dùng đã đồng ý nội dung permissions, hai sự cố và khai báo AI; đang kiểm chứng bản T05 trước review độc lập. Đã có estimate tham chiếu và Vỹ là người dự kiến giữ key; chưa chốt model triển khai hoặc xác minh spending cap/measured nên chưa đủ điều kiện nghiệm thu. Nhánh feat/t05-rules-permissions-secrets được tạo từ 2dfff8f11cc6c28a8f5d8795bf915735b117902c và đã đồng bộ develop bằng fast-forward tới baseline 09245d7391f229b7d8b6e40d2ff124e14fa552d4. Checklist nghiệm thu chính vẫn ở plan/issue; bảng dưới chỉ đối chiếu artifact, không tạo định nghĩa hoàn thành mới.

**Kiểm chứng lại ngày 11/11/2026:** dùng baseline 09245d7 có T03/T04 và bản T05 local đã chỉnh. JSON hiện tại là kết quả chạy lại; HEAD chỉ định baseline, còn manifest file/hash xác định đúng snapshot có thay đổi chưa commit. Sau khi người dùng yêu cầu sửa formatting, cả bốn quality commands đã đạt. Đây là kiểm chứng local, chưa phải CI hoặc review độc lập.

## 1. Những gì đã chuẩn bị

| Phần T05                 | Artifact và trạng thái local                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules bốn phần           | [AGENTS.md](../../../../AGENTS.md): stack, commands, conventions, never. Assistant đã đọc file này trong phiên sau khi tạo; chưa suy ra mọi công cụ AI khác của nhóm đều tự đọc nó  |
| Permissions ba mức       | [permissions](../../../security/permissions.md): allowed / ask first / never; phân biệt policy với enforcement                                                                      |
| Environment/ignore       | [.env.example](../../../../.env.example) có HOST/PORT giá trị trống; [.gitignore](../../../../.gitignore) bổ sung các credential/private-key local. Chưa sửa config hoặc cài dotenv |
| Hai rules truy vết sự cố | [incidents](incidents.md): sai worktree và quyền công bố remote; người dùng đã đồng ý tường trình, còn review độc lập của Vỹ                                                        |
| Security scan            | [scan đã redacted](security-scan.json), [phân loại findings](security-triage.json), [cách chạy lại](security-scan.md)                                                               |
| Provider/model/cap/cost  | [model-cost](model-cost.md): estimate tham chiếu 1,73 USD/lab chuẩn hoặc 5,76 USD/lab nặng; dự kiến Vỹ giữ key, chưa xác minh cap/measured                                          |
| Bàn giao T11             | Hồ sơ local và [AI-log input](AI-LOG.md) đã soạn; chưa xác nhận review hoặc tiếp nhận bàn giao cuối                                                                                 |

## 2. Kết quả và phạm vi kiểm chứng lại ngày 11/11/2026

Scan dùng Gitleaks 8.30.1 portable tải từ release chính thức, checksum archive đã đối chiếu; cấu hình mặc định được pin theo tag và SHA-256. Không cài global, thay runtime hoặc sửa dependency/manifest/lockfile. Collector chỉ phục vụ evidence T05, không thay runner chung T04.

- **Working tree:** scan snapshot gồm file tracked, untracked, hidden và ignored của repo; loại root .git, node_modules, dist cùng các report tự sinh để tránh tự tham chiếu. Symlink nếu có phải được liệt kê và giữ là phần chưa kiểm tra. Danh sách file/hash nằm trong security-scan.json.
- **History:** repo không shallow, đã fetch origin/tags. Scan tất cả local refs và reflogs với full history, root commits và merge diffs. Phạm vi lượt chạy lại ghi 32 commits duy nhất, 16 refs; xem SHA chính xác trong report.
- **Metadata:** scan thêm commit messages, tên/nội dung refs và tag; không chỉ scan diff source.
- **Git config/remote:** scan config áp dụng từ system/global/repository và remote URLs; kiểm tra bổ sung URL có userinfo, Authorization extraheader và key config nhạy cảm. Chỉ ghi số đếm, không lưu config thô hoặc chạy credential helper.

Scan lịch sử có **10 findings**, working tree có **2 findings**; hai lượt này trả exit 1 đúng với phát hiện. Cả 12 nằm ở SHA-256 manifest trong evidence T03. Helper đối chiếu từng digest với source tại đúng commit, hoặc file local có hash trùng snapshot; xét dạng LF/CRLF. Khi source đã format khác bytes, chỉ đối chiếu source lịch sử tại HEAD sau khi chứng minh toàn bộ evidence T03 vẫn trùng tài liệu ở HEAD; verifiedAgainst chỉ rõ nơi đã xác minh, không nhận hash lịch sử khớp source sau format. Cả 12 là digest hợp lệ, phân loại false positive. Các merge diffs có thể ghi lại cùng loại finding ở nhiều commit nên giữ nguyên số đếm gốc. Metadata và config/remotes không báo finding. Không thay rules/ignore/baseline hoặc xóa history để che findings.

Ba JSON report tự sinh được loại khỏi snapshot để tránh tự tham chiếu, rồi được scan riêng qua stdin. Findings nếu là SHA-256 trong manifest chỉ được phân loại sau khi đối chiếu với file local. Exit code/số findings và bằng chứng phân loại của lượt kiểm tra report được giữ tại verification.json, không đổi exit code gốc thành 0.

**Kết luận có giới hạn:** chưa xác nhận secret thật trong phạm vi đã scan, không có finding chưa phân loại sau bước triage. Không tuyên bố chứng minh tuyệt đối lịch sử không có mọi loại secret. Scanner dựa trên mẫu; các object không còn refs/reflogs, remote refs không truy cập được, file nhị phân/encoding không hỗ trợ và nội dung archive chưa giải nén không được bảo đảm kiểm tra đầy đủ. Không gọi provider để kiểm tra credential còn hiệu lực. Gặp finding mới phải phân loại riêng; không mặc định mọi chuỗi dài là hash.

### Quality commands

Các lệnh chạy bằng Node 24.22.1/npm 11.19.1 theo lockfile. Sau lần format-check thất bại, người dùng đã yêu cầu sửa formatting; chỉ thay style/EOL, không đổi dependency, logic hoặc kỳ vọng tests:

| Kiểm tra             | Kết quả                                                  |
| -------------------- | -------------------------------------------------------- |
| npm run lint         | Exit 0                                                   |
| npm run type-check   | Exit 0                                                   |
| npm test             | Exit 0; build và 67/67 tests đạt, không fail/skip/cancel |
| npm run format-check | Exit 0 sau khi format các file đã được cho phép          |

Kết quả trước sửa vẫn giữ trong verification.json: checkout local cảnh báo 15 file, checkout sạch cùng baseline cảnh báo 7 file. Sau khi được người dùng cho phép, chạy Prettier trên 15 file: Git ghi nhận thay đổi style ở 7 file (src/auth/identity.ts, src/auth/problem-details.ts, src/auth/types.ts, src/data/fixtures.ts, src/data/in-memory-publish-store.ts, tests/auth/publish-auth-errors.test.mjs, tests/data/publish-store.test.mjs); các file còn lại chỉ chuẩn hóa EOL. Đã so sánh AST bằng parser TypeScript của Prettier theo lockfile, bỏ vị trí/comment/raw spelling/metadata vị trí: cả 15 file tương đương trước/sau. Tests đã đạt trước khi format và vẫn 67/67 sau format; không thay assertion để làm check nghiệp vụ pass.

## 3. Cách tự kiểm tra bản local

1. Đọc AGENTS.md và permissions; đối chiếu hai incident notes với trải nghiệm T02 của bạn.
2. Mở .env.example: chỉ có hai biến HOST/PORT với giá trị trống. App chưa load .env; không export giá trị trống vào runtime.
3. Chạy hướng dẫn scan tại [security-scan.md](security-scan.md). Exit 1 từ scanner khi có findings không được đổi thành báo cáo pass; chạy bước triage riêng rồi xem kết quả.
4. Đọc model-cost.md: các giá trị chưa xác minh phải giữ trống/chưa có, không tự điền provider hoặc số tiền.
5. Xem [verification.json](verification.json) cho kết quả mới về rules, env/ignore, links, syntax, whitespace và các quality commands. Luôn kiểm tra timestamp/HEAD và hashes thay vì suy ra một kết quả cũ áp dụng cho thay đổi mới.

Không viết thêm unit tests hình thức cho tài liệu/chính sách. Lượt 10/11 là kiểm tra tài liệu và collector; lượt 11/11 ghi cả format-check thất bại ban đầu và bốn quality commands đạt sau sửa. Đây là kiểm chứng local Windows, không phải CI/T09 hoặc bằng chứng Linux. Trong .prettierignore của T04, docs được bỏ qua; vì vậy tài liệu/collector T05 được kiểm tra formatting riêng, không suy ra từ full format-check.

## 4. Việc còn thiếu trước khi chốt T05

- Người dùng đã đồng ý permissions, tường trình hai incidents và khai báo công việc; Vỹ vẫn cần review độc lập.
- Các thay đổi style ở source T02/T03 đã được người dùng cho phép, chỉ format và được kiểm chứng tương đương AST. Reviewer cần xem phần diff này cùng kết quả bốn quality commands, không suy ra đã có thay đổi nghiệp vụ hoặc đã được owner khác approve.
- Vỹ là người dự kiến quản lý key, cần xác nhận tiếp nhận và cung cấp provider/model, cap cùng cost/lab với bằng chứng đã che. Ước tính và số đo phải tách riêng; thiếu thì giữ blocker, không tự chấm rubric cao nhất.
- Vỹ review độc lập bốn phần rules, ba mức quyền, env/ignore, trace sự cố, phạm vi scan và evidence chi phí.
- Khi người dùng cho phép công bố mới đồng bộ checklist/evidence của plan và Issue #5, commit/push và mở PR vào develop với Refs #5. Không tick các review items thay Vỹ; không merge/đóng task khi thiếu acceptance.
- Bàn giao T11 nội dung README/AI-log/security/cost; không tự sửa README setup/manifest/tooling thuộc Vỹ trong T05. Việc cài key/cap thực tế do người có quyền, không do assistant tự thao tác.
