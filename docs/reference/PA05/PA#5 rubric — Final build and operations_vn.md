# PA#5 — Bản build cuối, đang chạy và có thể quan sát · rubric

> Bản dịch tiếng Việt hỗ trợ tra cứu; [PDF gốc](PA%235%20rubric%20%E2%80%94%20Final%20build%20and%20operations.pdf) là tài liệu có thẩm quyền. Giữ nguyên thuật ngữ IT, tên file và lệnh. Đã đọc đủ 7/7 trang bằng text extraction, không bị truncation; số trang cũng được xác minh qua page tree /Count 7. Các mốc trang bên dưới theo bản trích xuất.

## Trang 1

CSC13114 · milestone dự án, nhóm tối đa 3 người · 3% điểm môn học · 100 điểm

Sản phẩm là LeeTKOB: đọc lại brief của lớp trước khi bắt đầu. Checkpoint này đánh giá việc sản phẩm đã hoàn thiện và đang chạy ở nơi người ngoài có thể truy cập, cùng khả năng nhóm nhìn thấy hệ thống đang làm gì: khi 80 sinh viên submit vào phút cuối trước deadline, và khi có sự cố.

Hãy dùng assistant cho toàn bộ công việc. Chúng tôi chấm những gì tự mình quan sát được: URL công khai, walkthrough do chúng tôi thực hiện trên đó, trace của request do chúng tôi gửi, load test do chúng tôi chạy lại, và post-mortem có thể đối chiếu với logs và commits của các bạn.

Review queue và gate trước Publish đã được chấm ở PA#4. Ở đây chúng chỉ cần tiếp tục hoạt động, để chúng tôi có thể đi tới publishing và appeals.

**Hạn nộp: Thứ Tư, ngày 16 tháng 12 năm 2026, 22:00. Mỗi nhóm nộp một bài.**

**Thời gian chấm: Thứ Năm, ngày 17 tháng 12 đến Thứ Tư, ngày 23 tháng 12 năm 2026, 22:00.** Giữ deployment hoạt động và chạy commit được tag `pa5` cho tới khi thời gian chấm kết thúc.

### Những nội dung được chấm

| # | Tiêu chí | Điểm |
|---|---|---:|
| 1 | Deployment công khai của `pa5` | 10 |
| 2 | Publishing, appeals và kết quả real-time | 20 |
| 3 | Logs, metrics và traces | 20 |
| 4 | Load test: 80 submissions cùng lúc | 20 |
| 5 | Một incident post-mortem | 20 |
| 6 | `AI-LOG.md` | 10 |

### 1. Deployment công khai của `pa5` — 10 điểm

Host nào cũng được, kể cả free tier. Chúng tôi cần một URL phản hồi qua HTTPS trong thời gian chấm và các tài khoản trong `ACCESS.md` (xem phần Những gì cần nộp).

| Điểm | Biểu hiện |
|---|---|
| 9–10 | Hoạt động ở cả hai lần chúng tôi thử. Version endpoint hoặc footer của trang hiển thị commit hash của `pa5`. Các tài khoản trong `ACCESS.md` hoạt động cho mọi role. `PA5.md` nêu cách tạo deployment (một command hoặc các bước được host tài liệu hóa), nơi lưu configuration của từng environment và cách quay lại release trước. |
| 5–8 | Hoạt động ở cả hai lần thử, nhưng không hiển thị version hoặc version không phải `pa5`, hoặc thiếu một tài khoản, hoặc không tài liệu hóa cách quay lại. |
| 1–4 | Chỉ hoạt động ở một trong hai lần thử, hoặc được phục vụ qua HTTP thuần. |

## Trang 2

| Điểm | Biểu hiện |
|---|---|
| 0 | Không hoạt động ở cả hai lần thử (xem Nếu deployment không hoạt động). |

Tunnel tới máy của một thành viên được chấp nhận nếu hoạt động khi chúng tôi thử. Thường thì nó không hoạt động.

### 2. Publishing, appeals và kết quả real-time — 20 điểm

Chúng tôi tự thực hiện walkthrough này trên deployment của các bạn, bằng tài khoản trong `ACCESS.md` và các lời giải C++ do chúng tôi mang theo:

1. Với role TA, tạo một lab có tests và hai constraints, một constraint do hard rule quyết định và một cho model, mỗi constraint có một mức trừ điểm.
2. Với role student 1, submit một lời giải tuân thủ. Với role student 2, submit một lời giải vi phạm constraint. Quan sát judge status trên trang của từng sinh viên. Sau đó, với role student 2, thử appeal trước khi lab được publish.
3. Với role TA, xử lý review queue và nhấn Publish.
4. Với role từng sinh viên, đọc điểm đã publish và khoản trừ điểm.
5. Với role student 2, appeal. Với role TA, reject với lý do; sau đó, nếu FAQ của product owners cho phép, reopen và accept.
6. Với role student 1, thử appeal submission của student 2.

