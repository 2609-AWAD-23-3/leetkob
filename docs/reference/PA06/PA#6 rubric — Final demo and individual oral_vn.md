# PA#6 — Final demo và vấn đáp cá nhân · rubric

> Bản dịch tiếng Việt hỗ trợ tra cứu; [PDF gốc](PA%236%20rubric%20%E2%80%94%20Final%20demo%20and%20individual%20oral.pdf) là tài liệu có thẩm quyền. Đã đọc đủ 10/10 trang gốc bằng text extraction, không bị truncation. Thuật ngữ IT, paths và commands được giữ nguyên.

CSC13114 · milestone dự án · nhóm tối đa 3 người · mỗi thành viên một điểm · 15% môn học · 100 điểm

**Thời gian:** Thứ Năm, ngày 24 tháng 12 và Thứ Năm, ngày 31 tháng 12 năm 2026, 08:20–11:50, tại phòng lý thuyết (cs2:G202). Mỗi nhóm có một slot. Thứ tự nhóm và giờ slot được đăng trên Classroom chậm nhất Thứ Hai, ngày 21 tháng 12 năm 2026. Trong slot, nhóm chạy bản build LeeTKOB cuối qua main flow, sau đó giám khảo hỏi từng thành viên về code và các quyết định của chính nhóm.

Giám khảo là teaching assistant và các lab instructors của lớp này, mỗi người một bàn, làm việc song song. Danh sách slot cho biết nhóm tới bàn nào.

Mỗi thành viên nhận một điểm trên 100, gồm hai phần:

- **Final build — 40 điểm**, giống nhau cho mọi thành viên nhóm. Giám khảo kiểm tra build được demo theo danh sách cố định (phần Final build bên dưới): mười một features của LeeTKOB (Các features phải implement), build đã nộp với dữ liệu thật, failure cases, roles và những gì làm vượt brief.
- **Phần giải thích — 60 điểm**, riêng từng thành viên. Không cố định số câu hỏi hay điểm mỗi câu; giám khảo quyết định hỏi gì và hỏi ai. Thành viên cùng nhóm có thể nhận điểm khác nhau.

Build là bản đã nộp ở PA#5; milestone này không yêu cầu xây thêm gì. PA#3, PA#4 và PA#5 chấm từng phần riêng. Ở đây chấm toàn sản phẩm hoạt động cùng nhau; câu hỏi xác định mỗi người giải thích được gì: code, commits, quyết định, eval và guardrails, incident, kể cả những phần assistant viết và lý do giữ lại. Không có yêu cầu viết code trên giấy hay nơi khác, hoặc nhớ code thuộc lòng.

## Trước slot

Commit `OWNERS.md` vào repository và đăng link tới commit đó trên assignment này chậm nhất **Thứ Hai, ngày 21 tháng 12 năm 2026, 22:00**. File có hai bảng:

| Phần của LeeTKOB | Ai xây dựng | Commits hoặc pull requests chính |
|---|---|---|
| ví dụ queue và judge worker | ví dụ 23120002, cùng 23120003 ở retries | links |

| Vượt brief | Xem ở đâu | Test kiểm tra nó |
|---|---|---|
| ví dụ diff của resubmission sinh viên cho TA | review queue | link |

Bảng đầu không chấm điểm; nó giúp chọn câu hỏi về phần các bạn xây. Thiếu bảng này, chúng tôi chỉ chọn từ `git log`. Bảng thứ hai dùng kiểm tra B5; để trống nếu không có gì.

Giữ deployment chạy commit tag `pa5` tới slot. Thời gian chấm PA#5 kết thúc ngày 23 tháng 12; PA#6 vẫn cần deployment. Walkthrough recording PA#5 là fallback nếu deployment không phản hồi (xem Khi build không chạy được).

## Mang theo gì

- Một laptop mỗi nhóm, sạc đầy, kèm charger và adapter cho máy chiếu HDMI; đã clone repository, checkout tag `pa5`, sẵn sàng chạy tests, eval và command line của checker (brief mục 6). Laptop thành viên thứ hai, đăng nhập tương tự, là fallback đầu tiên.
- Mở sẵn deployment trước khi lên: mỗi account một browser window, đã đăng nhập — admin, TA, hai sinh viên trong lớp của TA đó và TA lớp khác — cùng observability tools truy cập được chỉ bằng một click.
- Phone hotspot. Đừng trông cậy network của phòng.
- Thẻ sinh viên.

