# Final project — milestones và rubrics

> Bản dịch hỗ trợ của [PDF gốc](Final%20project%20%E2%80%94%20milestones%2C%20features%20and%20rubrics%20%28CQ2023-3%29.pdf). Nguồn: CSC13114 · CQ2023/3 · LeeTKOB · 6 milestones · 40% học phần. Khi tài liệu tổng hợp và rubric khác nhau, **rubric được ưu tiên**. Thuật ngữ IT, identifiers và commands giữ nguyên tiếng Anh.

Nhóm xây dựng LeeTKOB qua PA#2–PA#6; PA#1 là proposal riêng của nhóm. Mỗi milestone được nộp ở assignment Classroom riêng, hạn **22:00**, có rubric đầy đủ đính kèm. Tài liệu này tập hợp yêu cầu, lịch và nội dung chấm điểm để lập kế hoạch phần còn lại của học kỳ.

## Sáu milestones

| Milestone | Nội dung | Trọng số | Hạn | Trạng thái ngày 17/11 |
| --- | --- | --- | --- | --- |
| PA#1 | Proposal và planning | 4% | Thứ Tư 07/10 | Đã chấm; feedback qua email |
| PA#2 | Harness và quality gate | 4% | Thứ Tư 11/11 | Đã đóng; điểm qua email và Classroom |
| PA#3 | Prototype có LLM feature chạy | 7% | Thứ Tư 25/11 | Đang mở |
| PA#4 | Eval, guardrails, human gate và red-team | 7% | Thứ Tư 02/12 | Assignment sẽ đăng sau trên Classroom |
| PA#5 | Final build chạy và được quan sát | 3% | Thứ Tư 16/12 | Assignment sẽ đăng sau; marking window 17–23/12 |
| PA#6 | Final demo và vấn đáp cá nhân | 15% | Buổi 14–15, Thứ Năm 24/12 và 31/12 | OWNERS.md hạn Thứ Hai 21/12 |

SEMINAR (7%) do cùng nhóm thực hiện nhưng **không thuộc project**: tính cùng assignments, có assignment và rubric riêng. Study hạn Chủ Nhật 29/11; các nhóm được lớp bình chọn trình bày trực tiếp ở buổi 11–13 (03/12, 10/12 và 17/12).

Ba hạn nộp trong tám ngày: PA#3 25/11, SEMINAR study 29/11, PA#4 02/12. Red team PA#4 tấn công deployment nộp ở PA#3, vì vậy giữ deployment chạy từ 25/11.

Các milestones kế thừa nhau: PA#3 làm pipeline chạy thật trên public deployment; PA#4 làm nó đáng tin cậy (eval gate, guardrails, human gate) và tấn công deployment của nhóm khác; PA#5 hoàn thiện sản phẩm, chạy ở nơi người ngoài truy cập được và quan sát nó; PA#6 chấm toàn bộ final build và hỏi từng thành viên về sản phẩm.

## Các feature LeeTKOB bắt buộc triển khai

Mọi nhóm xây dựng đủ 11 feature. Chúng đến từ mục 4 của brief và các tiêu chí PA#3–PA#5 nêu trong bảng; cột cuối là các rule áp dụng, giải thích bên dưới. PA#6 kiểm tra cả 11 trên final build. Nhóm tự chọn stack, architecture, screens và wording; phần brief không quy định thì FAQ của product owners quyết định hành vi sản phẩm.