Ở những chỗ brief không nói rõ (sinh viên thấy gì trước publishing, appeal có thể được reopen hay không), deployment phải theo FAQ của product owners. Trích dẫn các mục được sử dụng trong `PA5.md`.

| Điểm | Biểu hiện |
|---|---|
| 18–20 | Mọi bước hoạt động đúng như brief và FAQ mô tả. Judge status thay đổi trên trang sinh viên mà không reload, từ queued đến kết quả cuối. Sau publishing, appeal được accept làm thay đổi điểm đã publish và lưu ai quyết định, khi nào, vì sao; appeal bị reject hiển thị lý do cho sinh viên. Appeal sớm ở bước 2 và appeal ở bước 6 bị từ chối, với các errors được contract đặt tên. |
| 12–17 | Mọi bước hoạt động, nhưng một bước chưa trọn vẹn: status cần reload, quyết định appeal không lưu lý do hoặc người quyết định, hoặc một bước khác FAQ mà không trích dẫn quyết định. |
| 5–11 | Publishing hoạt động nhưng appeals thiếu hoặc hỏng; hoặc kết quả chỉ xuất hiện sau reload và có thêm một bước thất bại. |
| 0–4 | Walkthrough không thể vượt qua submitting và judging trên deployment. |

### 3. Logs, metrics và traces — 20 điểm

Dùng công cụ nào cũng được: hosted free tier, self-hosted stack, hoặc các trang tự xây. Cung cấp quyền read-only trong `ACCESS.md`. Trong walkthrough, chúng tôi ghi lại id của một submission và thời gian, sau đó:

- tìm mọi log line cho submission đó bằng một id;

## Trang 3

- mở trace của nó, trace cần đi từ HTTP request qua queue, judge trong sandbox, hard rules và từng model call tới verdict được lưu;
- mở dashboard: request rate và errors, queue depth và tuổi của job cũ nhất, judge time, model calls (count, latency, errors và timeouts), tỷ lệ `unsure`, và model spend so với cap;
- đọc service level objective (SLO) trong `PA5.md` và alert giám sát nó.

| Điểm | Biểu hiện |
|---|---|
| 18–20 | Có tất cả các mục trên. Log lines có cấu trúc (level, time, service, id). Trace đi qua queue vào worker, hiển thị thời lượng mỗi bước; model span hiển thị model và tokens hoặc cost. Có một SLO, ví dụ 95% submissions có judge result trong 60 giây, kèm alert đã fire ít nhất một lần: notification hoặc alert history có thời gian khớp logs. |
| 12–17 | Có logs và dashboard như trên, nhưng trace dừng ở queue, hoặc thiếu SLO hay alert, hoặc alert chưa từng fire, hoặc thiếu model spend. |
| 5–11 | Logs có thể tìm kiếm và một số metrics, không có traces. |
| 0–4 | Chỉ có console output, hoặc chúng tôi không truy cập được bằng quyền đã cung cấp. |

Nếu bất kỳ log line chúng tôi đọc được chứa model API key, hoặc tên hay ID sinh viên trong logged prompt: tiêu chí này tối đa 4 điểm.

### 4. Load test: 80 submissions cùng lúc — 20 điểm

Brief yêu cầu LeeTKOB chịu được 80 submissions đến trong những phút cuối trước deadline. Đặt load script trong `load/`, kèm `Dockerfile`, để chạy dưới dạng container chỉ với base URL và credentials cần thiết. Ghi command chính xác trong `PA5.md`.

Script phải dùng 80 tài khoản sinh viên khác nhau, mỗi tài khoản submit một lần vào cùng lab, cả 80 được gửi trong vòng 10 giây. Script báo cáo cho lần chạy: bao nhiêu submissions được accept, bao nhiêu đạt judge result cuối, bao nhiêu thất bại và với status nào, bao nhiêu bị tạo hai lần, thời gian từ submitting tới judge result (p50 và p95), thời gian queue drain, bao nhiêu submissions tới model và cost của các calls đó.

Nộp `load/RESULT.md`: ngày giờ chạy, URL và commit được chạy, output của script, screenshot dashboard từ tiêu chí 3 chụp trong lúc chạy, thành phần bão hòa đầu tiên (judge workers, CPU, memory, rate limit của model), và những gì đã thay đổi vì điều đó.

Chúng tôi chạy lại một lần trong thời gian chấm, trên deployment công khai, bằng script của các bạn trong container không có mounts và chỉ có network access. Chúng tôi dừng sau 15 phút bất kể trạng thái. Model calls trong lần chạy của chúng tôi dùng key của các bạn như các lần tự chạy; cost cap theo lab bảo vệ các bạn, và cap khiến reviews thành `unsure` chính là cap đang làm đúng nhiệm vụ. Nêu trong `RESULT.md` nếu gặp tình huống đó.