Có thể bắt đầu từ seed data: accounts, classes và các lab khác. Lab demo, submissions của nó và mọi điều xảy ra với chúng đều phải tạo trước mặt chúng tôi.

## Slot diễn ra thế nào

| Phần | Thời gian | Ai thực hiện |
|---|---|---|
| Kiểm tra build | 1 phút | Chúng tôi mở version endpoint hoặc page footer của deployment và chạy `git log -1 --format=%H` trên laptop |
| Main flow và các features khác | 8 phút | Nhóm, mọi role; chúng tôi yêu cầu features chưa được flow thể hiện và yêu cầu reload |
| Build checks | 2 phút | Chúng tôi chỉ định hai rules để thử failure cases, và một kiểm tra role hoặc ownership |
| Câu hỏi | khoảng 4 phút mỗi thành viên | Giám khảo, lần lượt từng thành viên |

Nhóm ba người mất khoảng 23 phút; nhóm hai người khoảng 19 phút. Có mặt tại phòng từ đầu buổi: slot kết thúc sớm thì slot tiếp theo bắt đầu. Giám khảo có thể hỏi trong demo. Đồng đội ở lại phòng và giữ im lặng khi một thành viên trả lời.

## Các features phải implement

Đây là features LeeTKOB mà build phải có. Chúng đến từ phạm vi mục 4 của brief và các tiêu chí PA#3, PA#4, PA#5 ghi sau từng feature; cột cuối là rules áp dụng. Trong slot, main flow bên dưới thể hiện phần lớn; sau đó chúng tôi yêu cầu feature chưa được thể hiện.

