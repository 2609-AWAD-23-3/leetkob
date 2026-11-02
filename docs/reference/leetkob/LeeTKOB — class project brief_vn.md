# LeeTKOB - Dự án chung của lớp

> Bản dịch từ `LeeTKOB — class project brief.pdf` (4 trang). Giữ nguyên thuật ngữ chuyên ngành, tên file, đường dẫn, lệnh, các verdict và identifier kỹ thuật.

CSC13114 · Lớp 2609-AWAD-23/3 · Từ PA#2 đến PA#6, mọi nhóm đều xây dựng sản phẩm này

LeeTKOB được đề xuất trong PA#1 bởi Lê Tấn Hiệp (23120255), Tống Dương Thái Hoà (23120262) và Nguyễn Phúc Hoàng (23120264). Từ thời điểm này, ba bạn là **product owners** của lớp (mục 8); mỗi bạn được cộng 0,5 điểm vào điểm môn học trên thang 10.

Đề xuất PA#1 riêng của nhóm vẫn giữ nguyên điểm đã chấm. Từ PA#2 trở đi, mọi nhóm đều xây dựng LeeTKOB.

## 1. Vì sao cả lớp cùng xây dựng một sản phẩm

**Evals có thể so sánh được.** Constraint checker của mọi nhóm được chấm trên cùng một held-out set do giảng viên giữ (mục 6). Nhờ đó, “không có wrongful deductions” trở thành một con số có thể so sánh, thay vì chỉ là lời khẳng định.

**Red-teaming có mục tiêu cụ thể.** Trong PA#4, nhóm sẽ tấn công deployment của một nhóm khác xây dựng cùng sản phẩm. Nhóm biết chính xác hệ thống đó phải từ chối điều gì.

**Cạnh tranh về engineering, không phải ý tưởng.** Ý tưởng đã được cố định. Nội dung được chấm là mức độ vững chắc của harness, gates, eval và operations, cùng khả năng giải thích chúng trong phần oral.

## 2. Người dùng và vấn đề

Người dùng là teaching assistant (TA) phụ trách một buổi lab nhập môn lập trình C++. Vào đêm trước khi công bố điểm lab Sorting, khoảng 80 sinh viên có submissions được chấm `Accepted`; TA phải đọc từng bài để kiểm tra sinh viên có thực sự cài đặt merge sort không.

Vấn đề: một submission `Accepted` vẫn có thể vi phạm quy định của bài. Bài có thể gọi `std::sort`, hoặc cài đặt bubble sort dù đề yêu cầu merge sort. Hiện tại, cách duy nhất để phát hiện là đọc mọi submission, mất 2-3 phút mỗi bài và 3-4 giờ mỗi tuần. Đôi khi sinh viên appeal việc bị trừ điểm; TA phải đọc lại code để giải trình.

## 3. Tính năng LLM và hậu quả khi đánh giá sai

**Constraint review trước khi công bố điểm.** Đây là một bước trong grading pipeline, không phải chatbot.

**Input:** đề lab, các constraints do TA khai báo (mỗi constraint gồm nội dung và mức deduction do TA chọn), cùng code của một submission `Accepted` đã loại bỏ comments và thông tin định danh sinh viên.

**Hard rules chạy trước.** Các syntax-aware checks phát hiện những vi phạm xác định được, chẳng hạn lời gọi `std::sort` (phân biệt với hàm do sinh viên tự viết tình cờ cũng tên `sort`). Khi hard rule đã đưa ra kết luận cho một constraint, không gọi model cho constraint đó.

**Model chỉ đánh giá semantic constraints.** Ví dụ: có thực sự dùng đúng algorithm được yêu cầu không, có recursion thực sự không, có auxiliary array bị giấu ở đâu đó không. Với mỗi constraint, model trả về `pass` / `violation` / `unsure`, kèm các dòng code làm evidence. Model không bao giờ quyết định deduction; TA đã đặt mức đó.

**Guardrails.** Output được validate theo schema. Mọi evidence line phải khớp chính xác với code đã nộp; nếu không, verdict chuyển thành `unsure`. Timeout cũng chuyển thành `unsure`. Có cost cap cho mỗi lab.