Các mức tối thiểu của sandbox ở mục 5 của brief phải được duy trì trong test. Load test chạy khi tắt sandbox chỉ đạt 0–4 điểm.

## Trang 4

| Điểm | Biểu hiện |
|---|---|
| 18–20 | Trong lần chạy của chúng tôi, 80/80 submissions đạt judge result cuối trong 15 phút, không submission nào được tạo hai lần, không có 5xx. 429 được script retry và cuối cùng tạo đúng một submission là chấp nhận được. `RESULT.md` nêu thành phần bão hòa đầu tiên, có screenshot và link commit đã thực hiện vì điều đó. |
| 12–17 | 80/80 trong lần chạy của chúng tôi, nhưng `RESULT.md` không nói thành phần nào bão hòa, hoặc p95 của chúng tôi lớn hơn hai lần của các bạn mà `RESULT.md` không giải thích. |
| 5–11 | Tối đa 8 submissions bị mất, thất bại hoặc trùng lặp, hoặc queue không drain trong 15 phút, và `RESULT.md` báo cáo trung thực. |
| 0–4 | Hơn 8 bị mất, thất bại hoặc trùng lặp; script không chạy; hoặc không có result. |

Submission bị server từ chối và không bao giờ tới queue là submission bị mất: trong thực tế, đó là một sinh viên lỡ deadline. Nếu lần chạy của chúng tôi khác `RESULT.md`, chúng tôi chấm theo lần chạy của mình và nêu trong feedback.

### 5. Một incident post-mortem — 20 điểm

Trong học kỳ này đã có điều gì đó hỏng trong hệ thống: deployment hỏng, queue bị kẹt, model quota hết, sandbox bị kill trong load test. Chọn một sự cố và viết trong `docs/postmortem/<YYYY-MM-DD>-<slug>.md`, với các phần:

1. Summary: hai hoặc ba câu.
2. Impact: ai bị ảnh hưởng, bao nhiêu người, trong bao lâu, và có điểm nào sai tại bất kỳ thời điểm nào không.
3. Timeline: thời điểm kèm múi giờ, từ dấu hiệu đầu tiên tới resolved. Mỗi mục trỏ tới evidence: log line, alert, commit, CI run, message.
4. Detection: phát hiện bằng cách nào, sau khi bắt đầu bao lâu, và alert từ tiêu chí 3 có bắt được nó ở hiện tại không.
5. Root cause: cơ chế, kèm evidence. “Human error” hoặc “assistant đã mắc lỗi” là điểm bắt đầu phân tích, không phải điểm kết thúc.
6. Fix: commit hoặc pull request và cách kiểm tra fix có tác dụng.
7. Follow-up: các hành động, mỗi hành động có owner và status.

Phải là sự kiện có thật trong hệ thống, ở bất kỳ environment nào: production, staging, CI hoặc load test. Lỗi cố ý inject để diễn tập được tính nếu dòng đầu post-mortem nói rõ. Commits bị rewrite sau sự kiện không được tính làm timeline evidence.

| Điểm | Biểu hiện |
|---|---|
| 18–20 | Có cả bảy phần. Mỗi timeline entry trỏ tới evidence và thời gian khớp git history, logs. Root cause là cơ chế có thể lần theo trong evidence. Fix link tới commit và check chứng minh có tác dụng. Ít nhất một follow-up đã hoàn tất và có link, và một follow-up thay đổi cách phát hiện (alert, metric, test). |

## Trang 5

| Điểm | Biểu hiện |
|---|---|
| 12–17 | Incident thật, đủ các phần, nhưng ít hơn một nửa timeline entries có evidence, root cause dừng ở câu “tại sao” đầu tiên, hoặc follow-ups không có owner hay status. |
| 5–11 | Có diễn biến và fix, nhưng thiếu impact hoặc detection, hoặc evidence không đối chiếu được với logs hay commits. |
| 0–4 | Thiếu, template còn placeholder text, hoặc sự kiện không tìm thấy ở bất cứ đâu trong logs hay commits. |

Incident không xảy ra nhận 0 điểm ở đây và được tính là claim không evidence trong honesty adjustment.

### 6. `AI-LOG.md` — 10 điểm

