# T05 — Rules, permissions, secrets và hồ sơ chi phí

**Thực hiện:** Nguyễn Khắc Vượng (vinny2707). **Reviewer độc lập:** Vỹ (tranquocvy).
Nguồn acceptance: [T05 trong plan PA02](../../../plans/PA02.md#t05--rules-permissions-v%C3%A0-secrets), [Issue #5](https://github.com/2609-AWAD-23-3/leetkob/issues/5).

**Trạng thái:** đã công bố [Draft PR #21](https://github.com/2609-AWAD-23-3/leetkob/pull/21), commit 444add2. Review đã sửa của Vỹ yêu cầu hai mục: hồ sơ spending cap tại mục 5 của model-cost.md và khả năng chạy lại scan/triage sau commit. Bản sửa tiếp theo giữ local để Vượng review, chưa commit/push. Helper đã kiểm chứng các digest T03/T05; bằng chứng cap thực tế vẫn chưa được cung cấp. Đã có estimate tham chiếu và Vỹ là người dự kiến giữ key. Nhánh bắt đầu từ 2dfff8f và tích hợp develop tại 09245d7 trước commit T05. Không yêu cầu khai báo lại công cụ đã ghi đúng trong AI-log, gọi model thật hoặc chốt production model để tạo evidence. Checklist nghiệm thu chính vẫn ở plan/issue; không tự tick review items thay Vỹ.

**Kiểm chứng lại ngày 11/11/2026:** lần trước commit dùng baseline 09245d7; bản sửa theo review dùng HEAD 444add2 cùng thay đổi local. Manifest file/hash trong scan xác định snapshot mới, reviewRevision trong verification.json ghi kiểm chứng bản sửa; các trường cũ vẫn giữ kết quả tại thời điểm thu trước commit. Cả bốn quality commands đã đạt; lượt dọn tài liệu tiếp theo không đổi source/tests. Đây là kiểm chứng local của assistant; review độc lập của Vỹ áp dụng commit 444add2, chưa áp dụng bản sửa local này.

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
- **History:** repo không shallow, đã fetch origin/tags. Scan tất cả local refs và reflogs với full history, root commits và merge diffs. Số commits/refs và SHA của lượt chạy hiện tại ghi trong report; không suy ra lượt scan trước commit bao gồm chính commit T05.
- **Metadata:** scan thêm commit messages, tên/nội dung refs và tag; không chỉ scan diff source.
- **Git config/remote:** scan config áp dụng từ system/global/repository và remote URLs; kiểm tra bổ sung URL có userinfo, Authorization extraheader và key config nhạy cảm. Chỉ ghi số đếm, không lưu config thô hoặc chạy credential helper.

Snapshot trước commit có 10 findings lịch sử và 2 working tree thuộc manifest T03. Lượt chạy từ HEAD 444add2 có 13 findings history và 2 working tree, gồm thêm 3 digest T05; 15/15 được kiểm chứng riêng, không có finding chưa phân loại. Helper đối chiếu từng entry thuộc sha256WorkingFiles của T03 hoặc workingTree.fileSha256 của T05 với source tại đúng commit, hoặc file local có hash trùng snapshot; xét dạng git blob/LF/CRLF. Nếu source local đã format, chỉ xét HEAD/ancestor khi toàn bộ evidence giống hệt bản ở HEAD và ở revision được chọn. Các trường manifestName, sourcePath, verifiedFormats và verifiedAgainst ghi rõ nguồn chứng minh. Finding mới, entry ngoài manifest hoặc digest không khớp làm helper dừng để review riêng. Không thay rules/ignore/baseline hoặc xóa history để che findings.

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

- Vỹ đã review độc lập commit 444add2: rules/permissions/env/ignore phù hợp, không phát hiện regression; cần review lại bản bổ sung evidence.
- Các thay đổi style ở source T02/T03 đã được người dùng cho phép, chỉ format và được kiểm chứng tương đương AST. Reviewer cần xem phần diff này cùng kết quả bốn quality commands, không suy ra đã có thay đổi nghiệp vụ hoặc đã được owner khác approve.
- Vỹ là người dự kiến quản lý key; cần bổ sung mức cap, kỳ áp dụng, phạm vi account/project và hành vi khi chạm giới hạn cùng bằng chứng đã che tại mục 5 của model-cost.md. Ước tính và số đo giữ riêng; measured chưa có ghi đúng là chưa đo. Không yêu cầu gọi model thật hoặc chốt production model để tạo evidence cho PR này; không tự chấm rubric cao nhất khi thiếu bằng chứng.
- Giữ khai báo công cụ thực tế của T05 trong [AI-log](AI-LOG.md), không thêm danh sách công cụ chưa sử dụng. T11 tổng hợp AI-log từng task; PR T05 không sửa các báo cáo root.
- PR #21 đã mở với Refs #5. Bản sửa theo review chưa được công bố; không tick các review items thay Vỹ, không merge/đóng task khi thiếu acceptance.
- Bàn giao T11 nội dung README/AI-log/security/cost; không tự sửa README setup/manifest/tooling thuộc Vỹ trong T05. Việc cài key/cap thực tế do người có quyền, không do assistant tự thao tác.
