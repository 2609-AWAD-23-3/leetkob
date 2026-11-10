# Đầu vào AI-log — T05

Đầu vào cho T11 tổng hợp vào AI-LOG.md ở root; không thay review độc lập hoặc hồ sơ milestone.

## 10/11/2026 — Rules, permissions, environment và secrets evidence

**Công cụ (Tool):** Codex assistant; Gitleaks portable 8.30.1 cho kiểm tra secrets.

**Yêu cầu (Asked for):** triển khai T05 trên nhánh riêng, giữ thay đổi local để người dùng review, chưa commit.

**Phần giữ lại (Kept):** AGENTS.md bốn phần, permissions ba mức, .env.example giá trị trống, ignore credential local, incident notes có trace, scan history/working tree/Git config, report đã loại bỏ giá trị match/secret và hồ sơ model/cost chưa xác minh.

**Phần điều chỉnh (Changed):** dùng hai sự cố thực tế của T02 để viết rules: công việc ở sai worktree và việc assistant đã push/mở PR trước khi người dùng mong muốn. Nguồn là trao đổi thực tế trong phiên và artifact T02; không bịa một GitHub comment hoặc commit chứa toàn bộ sự kiện. Scan giữ nguyên bốn findings lịch sử và xác minh chúng là SHA-256 của file, không bỏ qua để có exit code xanh.

**Phần không chọn (Rejected):** không xem policy Markdown là sandbox/protection đã enforce; không gọi model thật để lấy cost; không nhận budget alert là spending cap; không ghi raw secrets, raw chat hoặc tự cho rằng thiếu evidence tức là nhóm chưa có tài khoản.

**Phần làm tay (By hand):** người dùng chỉ định scope, ngôn ngữ tài liệu và giới hạn chưa commit. Assistant soạn tài liệu, collector và chạy kiểm tra.

## Nguồn sự cố dùng cho rules

<a id="t05-i01"></a>

### T05-I01 — Làm ở sai worktree