| Điểm | Biểu hiện |
|---|---|
| 9–10 | Có entries cho các phần của checkpoint: deployment, dashboards và alerts, load script, post-mortem. Các dòng Changed / Rejected thực tế, gồm ít nhất một điều assistant làm sai và check hoặc log line đã phát hiện. Ví dụ: load script gửi 80 requests lần lượt, alert không bao giờ fire được, timeline dự thảo không khớp logs. Model đang chạy ở production và cost thực tế của một lab, đọc từ metrics. |
| 5–8 | Liệt kê tools theo từng phần; Changed / Rejected chung chung, hoặc cost là ước tính thay vì đo lường. |
| 1–4 | Sao chép PA#4 mà không có entry mới. |
| 0 | Thiếu. |

`Tool: none` là entry hợp lệ nếu nhóm chọn không sử dụng tool.

### Nếu deployment không hoạt động khi chấm

Chúng tôi thử hai lần vào hai ngày khác nhau trong thời gian chấm, cách nhau ít nhất 6 giờ. Mỗi lần chờ cold start tối đa 60 giây. Chúng tôi ghi lại thời gian và error nhận được.

Không hoạt động một lần: tiêu chí 1 tối đa 4 điểm. Mọi nội dung khác chấm từ lần hoạt động.

Không hoạt động cả hai lần: tiêu chí 1 nhận 0. Tiêu chí 2 và 3 chấm từ walkthrough recording, tiêu chí 4 từ `RESULT.md` của các bạn; mỗi tiêu chí trong ba tiêu chí tối đa band thứ hai (17, 17 và 17).

Chúng tôi không chấm bản sao chạy trên máy của chúng tôi hoặc các bạn.

Fix được deploy sau deadline không được tính. Nếu version trình bày không phải `pa5`, tiêu chí 2 và 3 chấm từ recording.

Recording không làm mất điểm nếu deployment hoạt động, và là phương án dự phòng duy nhất nếu không hoạt động.

## Trang 6

### Những gì cần nộp

1. Tag commit nộp là `pa5` và push tag. Repository tiếp tục public.
2. Đặt `PA5.md` ở root, gồm: public URL và version endpoint; cách deploy và quay lại release trước; các FAQ entries sử dụng; link observability tools; SLO và alert; command load test và link `load/RESULT.md`; link post-mortem.
3. Walkthrough recording: một screen recording liên tục, tối đa 10 phút, gồm sáu bước tiêu chí 2 trên public URL, thực hiện sau khi tag `pa5`. Đặt link (video unlisted được chấp nhận) trong `PA5.md`. Recording không được chấm riêng.
4. `ACCESS.md`, có trong zip nhưng tuyệt đối không commit (liệt kê trong `.gitignore`): tài khoản cho mỗi role, sinh viên thứ hai, và quyền read-only tới observability tools. Dùng tài khoản tạo riêng cho chấm bài, không bao giờ dùng mật khẩu thật của mình.

### Cách nộp

Một file zip repository gồm cả `.git`, đặt tên bằng student IDs tăng dần, nối bằng `-`, và tổng điểm tự chấm: `<StudentID1>-<StudentID2>-<StudentID3>_<total>.zip`, ví dụ `23120001-23120002-23120003_84.zip`. Một thành viên nộp từ Google account `<StudentID>@student.hcmus.edu.vn` của mình.

Zip phải chứa `SELF_ASSESSMENT_REPORT.md`: một dòng cho mỗi tiêu chí rubric này, điểm claim và evidence trỏ tới file, commit, PR, CI run, dashboard hoặc khoảng dòng log. Thêm phần ngắn về những gì chưa làm được. Tổng trong bảng là số trong tên file. Template trên Classroom.

Tên file sai không bị trừ điểm nhưng làm chậm kết quả: grading script đối chiếu bài nộp với danh sách lớp qua tên đó.

Nộp trễ: tối đa 2 giờ trừ 20% điểm, từ 2 đến 24 giờ trừ 50%, quá 24 giờ không nhận. Hệ số trễ áp dụng sau honesty adjustment.

### Honesty adjustment

Điểm tự chấm được so với điểm thực nhận. Chênh lệch là tổng tự chấm − điểm thực nhận, trên cùng thang 100.

| Chênh lệch | Điều chỉnh |
|---|---|
| trong ±10 | không — đây là mức hiệu chỉnh bình thường |
| +11 đến +20 | −3 |
| +21 đến +30 | −6 |
| hơn +30 | −10 |
| −21 hoặc thấp hơn | −3 — đọc rubric trước khi tự chấm quá thấp |
| không có `SELF_ASSESSMENT_REPORT.md` | −10, và bỏ qua tổng trong tên file |

## Trang 7

Tiêu chí được claim mà không có dòng evidence được tính là đã claim nhưng chưa làm trong phép so sánh này.

Điều chỉnh không bao giờ khiến bài nộp xuống dưới 0.

### Quy đổi 100 điểm thành điểm môn học

PA#5 chiếm 3% môn học: 100 điểm ở đây tương đương 3% điểm môn, và 80 điểm tương đương 2,4% (0,24 trên thang 10).