**Human gate.** Mọi verdict `violation`, mọi verdict `unsure` và 10% verdict `pass` được chọn ngẫu nhiên đều vào review queue của TA. Điểm chỉ được công bố sau khi TA đã review và nhấn **Publish**. Đây là bước khó đảo ngược.

**Vì sao đánh giá sai gây hậu quả lớn.** Một wrongful deduction (ví dụ trừ 3/10 điểm trong một lab chiếm 30% điểm môn học) có thể khiến sinh viên dưới ngưỡng đậu hoặc ngưỡng học bổng. Nếu một constraint bị hiểu sai có hệ thống, cả 80 sinh viên đều bị trừ điểm và có thể phát sinh tới 80 appeals. Trước khi publish, sửa verdict không gây tổn phí. Sau khi publish, phải mở lại điểm, xử lý appeals, và TA mất uy tín.

**Ngưỡng yêu cầu.** Checker không được trừ điểm sai thường xuyên hơn một người chấm cẩn thận:

| Metric | Threshold |
| --- | ---: |
| Wrongful deductions trên các solutions tuân thủ constraints | 0 |
| Violations được phát hiện (verdict `violation` kèm evidence line đúng) | ≥ 90% |
| `unsure` trong toàn bộ verdicts | ≤ 20% |

**Dữ liệu gửi tới model:** chỉ có đề bài, constraints và code đã loại bỏ tên cùng StudentID. Sinh viên được thông báo về quy trình review khi nộp bài.

## 4. Phạm vi

### In: những gì LeeTKOB phải làm được vào cuối học kỳ

1. **Accounts và roles:** `admin`, `TA`, `student`. TA thuộc các lớp. Mỗi lab thuộc một lớp.
2. **Submitting và judging C++:** student nộp bài, submission được đưa vào queue, compile và chạy trong sandbox với tests của TA. Student thấy kết quả theo thời gian thực.
3. **Constraint review:** hard rules, sau đó model, như mục 3. TA xử lý review queue rồi publish điểm.
4. **Appeals:** sau khi publish, student có thể appeal một deduction; TA chấp nhận hoặc từ chối kèm lý do.
5. **Quality:** eval trên dev set chạy trong CI và chặn merge khi xuất hiện bất kỳ wrongful deduction nào.
6. **Load:** hệ thống chịu được 80 submissions đến cùng lúc (những phút cuối trước deadline), và nhóm có kết quả load test để chứng minh.
7. **Deployment:** có public deployment mà giảng viên và red team truy cập được.

### Out: chủ động không xây dựng

- Ngôn ngữ lập trình thứ hai, vì cần thêm một bộ hard rules.
- Tests do model sinh hoặc việc để model chọn deduction. TA viết tests và đặt deductions.
- Phát hiện plagiarism hoặc AI-written code, vì không thể đo lường phù hợp trong một học kỳ.
- Contest rankings, online IDE, vector databases / RAG. Những phần này không giúp TA kiểm tra một bài lab.

## 5. Những gì nhóm được tự lựa chọn

**Stack và architecture.** Bất kỳ ngôn ngữ, framework nào; monolith hoặc services. Đề xuất ban đầu dùng ba services viết bằng ba ngôn ngữ với năm data stores; nhóm không bắt buộc làm theo. Giảm số thành phần phải vận hành là một quyết định engineering hợp lý; hãy sẵn sàng bảo vệ lựa chọn của nhóm trong phần oral.

**Model provider và model.** Có thể dùng free tiers. Đặt spending cap; ghi trong `AI-LOG.md` và README model đang dùng cùng chi phí cho một lab.

**Sandbox:** tự thiết lập container hoặc dùng self-hosted Judge0. Dù chọn cách nào cũng phải đáp ứng các mức tối thiểu bên dưới.

### Sandbox là bắt buộc, các mức tối thiểu được cố định

Hệ thống chạy code do người lạ viết. Sandbox của mọi nhóm phải:

- Không có network access.
- Giới hạn CPU time, wall time, memory, số processes và output size.
- Chạy bằng non-root user, không có host mounts và không truy cập được Docker socket.
- Không nhận secrets: model API key không bao giờ được xuất hiện bên trong sandbox, kể cả trong environment variables.