| # | Feature | Ai | Những gì phải hoạt động | Rules |
|---|---|---|---|---|
| F1 | Accounts, roles và classes (brief 4.1; PA#3 1) | Admin, TA, Student | Accounts cho ba roles; TAs thuộc classes, mỗi lab thuộc một class; mỗi role chỉ thấy màn hình của mình. TA lớp khác không xem được lab hoặc review queue của nó. | T1 |
| F2 | Lab có tests và constraints (PA#3 1; PA#5 2) | TA | Lab trong lớp của chính TA: statement, tests và constraints, mỗi constraint có deduction do TA chọn, một do hard rule quyết định (“Do not use…”) và một cho model. | T1 |
| F3 | Submit và judge, real-time (brief 4.2; PA#3 1–2; PA#5 2) | Student | C++ submission vào queue, worker riêng judge theo tests của TA. Status trên trang sinh viên đổi từ queued tới kết quả cuối không reload. | Q1 |
| F4 | Sandbox (brief 5; PA#3 2) | Pipeline | Compile và run trong sandbox; đáp ứng chín mức tối thiểu của brief, mỗi mức có attack submission trong repository chạy ở CI. | M1–M9 |
| F5 | Hard rules trước (brief 3; PA#3 3) | Pipeline | Ban-list constraints do syntax-aware code quyết định. Không bị các bẫy kích hoạt: `sort` tự viết của sinh viên, tên bị cấm trong comment hoặc string, include `<algorithm>` chỉ cho `std::swap`. Không gọi model cho constraint đã được hard rule quyết định. | D1 |
| F6 | Model judge semantic constraints (brief 3; PA#3 4) | Pipeline | Model thật, chỉ nhận statement, constraints và code đã loại comments và danh tính sinh viên, trả `pass`, `violation` hoặc `unsure` cho từng constraint, kèm evidence lines. Không có gì trong output quyết định deduction. | G5 |
| F7 | Guardrails cho model output (brief 3; PA#3 5; PA#4 3) | Pipeline, TA | Output sai schema, evidence không khớp code, timeout và cost cap theo lab đều chuyển verdict thành `unsure`, TA thấy lý do. Injection submission kết thúc là `violation` hoặc `unsure`, không bao giờ `pass`. | G1–G4 |
| F8 | Review queue và Publish (brief 3; PA#3 5; PA#4 4) | TA | Queue chứa mọi `violation`, mọi `unsure` và 10% ngẫu nhiên của các verdict `pass`, mỗi mục có evidence và deduction của TA. TA review rồi nhấn Publish, hành động duy nhất làm deduction hiển thị với sinh viên. | H1–H3 |
| F9 | Điểm đã publish và appeals (brief 4.4; PA#5 2) | Student, rồi TA | Sau Publish, mỗi sinh viên đọc điểm và deduction. Sinh viên appeal; TA reject kèm lý do sinh viên thấy, hoặc accept và điểm đã publish thay đổi. | A1–A3 |
| F10 | Checker command và eval gate (brief 4.5, 6; PA#3 6; PA#4 1) | Team | Một command line ghi prediction file từ dataset folder, có switch tắt model `MODEL_OFF=1`. CI job chạy checker trên dev set và cases tự tạo, rồi `eval.mjs`, và là required check trên `main`. | — |
| F11 | Logs, metrics và traces (PA#5 3) | Team | Với submission tạo trước mặt chúng tôi: mọi log line tìm bằng một id; trace từ request qua queue, sandbox, hard rules và từng model call tới verdict được lưu; dashboard; SLO và alert. | — |

### Rules theo nhãn

Ở B3, chúng tôi chỉ định hai rules có thể thử trên running build.

| Nhãn | Rule | Nguồn | Thử trên running build |
|---|---|---|---|
| T1 | TA lớp khác không xem được lab hoặc review queue của nó | PA#3 tiêu chí 1 | direct request |
| Q1 | Submission khi worker dừng được judge đúng một lần sau khi worker chạy lại | PA#3 tiêu chí 2 | dừng worker, submit, khởi động lại |
| M1–M9 | Chín mức sandbox tối thiểu: M1 không network; M2 CPU time; M3 wall-clock limit kill container; M4 memory gồm swap; M5 processes; M6 output size; M7 non-root user; M8 không host mounts và không Docker socket; M9 không secrets | PA#3 tiêu chí 2; brief 5 | attack submission trong repository |
| D1 | Hard rules quyết định ban-list constraints, bẫy không kích hoạt, không gọi model cho chúng | PA#3 tiêu chí 3 | trap submission, rồi call log |
| G1–G5 | Năm guardrails: G1 schema; G2 evidence; G3 timeout; G4 cost cap theo lab; G5 không deduction từ model | PA#4 tiêu chí 3 | G4 và G5 (lab cap thấp, injection submission); G1–G3 chỉ qua tests nên không được chỉ định cho B3 |
| H1–H3 | Human gate: H1 mẫu passes là ngẫu nhiên, do server lấy; H2 API từ chối Publish khi còn verdict trong queue chưa review; H3 từ chối Publish với sinh viên và TA lớp khác | PA#4 tiêu chí 4 | direct requests |
| A1–A3 | Appeals: A1 từ chối trước publishing; A2 từ chối trên submission sinh viên khác; A3 quyết định lưu ai, khi nào, vì sao | PA#5 tiêu chí 2 | trên running build |

Load test (brief 4.6) chỉ chấm ở PA#5, không chấm trong slot.

## Final build — 40 điểm cho nhóm

Demo chấm theo danh sách cuối phần này. Mọi thành viên nhận cùng build points. Demo cũng là nơi bắt đầu các câu hỏi.

**Main flow trên deployment.** Đây là walkthrough PA#5 tiêu chí 2, một lab từ tạo tới appeal: với role TA, tạo lab có tests và hai constraints, một do hard rule quyết định và một cho model, mỗi constraint có deduction (bài `sort-merge` của dev set được chấp nhận) → với role student 1, submit lời giải tuân thủ; student 2 submit lời giải vi phạm constraint; xem judge status đổi trên trang từng sinh viên → student 2 thử appeal trước publish → TA mở review queue: verdicts, evidence lines và deductions; thử Publish khi còn verdict chưa review, rồi review và nhấn Publish → mỗi sinh viên đọc điểm và deduction → student 2 appeal; TA reject với lý do hoặc accept → mở logs và trace submission student 2. Chúng tôi có thể đưa thêm một submission để gửi, ví dụ injection case. Ở chỗ brief không nói rõ, sản phẩm theo FAQ của product owners; nêu các entries sử dụng.

Mỗi account hoạt động trong window đăng nhập riêng trên deployment thật: khi yêu cầu reload, dữ liệu vẫn còn và Network tab cho thấy requests tới API. Screens, layout, wording và architecture do nhóm chọn: chúng tôi xem feature hoạt động hay không, không xem hình thức.

**Failure cases.** Chúng tôi chỉ định hai rules ở bảng trên, ví dụ: attack submission trong repository thử network hoặc đọc environment (M1, M9); trap submission có `sort` tự viết không được flag (D1); injection submission yêu cầu `pass` (G5); Publish khi còn verdict chưa review qua direct request (H2); appeal trước publishing (A1). Server phải chặn đúng rule, với message hoặc error nói điều gì sai; sau reload dữ liệu không thay đổi — server chặn, không chỉ ẩn button.

**Build đã nộp.** Deployment chạy commit tag `pa5`, version endpoint hoặc footer hiển thị hash đó. Nói trước khi bắt đầu về mọi thay đổi nhỏ (configuration value, seed). Bug fix sau deadline PA#5 không thuộc demo: nếu deployment chạy commit mới hơn, deploy lại `pa5` trước slot hoặc chạy `pa5` trên laptop; có thể nói về fix lúc được hỏi. Nếu PA#5 không được nhận (trễ quá 24 giờ), demo commit mới nhất; chúng tôi ghi nhận đó không phải build đã nộp.

| # | Nội dung kiểm tra | Điểm |
|---|---|---:|
| B1 | Mười một features F1–F11 (bảng trên), mỗi feature thể hiện trên running build trong window đăng nhập riêng của account. 2 điểm cho feature hoạt động; 1 nếu chỉ hoạt động một phần, chỉ sau restart hoặc thử lần hai, hoặc chỉ trong recording; 0 nếu thiếu hoặc giả (status đặt ở front end, stub thay model thật, sửa tay một dòng database, gõ tay verdict). | 22 |
| B2 | Build đã nộp với dữ liệu thật: version endpoint/footer hiển thị commit `pa5`; khi được yêu cầu, reload tại hai điểm vẫn giữ dữ liệu, Network tab hiển thị requests tới API. | 4 |
| B3 | Hai rules ở cột cuối bảng do chúng tôi chỉ định và các bạn thử failure case: server chặn đúng rule (attack submission thất bại, verdict thành `violation` hoặc `unsure`, request bị từ chối bằng error contract đặt tên), dữ liệu không đổi sau reload. Mỗi rule 3 điểm; 1 khi chỉ màn hình chặn hoặc chỉ test thể hiện. | 6 |
| B4 | Roles và ownership: chúng tôi thử một screen hoặc endpoint của role khác, class khác hoặc sinh viên khác bằng URL hoặc `curl`; API từ chối. | 4 |
| B5 | Vượt brief: những gì nhóm xây mà brief không yêu cầu, liệt kê trong `OWNERS.md`. 4 nếu hoạt động trên running build và có test kiểm tra; 2 nếu hoạt động nhưng không gì kiểm tra; 0 nếu không có. | 4 |
| | Tổng | 40 |

Hành vi từ FAQ của product owners không phải “vượt brief”: đó là một phần của feature tương ứng. Build points giống nhau cho mọi thành viên, kể cả người có phần không bị lỗi.

## Có thể được hỏi về gì

Bất cứ thứ gì trong repository và quyết định của nhóm — không phải lý thuyết bài giảng; phần đó thuộc kỳ thi. Giám khảo chọn câu hỏi, số câu và phần hệ thống hỏi mỗi thành viên. Họ chuẩn bị từ repository tại `pa5`, `git log`, `AI-LOG.md`, post-mortem và `OWNERS.md`; có thể hỏi tiếp mọi điều bạn nói hoặc demo thể hiện. Mỗi người nhận câu hỏi khác nhau.

| Lĩnh vực | Câu hỏi về |
|---|---|
| A | Đọc code của bạn |
| B | Vì sao nhóm quyết định như vậy |
| C | Làm sao biết nó hoạt động |
| D | Feature LLM trên input cho trước |

Ví dụ dưới mỗi lĩnh vực thể hiện loại câu hỏi, không phải danh sách cố định; mỗi thành viên không nhất thiết được hỏi mọi lĩnh vực.

### A. Đọc code của bạn

Chúng tôi chỉ vào commit, diff hoặc vài dòng bạn xây, hoặc dòng demo vừa chạy, và hỏi chúng làm gì.

- Dòng này làm gì, xóa nó thì điều gì hỏng?
- Commit này thay đổi retry của judge worker. Trước đó nó làm gì?
- Đi theo một submission từ upload tới review queue: file nào xử lý từng bước?

Câu trả lời tốt nói code thực sự làm gì, không phải nó được dự định làm gì, và thiếu nó thì điều gì hỏng.

### B. Vì sao nhóm quyết định như vậy

Một quyết định thể hiện trong repository và phương án khác không chọn.

- Containers tự xây hay Judge0: vì sao, lựa chọn đó khiến bạn phải trả giá gì?
- Kết quả real-time tới browser thế nào? Đã cân nhắc gì khác?
- Endpoint contract trả status này cho error này. Vì sao chọn nó, client làm gì với nó?
- Dựa vào câu trả lời FAQ nào của product owners ở đây, và không có nó thì sẽ xây gì?

Câu trả lời tốt nêu phương án thực sự đã cân nhắc, lý do có dữ kiện từ hệ thống của mình (con số, giới hạn, incident), cái giá của lựa chọn hoặc điều khiến bạn đổi nó. “Nó phổ biến” hay “nó nhanh hơn” mà không đo lường thì yếu hơn. “Assistant chọn” còn yếu hơn.

### C. Làm sao biết nó hoạt động

Về một phần bạn xây, một bước demo hoặc incident trong post-mortem.

- Test, check, eval case, CI run hoặc log line nào chứng minh hoạt động? Cho xem.
- Assistant đã làm sai gì ở phần này, cái gì phát hiện? (`AI-LOG.md` và commits là điểm bắt đầu.)
- Trong incident, signal nào đến trước, log line hoặc trace nào dẫn tới nguyên nhân?

Câu trả lời tốt chỉ đúng check, cho thấy nó chạy hoặc CI run của nó, nói lỗi gì nó sẽ bắt và lần lại incident từ detection tới cause bằng logs hoặc traces thật. “Đã thử và hoạt động” hay “CI xanh” mà không nói CI kiểm tra gì cho phần này là câu trả lời yếu.

### D. Feature LLM trên input cho trước

Giám khảo có thể đưa input file: một C++ submission Accepted và constraints của lab. Có thể đọc code trước. Sau đó:

1. Nói hệ thống sẽ làm gì: hard rule nào kích hoạt, model có được gọi không và cho constraint nào, verdict và evidence lines, guardrail nào áp dụng, có vào review queue không, TA phải làm gì trước khi publish điểm.
2. Chạy qua command line của checker.
3. Giải thích mọi khác biệt giữa điều đã nói và điều đã xảy ra.

Câu hỏi tiếp: Vì sao human gate ở Publish chứ không phải trên mọi verdict? Ai chịu giá nếu verdict này sai sau publishing, và bao nhiêu?

Câu trả lời tốt khớp lần chạy hoặc giải thích khác biệt từ code; nói vì sao gate ở đó chứ không nơi khác; ai chịu giá khi verdict sai. “Con người kiểm tra mọi thứ” không phải lý do cho vị trí gate.

Nếu giám khảo đưa input, lần chạy dùng model key của các bạn, một lần.

## Phần giải thích — 60 điểm cho từng thành viên

Giám khảo cho mỗi người số điểm trong band mô tả sát nhất toàn bộ lượt của người đó. Cách đi tới điểm — số câu, lĩnh vực, trọng số câu hỏi tiếp — do họ quyết định.

| Điểm | Biểu hiện |
|---|---|
| 51–60 | Đúng và cụ thể xuyên suốt những gì được hỏi. Tự tìm vị trí trên màn hình và chỉ vào file, line, commit, log hoặc trace đang nói. Xử lý câu hỏi tiếp, kể cả feature LLM, guardrails và human gate. |
| 39–50 | Phần lớn đúng nhưng cần gợi ý để tìm vị trí, còn chung chung hoặc chỉ trả lời một phần câu hỏi tiếp. Hoặc giải thích đúng vì sao một bước demo thất bại. |
| 24–38 | Đúng một phần: đọc code thành tiếng mà không giải thích, hoặc mô tả điều nó nên làm và hiểu sai điều nó thực sự làm. |
| 9–23 | Phần lớn sai, hoặc “assistant viết” mà không giải thích. |
| 0–8 | Không giải thích được phần mình xây, hoặc vắng không có lý do có chứng từ. |

Bước demo thất bại được tính ở build points, không ở đây; ở đây chấm giải thích, gồm giải thích vì sao thất bại.

## Cách trả lời

- Có thể mở mọi file, search, chạy `git log`, `git blame`, `git diff`, tests, eval và checker, mở deployment và dashboards.
- Assistant phải đóng trong lượt của bạn: chúng tôi chấm phần giải thích của chính bạn về hệ thống, điều duy nhất syllabus giữ dưới giám sát. Mọi thứ khác trên laptop vẫn mở.
- Có thể yêu cầu nhắc lại hoặc diễn đạt lại câu hỏi bất kỳ lúc nào.
- “Tôi không biết, nhưng sẽ tìm ở đây”, rồi tìm và tìm ra, là câu trả lời thật và được điểm. Đoán tự tin thì không.
- Không ai yêu cầu viết code thuộc lòng hay trên giấy. Nếu hỏi sẽ đổi gì, nói và chỉ vào dòng.
- Đồng đội không trả lời thay. Câu trả lời của đồng đội không được tính; bạn nhận câu hỏi khác.

## Những gì chúng tôi ghi lại

Với mỗi nhóm, giám khảo ghi build checks và lý do mỗi điểm build bị mất; với từng thành viên, ghi những gì đã hỏi (file, line, commit hoặc log entry), explanation points và lý do. Phiếu đó là hồ sơ vấn đáp. Email kết quả cho biết điểm và các lý do.

Thắc mắc điểm: trả lời email kết quả trong vòng 7 ngày. Chúng tôi trả lời dựa trên phiếu.

## Vắng, trễ và khi build không chạy được

- Nhóm chưa sẵn sàng lúc gọi slot được chuyển xuống cuối danh sách buổi đó, một lần.
- Thành viên không có mặt ở slot nhóm nhận 0, trừ khi gửi lý do có chứng từ (giấy y tế hoặc trùng lịch thi chính thức) trước slot hoặc trong 2 ngày làm việc sau đó. Khi ấy nhận một slot mới, giữ build points của nhóm và được hỏi trong slot mới.

Khi build không chạy được:

1. Laptop hỏng thì chuyển sang laptop thứ hai đã đăng nhập tương tự.
2. Nếu deployment không phản hồi trong 3 phút (cold start cũng tính), phần hỏi vẫn diễn ra đúng giờ (đọc code trên laptop), nhóm được một lần retry cuối cùng buổi đó, trên deployment hoặc `pa5` chạy trên laptop.
3. Retry cũng thất bại thì phát walkthrough recording PA#5; với failure case, cho xem dòng code thực thi rule và test của nó. Feature recording thể hiện nhưng build không chạy được nhận 1/2 điểm; rule thể hiện theo cách này nhận 1/3; check mà recording không thể hiện (B2, B4) không có điểm.

## Vấn đáp không thay đổi gì

Syllabus nói phần dự án sinh viên không giải thích được sẽ không có điểm dù hoạt động. Trong môn này, quy tắc tác động qua điểm này: điều không giải thích được bị tính vào explanation points. Điểm PA#2–PA#5 của nhóm và build points không thay đổi vì câu hỏi.

Product owners được kiểm tra giống mọi nhóm khác, cùng thang điểm.

## Không có tự chấm

PA#6 không có zip, tổng trong tên file hay `SELF_ASSESSMENT_REPORT.md`, nên không có honesty adjustment: không phần nào tự chấm. Thứ duy nhất đăng trên assignment này là link tới `OWNERS.md`. Bonus của product owners (đầu brief) được cộng riêng, không thuộc rubric này.

## Quy đổi 100 điểm thành điểm môn học

Điểm mỗi thành viên là **build points + explanation points**, trên 100. PA#6 chiếm 15% môn học: **mark / 100 × 15**. Thành viên có nhóm đạt 34 build points, bản thân đạt 48 explanation points có tổng 82, nhận 12,3 trong 15 điểm phần trăm (1,23 trên thang 10). Thành viên cùng nhóm chia sẻ build points nhưng có thể nhận điểm khác nhau.

## Ghi chú

- Cùng nhóm như PA#5.
- Chuẩn bị bằng cách đọc repository của chính mình: commits, entries `AI-LOG.md` cho phần của mình, post-mortem và code main flow, cả phần đồng đội. Diễn tập demo một lần từ cold start trên deployment và laptop sẽ mang theo.
- Commit dưới tên mình trong học kỳ. Câu hỏi về commits bắt đầu từ `git log --author`; commits dưới tên đồng đội là câu hỏi của họ, không phải của bạn.
- Câu hỏi về dòng assistant viết là câu hỏi bình thường: code trong repository là code của nhóm.