Khi tiếp nối T02 ngày 09/11/2026, người dùng chỉ định repo ổ D: nhưng nhánh/kế hoạch chưa commit đang nằm ở worktree ổ C:. Assistant kiểm tra, sao lưu và đối chiếu hash trước khi chuyển về đúng repo. Từ sự cố này, AGENTS.md yêu cầu kiểm tra root/branch/status và bảo toàn thay đổi trước khi chuyển worktree. Nguồn bổ sung: [incident notes](incidents.md#t05-i01) và [AI-log T02](../T02/AI-LOG.md).

<a id="t05-i02"></a>

### T05-I02 — Công bố remote trước kỳ vọng của người dùng

Trong T02, assistant hiểu yêu cầu triển khai plan là gồm push/mở PR #18; người dùng hỏi lại vì chưa mong muốn công bố ở bước đó. Assistant thừa nhận đã hiểu quá rộng. AGENTS.md bổ sung rule tách quyền sửa local khỏi commit/push/PR/issue. Sau đó người dùng cho phép rõ việc push bản dịch T02 tại a499efc; quyền này không tự áp dụng cho task khác. Nguồn: [incident notes](incidents.md#t05-i02), [PR #18](https://github.com/2609-AWAD-23-3/leetkob/pull/18) và phản hồi thực tế trong phiên, không giả nhận có GitHub comment ghi lại sự cố.

Các entry này là tường trình bổ sung sau sự kiện, cần người dùng kiểm tra. Chi tiết kết quả và các mục còn thiếu nằm trong [evidence T05](README.md).

## 11/11/2026 — Rút gọn rules theo rubric

**Công cụ:** Codex assistant.
**Yêu cầu:** người dùng đưa nguyên rubric và yêu cầu rules ngắn, bốn phần, áp dụng cho repo thay vì cố định PA02, có hai dòng trace tới sự cố thật.
**Giữ lại:** stack thực tế, commands, conventions và ba điều cấm sản phẩm; hai sự cố T02 đã được tường trình.
**Điều chỉnh:** bỏ phân công/mốc PA02 và chi tiết store khỏi rules root, dẫn scope theo task; dẫn hai dòng rules trực tiếp tới entry AI-log có anchor. Commands yêu cầu đối chiếu manifest của checkout vì nhánh local chưa cập nhật T04.
**Không chọn:** không nhận scan/verification ngày 10/11 kiểm chứng bản rules đã chỉnh ngày 11/11.
**Phần làm tay:** người dùng chỉ ra vấn đề và cung cấp rubric; assistant soạn bản sửa.

## 11/11/2026 — Đồng bộ develop và làm rõ trạng thái tài liệu

**Công cụ:** Codex assistant.

**Yêu cầu:** fetch develop hiện tại, đồng bộ vào T05 và sửa các vị trí tài liệu đã chỉ ra; giữ yêu cầu chưa commit/push.

**Giữ lại:** hai sự cố thật làm nguồn rules; nội dung T02/AI-LOG.md do người dùng chủ động chỉnh; các JSON scan/verification ngày 10/11 giữ nguyên như bản ghi lịch sử.

**Điều chỉnh:** sao lưu 16 file local và đối chiếu nội dung; dùng autostash tạm để fast-forward từ 2dfff8f tới 09245d7 rồi áp lại thay đổi, không có conflict. Kiểm tra phần T05 local và các phần T01–T04 từ develop đều còn nguyên. T04 hiện cung cấp lint/format-check/type-check/test nên bỏ hướng dẫn fallback runner cũ khỏi AGENTS.md. Permissions chỉ giữ policy lâu dài; trạng thái được ghi tại hồ sơ tiến độ. README/plan phân biệt base ban đầu, baseline mới và kết quả snapshot cũ. Đối chiếu source runtime vẫn chỉ đọc HOST/PORT.

**Không chọn:** không cập nhật thủ công SHA/ngày/kết quả JSON để giả nhận đã scan baseline mới; chưa chạy lại secrets scan hoặc full quality commands trong lượt chỉnh tài liệu này. Lần kiểm tra bảo toàn local đầu tiên dùng chuỗi tiếng Việt qua PowerShell bị sai encoding; đã sửa script kiểm tra bằng đối chiếu nội dung/section và xác nhận bảo toàn, không thay source để né lỗi.

**Phần làm tay:** người dùng xác nhận thay đổi T02 là chủ đích và yêu cầu chỉnh tài liệu; assistant thực hiện thao tác đồng bộ/chỉnh sửa. Không tạo commit T05 hoặc push trong lượt này; autostash chỉ là cơ chế cất/áp lại local changes, không phải commit bàn giao task.

## 11/11/2026 — Kiểm chứng lại sau khi người dùng duyệt nội dung

**Công cụ:** Codex assistant; Node 24.22.1/npm 11.19.1; Gitleaks 8.30.1; các quality tools theo lockfile T04.

**Yêu cầu:** người dùng đồng ý permissions, hai sự cố và khai báo công việc, yêu cầu thực hiện bước scan/checks tiếp theo; chưa cho commit/push.

**Giữ lại:** rules đã duyệt, source sản phẩm và phần T02/AI-log do người dùng chỉnh. Lưu exit codes gốc, kể cả scan có findings và format-check thất bại.

**Điều chỉnh:** cài dependencies theo lockfile của baseline 09245d7, chạy lint/type-check/test/format-check. Lint/type-check đạt, build và 67 tests đạt. Format-check báo 15 file ở checkout đang làm; checkout sạch cùng SHA vẫn lỗi 7 file source. Không tự format source ngoài T05. Scan mới có 10 findings lịch sử và 2 findings working tree ở SHA-256 manifest T03; mở rộng helper để kiểm chứng snapshot working tree bằng hash, không suppress findings. Tất cả 12 được đối chiếu là digest của file thật. Tiếp tục scan output JSON riêng và lưu kết quả mới trong verification.json.

**Không chọn:** không coi false positives là scan exit 0, không đổi rules/baseline/ignore để giấu findings; không nhận full quality gate đạt khi format-check còn lỗi; không tự điền provider/cap/cost hoặc gọi model. Lần đọc metadata findings đầu tiên bị lỗi cú pháp pipeline PowerShell; sửa cách thu metadata, không in raw matches hoặc đổi dữ liệu scan.

**Phần làm tay:** người dùng duyệt nội dung/chỉ định bước tiếp theo; assistant chạy kiểm tra, phân loại findings và cập nhật hồ sơ. Không tạo commit T05, push, cập nhật GitHub hoặc xác nhận review độc lập.

## 11/11/2026 — Sửa formatting theo yêu cầu người dùng

**Công cụ:** Codex assistant; Prettier theo lockfile; Node 24.22.1/npm 11.19.1; Gitleaks 8.30.1.

**Yêu cầu:** người dùng yêu cầu sửa các lỗi formatting vừa được báo; giữ yêu cầu chưa commit/push.

**Giữ lại:** bản sao 15 file trước format, kết quả failed format-check và baseline sạch, logic code và kỳ vọng tests. Phần T02/AI-log do người dùng chỉnh được giữ nguyên.

**Điều chỉnh:** chỉ chạy Prettier trên 15 file bị cảnh báo; 7 file có diff style trong Git, các file còn lại chỉ chuẩn hóa EOL. So sánh AST trước/sau xác nhận tương đương, rồi chạy lại lint/format-check/type-check/test: tất cả exit 0, build và 67 tests đạt. Cập nhật snapshot scan sau thay đổi bytes. Evidence T03 lịch sử không được sửa để ép hashes khớp source mới; helper chỉ phân loại digest sau khi chứng minh manifest không đổi và digest khớp source lịch sử được chỉ định.

**Không chọn:** không sửa assertion/logic chỉ để checks pass; không bỏ lịch sử failed checks; không tự nhận approval của các owner khác. Helper AST đầu tiên không dùng được API JavaScript của TypeScript 7 cài trong repo; chuyển sang parser có sẵn trong Prettier. Lượt so sánh đầu với parser này còn tính metadata vị trí __contentEnd nên khác hash; loại đúng metadata vị trí rồi đối chiếu lại từ bản sao trước format, không bỏ qua khác biệt ngữ nghĩa.

**Phần làm tay:** người dùng cho phép sửa formatting, assistant format/kiểm chứng/cập nhật hồ sơ. Không commit/push hoặc cập nhật GitHub.

## 11/11/2026 — Ước tính chi phí và người dự kiến giữ key

**Công cụ:** Codex assistant, skill OpenAI Docs để tra giá chính thức, phép tính local; không gọi model API.

**Yêu cầu:** người dùng cho biết chưa có key, yêu cầu viết estimate và chỉ định dự kiến Vỹ giữ key.

**Giữ lại:** trạng thái chưa có key/cap/measured; phân biệt estimate với số đo thực tế và quyền quản lý đã được xác nhận.

**Điều chỉnh:** ghi Vỹ là người dự kiến quản lý, chưa nhận đã tiếp nhận hoặc cấu hình cap. Dùng GPT-5.4 Mini làm tham chiếu tính tiền, không tự chốt provider/model triển khai cho nhóm. Tra giá chính thức ngày 11/11/2026: 0,75 USD input và 4,50 USD output cho mỗi triệu token. Hai kịch bản 80 bài được tính, 3 hoặc 5 semantic constraints, giả định token và retry rõ ràng; estimate lần lượt 1,73 và 5,76 USD/lab khi 20% cặp retry một lần. Output bao gồm reasoning bị tính phí nếu có.

**Không chọn:** không dùng estimate làm bằng chứng spending cap, không nhận giá của model tham chiếu là giá model đã chốt, không bịa usage/billing hoặc gọi model để lấy số đo. Chưa đánh dấu hoàn thành mục cap/model thực tế.

**Phần làm tay:** người dùng chỉ định Vỹ ở mức dự kiến và yêu cầu bản tính; assistant tra nguồn, tính toán và viết tài liệu. Không có xác nhận tài khoản/key từ Vỹ trong phiên này; chưa commit/push.