Chứng minh từng yêu cầu bằng một test case trong repository: một submission cố thực hiện attack tương ứng và thất bại. Session 6 (thứ Năm, ngày 29/10) sẽ đề cập nội dung này.

## 6. Eval data

**Dev set:** các bài lab C++, mỗi bài có tests, constraints và các solutions `Accepted` được gắn label theo từng constraint (`pass` / `violation`, kèm evidence lines). Dev set cũng có disguised violations, các “bẫy” thực ra tuân thủ constraints và prompt-injection attempts; kèm `eval.mjs` không có dependency, áp dụng các thresholds ở mục 3. Giảng viên công bố trước session 7 (thứ Năm, ngày 05/11). Hãy bổ sung các cases riêng của nhóm.

**Held-out set:** các bài khác có cùng format, do giảng viên giữ. Checker PA#4 của nhóm được chạy trên tập này. Tinh chỉnh prompts trên dev set, không dựa vào việc đoán held-out set.

Prediction file dùng JSONL, mỗi dòng ứng với một cặp `(solution, constraint)`:

```json
{"solution":"sort-merge/s03","constraint":"C1","verdict":"violation","evidence":[{"line":12,"text":"std::sort(a, a + n);"}]}
```

Checker phải có khả năng ghi file này từ command line. Giảng viên chạy held-out set bằng đúng command đó.

## 7. Các checkpoints cho LeeTKOB

Ngày và chủ đề giữ nguyên như đã đăng trên Classroom (Project checkpoints PA#2-PA#6). Rubric của mỗi checkpoint được đính kèm assignment tương ứng khi assignment mở.

| Checkpoint | Hạn, 22:00 | Ý nghĩa đối với LeeTKOB |
| --- | --- | --- |
| PA#2: harness và quality gate | Thứ Tư, 11/11 | Convention file, lint, tests và CI thực sự chặn merge. Thêm contract của một endpoint LeeTKOB (`docs/contract/<endpoint>.md`) cùng contract tests chạy trong CI. |
| PA#3: prototype có tính năng LLM hoạt động | Thứ Tư, 25/11 | TA tạo lab với constraints. Student nộp bài; code được judge trong sandbox thông qua queue. Submission `Accepted` đi qua hard rules rồi tới model. Verdicts kèm evidence xuất hiện trong review queue của TA. |
| PA#4: eval, guardrail, human gate, red-team | Thứ Tư, 02/12 | Eval trên dev set làm gate cho CI. Các guardrails ở mục 3 được triển khai. Không thể publish khi chưa có review của TA. Nhóm cũng viết red-team report về deployment của một nhóm khác; giảng viên phân cặp. |
| PA#5: final build, chạy và được quan sát | Thứ Tư, 16/12 | Publishing và appeals, kết quả real-time, logs/metrics/traces, load test với 80 submissions đồng thời, public deployment và một incident post-mortem. |
| SEMINAR | 10/12, 17/12 | Không thay đổi: mỗi nhóm một chủ đề optimisation. |
| PA#6: oral cá nhân | 24/12, 31/12 | Hỏi về code và các quyết định của nhóm. |

## 8. Product owners

Nhóm tác giả quyết định hành vi sản phẩm ở những chỗ brief này chưa quy định. Ví dụ: student có thể xem evidence trước khi publish điểm không? TA nhìn thấy gì với verdict `unsure`? Có thể mở lại một appeal không?

Hỏi trong Facebook group của lớp, dưới bài ghim **LeeTKOB — questions for the product owners**. Không hỏi bằng tin nhắn riêng: câu trả lời cho một nhóm cũng là câu trả lời cho mọi nhóm.

Câu hỏi được trả lời trong vòng hai ngày làm việc. Các câu trả lời được tổng hợp trong FAQ của product owners, có liên kết trên Classroom. Khi dựa vào một câu trả lời, trích dẫn FAQ entry tương ứng trong repository.

**Product owners không quyết định:** điểm số, deadlines, rubrics, các thresholds và mức tối thiểu trong brief này. Các nội dung đó thuộc quyền giảng viên. Nếu FAQ mâu thuẫn với brief, brief được ưu tiên cho tới khi giảng viên thay đổi.

Product owners cũng xây dựng LeeTKOB như mọi nhóm khác và được chấm theo cùng cách.