| # | Feature / nguồn | Ai sử dụng | Nội dung phải hoạt động | Rules |
| --- | --- | --- | --- | --- |
| F1 | Accounts, roles và classes (brief 4.1; PA#3 1) | Admin, TA, Student | Accounts cho ba roles; TA thuộc classes, mỗi lab thuộc một class; mỗi role chỉ thấy screens của mình. TA của class khác không thấy lab hoặc review queue của lab. | T1 |
| F2 | Lab có tests và constraints (PA#3 1; PA#5 2) | TA | Lab trong class của TA có statement, tests và constraints; mỗi constraint có deduction do TA chọn, gồm một constraint do hard rule quyết định (“Do not use…”) và một constraint cho model. | T1 |
| F3 | Submit và judge theo real time (brief 4.2; PA#3 1–2; PA#5 2) | Student | C++ submission vào queue, được separate worker judge bằng tests của TA. Trạng thái trên trang student chuyển từ queued đến kết quả cuối mà không reload. | Q1 |
| F4 | Sandbox (brief 5; PA#3 2) | Pipeline | Compile và run bên trong sandbox, đáp ứng chín minimums của brief; mỗi minimum có attack submission trong repository, chạy ở CI. | M1–M9 |
| F5 | Hard rules trước (brief 3; PA#3 3) | Pipeline | Code syntax-aware quyết định ban-list constraints. Không mắc các trap: hàm sort do student tự viết; banned name trong comment/string; include `<algorithm>` chỉ để dùng `std::swap`. Không gọi model cho constraint đã được hard rule quyết định. | D1 |
| F6 | Model judge semantic constraints (brief 3; PA#3 4) | Pipeline | Model thật chỉ nhận statement, constraints và code đã bỏ comments cùng danh tính student; trả pass, violation hoặc unsure cho từng constraint, kèm evidence lines. Không phần nào của output quyết định deduction. | G5 |
| F7 | Guardrails cho model output (brief 3; PA#3 5; PA#4 3) | Pipeline, TA | Output sai schema, evidence không khớp code, timeout và cost cap theo lab đều chuyển verdict thành unsure; TA thấy lý do. Injection submission kết thúc là violation hoặc unsure, không bao giờ pass. | G1–G4 |
| F8 | Review queue và Publish (brief 3; PA#3 5; PA#4 4) | TA | Queue chứa mọi violation, mọi unsure và 10% pass chọn ngẫu nhiên, mỗi verdict có evidence và deduction của TA. TA review và bấm Publish — hành động duy nhất làm deduction hiển thị cho student. | H1–H3 |
| F9 | Published marks và appeals (brief 4.4; PA#5 2) | Student, rồi TA | Sau Publish, từng student đọc mark và deduction. Student appeal; TA reject với lý do student thấy được, hoặc accept và published mark thay đổi. | A1–A3 |
| F10 | Checker command và eval gate (brief 4.5, 6; PA#3 6; PA#4 1) | Nhóm | Một command line tạo prediction file từ dataset folder, có switch MODEL_OFF=1. CI job chạy checker trên dev set và các cases tự tạo, sau đó eval.mjs; job là required check trên main. | — |
| F11 | Logs, metrics và traces (PA#5 3) | Nhóm | Với submission thực hiện ngay trước người chấm: tìm mọi log line theo một id; trace từ request qua queue, sandbox, hard rules, từng model call đến stored verdict; dashboard; SLO và alert của nó. | — |

Load test 80 submissions (brief 4.6) chỉ được chấm ở PA#5. Public deployment (brief 4.7) là nơi các feature chạy.

### Rules theo label

Ở PA#6, người chấm chọn hai rule để thử bằng failure cases (B3), từ các rule có thể thử trên running build.

| Label | Rule | Nguồn | Cách thử trên running build |
| --- | --- | --- | --- |
| T1 | TA của class khác không thấy lab hoặc review queue của lab | PA#3 tiêu chí 1 | Direct request |
| Q1 | Submission tạo lúc worker dừng được judge đúng một lần sau khi worker khởi động lại | PA#3 tiêu chí 2 | Dừng worker, submit, khởi động worker |
| M1–M9 | Chín sandbox minimums: M1 no network; M2 CPU time; M3 wall-clock limit giết container; M4 memory gồm swap; M5 processes; M6 output size; M7 non-root user; M8 không host mounts, không Docker socket; M9 không secrets | PA#3 tiêu chí 2; brief 5 | Attack submission trong repository |
| D1 | Hard rules quyết định ban-list constraints, không mắc trap, không gọi model cho các constraint đó | PA#3 tiêu chí 3 | Trap submission, sau đó xem call log |
| G1–G5 | Năm guardrails: G1 schema; G2 evidence; G3 timeout; G4 cost cap theo lab; G5 không deduction từ model | PA#4 tiêu chí 3 | G4 và G5: lab có cap thấp, injection submission. G1–G3 chỉ qua tests nên không được chọn cho B3 |
| H1–H3 | Human gate: H1 pass sample ngẫu nhiên do server chọn; H2 API từ chối Publish khi còn bất kỳ queued verdict chưa review; H3 từ chối Publish cho student và TA class khác | PA#4 tiêu chí 4 | Direct requests |
| A1–A3 | Appeals: A1 từ chối trước publishing; A2 từ chối trên submission của student khác; A3 lưu ai quyết định, khi nào, vì sao | PA#5 tiêu chí 2 | Trên running build |

### Feature được chấm ở đâu

- **PA#3:** lần chạy thật đầu tiên trên deployment: lab, submit, queue, sandbox, hard rules, model, first limits, review queue, checker command (F1–F8, F10), cộng khoảng mười attack submissions của người chấm.
- **PA#4:** độ tin cậy: eval gate (F10), held-out run, guardrails (F7), human gate (F8) và red-team report về nhóm khác.
- **PA#5:** sản phẩm hoàn thiện chạy public: publishing, appeals, real-time results (F3, F9), logs/metrics/traces (F11), load test và một incident post-mortem.
- **PA#6:** toàn bộ final build phối hợp hoạt động (40/100 điểm): từng feature F1–F11, hai rules, roles và phần vượt brief (B5).

## Yêu cầu cho mọi milestone

- Nhóm tối đa 3, giữ nguyên nhóm cả học kỳ. Một thành viên nộp cho nhóm.
- Một ZIP của repository **bao gồm .git**, tag milestone (pa3, pa4, pa5) tại commit nộp và đã push. Repository duy trì public. Tên ZIP gồm student IDs tăng dần và tổng tự chấm: `<StudentID1>-<StudentID2>-<StudentID3>_<total>.zip`, ví dụ `23120001-23120002-23120003_84.zip`.
- **PA#6 không nộp ZIP** (xem bên dưới).
- Trong ZIP có SELF_ASSESSMENT_REPORT.md: mỗi criterion một dòng, điểm tự nhận và evidence (file, commit, pull request hoặc CI run), tổng bằng số trong tên ZIP; thêm đoạn ngắn về phần chưa làm được.
- PA3.md, PA4.md, PA5.md ở root, có links từng rubric yêu cầu.
- AI-LOG.md: một file cho cả project, có Changed và Rejected entries thực tế cho các phần của mỗi milestone. Tool: none là entry hợp lệ.
- Commit history được tính khi rubric chấm: mỗi part một commit, tests không muộn hơn code được test. History chia lại hoặc dựng lại sau khi hoàn thành không được tính “one commit per part”, mà chấm theo mức commits trộn nhiều parts.
- Nộp trễ PA#3–PA#5: đến 2 giờ trừ 20%; 2–24 giờ trừ 50%; quá 24 giờ không nhận. Late factor áp dụng **sau honesty adjustment**.
- Nộp bằng account `<StudentID>@student.hcmus.edu.vn`.

### Honesty adjustment (PA#1–PA#5)

So sánh self-assessment với điểm thực nhận trên cùng thang 100.

| Chênh lệch: tổng tự chấm − điểm thực nhận | Điều chỉnh |
| --- | --- |
| Trong ±10 | Không |
| +11 đến +20 | −3 |
| +21 đến +30 | −6 |
| Trên +30 | −10 |
| −21 hoặc thấp hơn | −3 |
| Không có SELF_ASSESSMENT_REPORT.md | −10; bỏ qua tổng điểm trong tên ZIP |

Criterion tự nhận nhưng không có evidence line được tính là **đã claim và chưa làm**. Adjustment không làm điểm xuống dưới 0.

## PA#3 — Prototype có LLM feature chạy

**7%; hạn Thứ Tư 25/11.**

- Toàn pipeline chạy thật: TA tạo lab có constraints; student submit; code vào queue; separate worker judge trong sandbox đáp ứng chín minimums, mỗi minimum có attack submission chạy trong CI.
- Hard rules trước, model sau; kiểm tra output bằng schema và time limit; verdicts kèm evidence vào review queue của TA, không đến student nếu chưa qua TA.
- Checker command có Dockerfile, MODEL_OFF=1, first committed run trên dev set.
- Từ đây có public deployment, giữ chạy đến khi có điểm PA#4 vì nhóm khác tấn công ở PA#4. PA3.md có URL, test accounts, CI run và recording tối đa 5 phút.
- Quy định syllabus: nếu model verdict tác động mark của student mà không qua TA, hoặc dùng model output không có schema check và time limit, **tiêu chí 4, 5, 6 nhận 0**.

| # | Criterion | Điểm |
| --- | --- | --- |
| 1 | Flow end-to-end trên deployment | 15 |
| 2 | Queue và sandbox | 20 |
| 3 | Hard rules trước | 15 |
| 4 | Model judge semantic constraints | 20 |
| 5 | First limits và review queue | 10 |
| 6 | Checker command và first eval | 10 |
| 7 | Tests trước, mỗi part một commit | 5 |
| 8 | AI-LOG.md | 5 |

## PA#4 — Eval, guardrails, human gate và red-team

**7%; hạn Thứ Tư 02/12.**

- Eval gate trong CI: required check trên main chạy checker trên dev set và ít nhất 10 cases tự tạo với model thật, rồi eval.mjs; một pull request bị gate chặn; ba repeated runs của cùng commit.
- Held-out run: người chấm chạy checker command một lần trên held-out set; thresholds của brief mục 3 quyết định band: 0 wrongful deductions, recall ≥90%, unsure ≤20%.
- Năm guardrails mục 3, mỗi guardrail có test dùng fake model; human gate: API từ chối Publish nếu còn queued verdict chưa review.
- Red-team report về deployment của nhóm do giảng viên chỉ định: ít nhất 8 attacks thuộc ít nhất 5 categories.
- Nộp thêm PA4.md (có mục “Where we stop it”) và marking.env đính kèm cạnh ZIP, không bao giờ đưa vào git.

| # | Criterion | Điểm |
| --- | --- | --- |
| 1 | Eval gates CI | 20 |
| 2 | Held-out run | 20 |
| 3 | Guardrails mục 3 | 20 |
| 4 | Human gate | 15 |
| 5 | Red-team report về nhóm khác | 20 |
| 6 | AI-LOG.md | 5 |

## PA#5 — Final build chạy và được quan sát

**3%; hạn Thứ Tư 16/12.**

- Final build tag pa5 trên public deployment qua HTTPS, hiển thị commit, duy trì suốt marking window (Thứ Năm 17/12 đến Thứ Tư 23/12) và đến slot PA#6 của nhóm.
- Publishing, appeals, real-time results do người chấm tự thao tác; logs, metrics, traces; một SLO và alert đã từng fire.
- Load test 80 submissions từ 80 student accounts trong 10 giây, người chấm chạy lại; một incident post-mortem của sự kiện thật.
- Nộp thêm PA5.md, load/RESULT.md, walkthrough recording tối đa 10 phút (cũng là fallback cho PA#6), ACCESS.md trong ZIP nhưng không bao giờ commit.

| # | Criterion | Điểm |
| --- | --- | --- |
| 1 | Public deployment của pa5 | 10 |
| 2 | Publishing, appeals, real-time results | 20 |
| 3 | Logs, metrics, traces | 20 |
| 4 | Load test: 80 submissions đồng thời | 20 |
| 5 | Một incident post-mortem | 20 |
| 6 | AI-LOG.md | 10 |

## PA#6 — Final demo và vấn đáp cá nhân

**15%; buổi 14–15, Thứ Năm 24/12 và 31/12.**

- Trước slot, chậm nhất **Thứ Hai 21/12, 22:00**, commit OWNERS.md (ai xây phần nào, phần vượt brief), đăng link commit trên assignment PA#6. Giữ deployment chạy pa5 đến slot.
- Slot trong khung **08:20–11:50, cs2:G202**: nhóm chạy main flow trên final build, rồi người chấm hỏi từng thành viên về code và quyết định của nhóm. Người chấm là teaching assistant và lab instructors của lớp.
- Mỗi thành viên nhận một điểm trên 100: final build **40 điểm** chung cho nhóm; phần giải thích **60 điểm** riêng từng người. Đóng assistant khi trả lời; repository, terminal, tests và dashboards vẫn mở. Không yêu cầu viết code từ trí nhớ hoặc trên giấy.
- PA#6 không có SELF_ASSESSMENT_REPORT.md và không honesty adjustment.

### Final build — 40 điểm chung cho nhóm

| # | Criterion | Điểm |
| --- | --- | --- |
| B1 | 11 features F1–F11 trên running build: mỗi feature 2 nếu hoạt động; 1 nếu chỉ một phần, phải retry hoặc chỉ có trong recording; 0 nếu thiếu hoặc giả lập | 22 |
| B2 | Deployment chạy pa5; reload ở hai điểm vẫn giữ dữ liệu; Network tab hiển thị requests | 4 |
| B3 | Hai rules do người chấm chọn từ feature table, thử failure cases, server chặn; mỗi rule chỉ 1 thay vì 3 nếu chỉ screen chặn hoặc chỉ có test chứng minh | 6 |
| B4 | Một screen/endpoint của role, class hoặc student khác bị API từ chối | 4 |
| B5 | Phần vượt brief liệt kê trong OWNERS.md: 4 nếu hoạt động và có test kiểm tra; 2 nếu hoạt động nhưng không có gì kiểm tra | 4 |

### Giải thích — 60 điểm cho từng thành viên

| Điểm | Mức thể hiện |
| --- | --- |
| 51–60 | Đúng và cụ thể xuyên suốt câu hỏi; tự tìm vị trí trên màn hình, chỉ file, line, commit, log hoặc trace; xử lý follow-ups, kể cả LLM feature, guardrails và human gate |
| 39–50 | Phần lớn đúng nhưng cần gợi ý tìm vị trí, còn chung chung hoặc chỉ trả lời một phần follow-ups |
| 24–38 | Đúng một phần: đọc code mà không giải thích, hoặc mô tả điều code nên làm nhưng hiểu sai thực tế code làm |
| 9–23 | Phần lớn sai, hoặc chỉ nói “assistant viết” mà không giải thích |
| 0–8 | Không giải thích được phần mình xây, hoặc vắng không có lý do được ghi nhận |

Code không giải thích được làm giảm điểm giải thích dù code chạy, bất kể ai/cái gì viết. Không thay đổi điểm nhóm PA#2–PA#5 hoặc điểm final build.
