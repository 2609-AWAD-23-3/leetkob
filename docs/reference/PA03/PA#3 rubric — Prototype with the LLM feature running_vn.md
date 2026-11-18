# PA#3 — Prototype với tính năng LLM hoạt động · rubric

> Bản dịch hỗ trợ đọc hiểu. [PDF gốc](PA%233%20rubric%20%E2%80%94%20Prototype%20with%20the%20LLM%20feature%20running.pdf) là nguồn có thẩm quyền; ưu tiên bản gốc khi có khác biệt. Đã đọc toàn bộ nội dung 8 trang; mốc trang bên dưới theo phần trích xuất của công cụ PDF (công cụ ghi nhận ranh giới trang được suy ra).

## Trang 1

CSC13114 · milestone của project, nhóm tối đa 3 người · 7% điểm môn học · 100 điểm

Sản phẩm là LeeTKOB: đọc lại đề bài chung của lớp trước khi bắt đầu, mục 3 đến 7. Checkpoint này đánh dấu lần đầu toàn bộ pipeline chạy thực sự. TA tạo lab có ràng buộc. Sinh viên nộp bài, mã được chấm trong sandbox thông qua queue. Bài nộp Accepted đi qua hard rules rồi đến model. Các verdict cùng bằng chứng xuất hiện trong review queue của TA, và không ở nơi nào khác.

Hãy dùng assistant cho tất cả những việc này. Chúng tôi chấm những gì có thể quan sát: trên deployment, trong repository và trong những lần chạy chúng tôi tự lặp lại. Mục **Những gì chúng tôi chạy khi chấm** nói rõ các lần chạy đó.

Hạn nộp: thứ Tư, ngày 25 tháng 11 năm 2026, 22:00. Mỗi nhóm nộp một bài, giữ nguyên nhóm PA#2.

### Nội dung được chấm

| # | Tiêu chí | Điểm |
|---|---|---|
| 1 | Luồng end-to-end trên deployment của nhóm | 15 |
| 2 | Queue và sandbox | 20 |
| 3 | Hard rules trước | 15 |
| 4 | Model chấm các ràng buộc ngữ nghĩa | 20 |
| 5 | Các giới hạn đầu tiên và review queue | 10 |
| 6 | Lệnh checker và lần eval đầu tiên | 10 |
| 7 | Tests trước, mỗi phần một commit | 5 |
| 8 | AI-LOG.md | 5 |

**Quy tắc của đề cương môn học.** Một tính năng gọi model rồi hiển thị trực tiếp kết quả, không có eval, không có giới hạn và không có xác nhận của con người, không được tính là hoàn thành PA#3, dù demo chạy tốt đến đâu. Ở đây có nghĩa là: nếu verdict của model thay đổi điểm sinh viên hoặc đến sinh viên dưới dạng khấu trừ mà không qua TA, hoặc nếu đầu ra model được sử dụng mà không kiểm tra schema và không có giới hạn thời gian, tiêu chí 4, 5 và 6 nhận 0 điểm.

### 1. Luồng end-to-end trên deployment của nhóm — 15 điểm

Chúng tôi đăng nhập bằng các tài khoản trong `PA3.md`. Với vai trò TA, chúng tôi tạo lab trong lớp của mình từ bài `sort-merge` của dev set: đề bài, tests và hai ràng buộc cùng mức khấu trừ. Với vai trò sinh viên, chúng tôi nộp ba lời giải: một tuân thủ, một vi phạm, một trường hợp injection. Sau đó mở review queue của TA.

## Trang 2

| Điểm | Biểu hiện |
|---|---|
| 13–15 | Mọi bước trên hoạt động trên deployment, qua màn hình hoặc API của chính sản phẩm. Mỗi bài nộp chuyển từ queued sang judged và sinh viên thấy kết quả. Review queue hiển thị, cho từng bài nộp và từng ràng buộc, verdict, các dòng bằng chứng và mức khấu trừ TA đã chọn. TA của lớp khác không thể xem lab hoặc queue (status được nêu trong contract PA#2 của nhóm). |
| 8–12 | Luồng hoạt động nhưng chỉ ở local hoặc trong video, hoặc một bước cần seed script hay chỉnh database (ví dụ lab chỉ tồn tại nhờ script tạo). |
| 3–7 | Các phần chạy riêng rẽ (judge, checker), nhưng verdict không bao giờ đến từ bài nộp thực. |
| 0–2 | Không có luồng. |

Nếu deployment không phản hồi khi chấm, chúng tôi thử lại vào ngày khác. Nếu vẫn không phản hồi, chúng tôi chấm qua video và tiêu chí này không thể vượt quá 10.

### 2. Queue và sandbox — 20 điểm

Các yêu cầu tối thiểu trong mục 5 của đề bài, mỗi yêu cầu một bài nộp kiểm thử (buổi 6, slide 14–16). Có chín yêu cầu:

1. Không có network;
2. Giới hạn CPU time;
3. Giới hạn wall-clock tiêu diệt container, không chỉ process;
4. Giới hạn memory, bao gồm swap; test đọc lại vùng nhớ đã cấp phát để compiler không thể loại bỏ việc cấp phát;
5. Giới hạn process;
6. Giới hạn kích thước output;
7. User không phải root;
8. Không host mounts và không Docker socket;
9. Không secrets: model API key không nằm trong environment, files của sandbox hoặc bất cứ thứ gì compiler có thể `#include`.

| Điểm | Biểu hiện |
|---|---|
| 17–20 | Đủ cả chín; mỗi yêu cầu có bài nộp tấn công trong repository chạy trong CI trên tag `pa3` và thất bại theo đúng cách phải thất bại. Việc compile cũng diễn ra trong sandbox. Bài nộp vào queue và worker riêng chấm: dừng worker, nộp bài, khởi động lại worker, bài được chấm đúng một lần (bằng test hoặc bước này trong video). Không bài nộp tấn công nào của chúng tôi trên deployment thoát ra ngoài. |
| 11–16 | Cả chín đã cấu hình nhưng một đến ba yêu cầu không có test, hoặc có test không thể thất bại. Hoặc “queue” chỉ là lời gọi trực tiếp từ request handler. |
| 4–10 | Có sandbox chạy nhưng chỉ chứng minh được năm yêu cầu tối thiểu trở xuống, hoặc một tấn công của chúng tôi thoát ra ngoài (ngoại trừ các hàng 1, 8 và 9). |

## Trang 3

| Điểm | Biểu hiện |
|---|---|
| 0–3 | Không có sandbox, hoặc một tấn công của chúng tôi truy cập được network, thấy Docker socket hoặc đọc được model key. |

Với giới hạn CPU time và kích thước output, test cho thấy giới hạn có hiệu lực là đủ; các giới hạn này có thể nằm trong runner và hoạt động giống nhau trong container đơn giản và container đã harden.

“Chấm đúng một lần” nghĩa là chỉ đúng một bộ verdict được lưu sau khi worker dừng và khởi động lại, ngay cả khi bản thân việc chấm chạy hai lần.

Judge0 là lựa chọn hợp lệ. Khi đó tests phải tấn công cấu hình Judge0 của nhóm.

### 3. Hard rules trước — 15 điểm

Ràng buộc có văn bản bắt đầu bằng “Do not use” hoặc “Do not call” là ban list, và mỗi tên bị cấm nằm trong backticks (`leetkob-eval/README.md`). Code quyết định các trường hợp này.

| Điểm | Biểu hiện |
|---|---|
| 13–15 | Ràng buộc ban-list do code hiểu cú pháp quyết định, không phải tìm kiếm raw text. Các trap không kích hoạt: `sort` do sinh viên tự viết trong namespace, tên bị cấm trong comment hoặc string, `<algorithm>` chỉ được include để dùng `std::swap`. Khi hard rule đã quyết định ràng buộc, model không được gọi cho ràng buộc đó, và call log chứng minh điều này. Lần chạy tắt model của chúng tôi (tiêu chí 6) có 0 khấu trừ sai trên dev set và quyết định mọi cặp ban-list. |
| 8–12 | Hard rules bắt được trường hợp đơn giản, nhưng lần chạy model-off của chúng tôi có một hoặc hai khấu trừ sai trên trap, hoặc model vẫn được gọi cho các ràng buộc hard rule đã quyết định. |
| 3–7 | Tìm kiếm text (coi comment và string là code), với nhiều khấu trừ sai; hoặc rules viết theo tên bài của dev set, không thể hoạt động với bài mới. |
| 0–2 | Không có hard rules: model quyết định mọi thứ. |

### 4. Model chấm các ràng buộc ngữ nghĩa — 20 điểm

| Điểm | Biểu hiện |
|---|---|
| 17–20 | Backend gọi model thực cho mọi ràng buộc ngữ nghĩa. Chỉ gửi đề bài, ràng buộc và code đã loại bỏ comment cùng danh tính sinh viên: các prompt trong call log thể hiện điều này. Với mỗi ràng buộc, model trả về `pass`, `violation` hoặc `unsure` cùng các dòng bằng chứng, không có gì thiết lập mức khấu trừ. Commit một lần chạy thực trên dev set: predictions, báo cáo `eval.mjs` và call log có request ids của provider, model, tokens, thời gian và chi phí mỗi call. README và `AI-LOG.md` nêu model và chi phí cho một lab 80 bài nộp, kèm phép tính. |
| 11–16 | Có call thực nhưng thiếu một trong các điểm sau: comment hoặc danh tính vẫn ở prompt, không có chi phí mỗi lab, hoặc không có call log. |

## Trang 4

| Điểm | Biểu hiện |
|---|---|
| 4–10 | Có gọi model nhưng lưu hoặc hiển thị free text; không có verdict và bằng chứng cho từng ràng buộc. |
| 0–3 | Không có call thực (chỉ stub), hoặc key nằm trong browser, sandbox hay repository. |

### 5. Các giới hạn đầu tiên và review queue — 10 điểm

Guardrails đầy đủ của mục 3 được chấm trong PA#4. Ở đây chấm hai giới hạn đầu tiên và nơi verdict được đưa đến.

| Điểm | Biểu hiện |
|---|---|
| 9–10 | Đầu ra model được validate theo schema; bất cứ đầu ra nào không đạt chuyển thành `unsure`. Call hết thời gian chuyển thành `unsure`. Cả hai có tests dùng fake model và không network. Verdict chỉ vào review queue của TA. Không có gì trong build này chuyển verdict thành điểm công bố. Nếu đã có action Publish, action từ chối khi còn bất kỳ verdict nào chưa review. Nội dung sinh viên thấy trước khi publish tuân theo FAQ của product owners và nhóm trích dẫn mục FAQ đó. |
| 5–8 | Thiếu hoặc không có test cho một trong hai giới hạn. |
| 1–4 | Đầu ra model được lưu nguyên trạng nhận được. Có queue. |
| 0 | Verdict đến điểm sinh viên mà không qua TA. Áp dụng quy tắc đề cương nêu trên. |

### 6. Lệnh checker và lần eval đầu tiên — 10 điểm

Mục 6 của đề bài: một command line nhận thư mục dataset và ghi file prediction. Giảng viên chạy held-out set qua đúng lệnh đó trong PA#4, nên phải hoạt động ở đây trước. Lệnh cũng cần công tắc model-off, biến môi trường `MODEL_OFF=1`, để một lệnh chấm dùng cho mọi nhóm: chỉ chạy hard rules, ghi `unsure` cho mọi ràng buộc ngữ nghĩa và không mở kết nối network nào.

| Điểm | Biểu hiện |
|---|---|
| 9–10 | README cung cấp lệnh và Dockerfile để build image cho lệnh đó. Chúng tôi chạy image với model tắt trên bản dev set của mình (xem dưới), và image ghi file hợp lệ: `eval.mjs` kết thúc bằng exit code 0 hoặc 1, không bao giờ là 2. Hoạt động chỉ với `statement.md` và `constraints.json`. Lần chạy model thực đã commit, được chấm lại bằng bản `eval.mjs` của chúng tôi, cho đúng số liệu nhóm báo cáo. Dev set trong repository giống bản công bố từng byte. Các case riêng của nhóm nằm ở thư mục khác cùng layout: ít nhất năm, mỗi case có label và tag, với ít nhất một `trap` và một `injection`. |
| 5–8 | Lệnh chạy nhưng cần setting viết tay theo từng bài hoặc thao tác thủ công, hoặc số liệu chấm lại khác số liệu nhóm. |

## Trang 5

| Điểm | Biểu hiện |
|---|---|
| 1–4 | File prediction không do checker tạo: nhập tay hoặc chép từ `labels.jsonl`. |
| 0 | Không có lệnh, hoặc dev set hay `eval.mjs` bị sửa. |

PA#3 không có điểm đạt tối thiểu cho eval. Báo cáo trung thực ba số liệu. Các ngưỡng của mục 3 bắt đầu được tính trong PA#4.

### 7. Tests trước, mỗi phần một commit — 5 điểm

| Điểm | Biểu hiện |
|---|---|
| 5 | Tests cho hard rules (bao gồm trap) và hai giới hạn nằm trong commit trước code được test, hoặc cùng commit. Mỗi commit bao phủ một phần: sandbox, queue, hard rules, model call, limits. Không test, eval case hoặc label nào được nới lỏng trong commit khiến nó pass. |
| 2–4 | Tests có sau code, hoặc commits trộn nhiều phần. |
| 0–1 | Một commit chứa mọi thứ, hoặc test được nới lỏng trong commit làm nó xanh. |

History tách hoặc dựng lại sau khi hoàn thành công việc không được tính là mỗi phần một commit; nhận mức điểm cho commits trộn nhiều phần. Chúng tôi kiểm tra bằng thời gian commit và nội dung `AI-LOG.md`.

### 8. AI-LOG.md — 5 điểm

| Điểm | Biểu hiện |
|---|---|
| 5 | Công cụ nào, cho phần nào, và các mục Changed / Rejected thực. Ví dụ: hard rule assistant viết bằng regex kích hoạt trên comment, hoặc prompt nêu tên lời giải dev set, và cách nhóm phát hiện. |
| 2–4 | Có liệt kê công cụ; Changed / Rejected trống hoặc chung chung. |
| 0–1 | Thiếu. |

`Tool: none` là mục hợp lệ nếu nhóm chọn không dùng công cụ.

### Bắt lỗi assistant

Đây là những lỗi assistant thường mắc nhất ở checkpoint này. Chúng tôi tìm từng lỗi, vì vậy nhóm hãy kiểm tra trước.

## Trang 6

| Dấu hiệu | Ý nghĩa | Chúng tôi kiểm tra |
|---|---|---|
| `eval.mjs`, `labels.jsonl` hoặc file `.cpp` của dev bị sửa | Mục tiêu đã bị thay đổi | SHA-256 so với bản công bố: `eval.mjs` bắt đầu `c836edd8713521bb`, `labels.jsonl` bắt đầu `262cda7b0ef5612e`. Dù sao chúng tôi cũng chấm bằng bản của mình |
| Prompt hoặc hard rule nêu `sort-merge/s05` hoặc trích code dev set | Tinh chỉnh theo dev set; không chịu được bài mới | Tìm dev-set ids trong prompts và rules |
| Test hoặc eval case được nới lỏng trong commit làm nó xanh | Test bị sửa để pass | `git log -p` trên tests và cases riêng của nhóm |
| Test 1 GiB pass nhưng không đọc lại memory | Compiler đã loại bỏ cấp phát | Tiêu chí 2, hàng 4 |
| `-v /var/run/docker.sock`, `--privileged`, `--env-file` hoặc `-e MODEL_API_KEY` trên lệnh sandbox | Mất các yêu cầu tối thiểu của đề bài | Các bài nộp tấn công của chúng tôi |
| Dev run “thực” có call log không có request ids của provider | Model đã bị mock | Tiêu chí 4 |

Đưa các mục này vào danh sách never của rules file.

### Những gì chúng tôi chạy khi chấm

1. Repository từ tag `pa3` trong zip. So sánh files dev set với bản công bố.
2. Checks bằng các lệnh trong README, trong container. Cài dependencies trước; sau đó cắt network và tiêu diệt container sau 15 phút. Sandbox tests cần Docker, nên chúng tôi đọc chúng từ CI run của tag thay vì chạy trên máy mình.
3. Checker image, model tắt, trên bản dev set của chúng tôi: `docker run --network none`, có giới hạn memory và process, bị tiêu diệt sau 10 phút. Chấm output bằng bản `eval.mjs` của chúng tôi.
4. Lần chạy model thực đã commit, được chấm lại bằng bản `eval.mjs` của chúng tôi.
5. Deployment với tài khoản trong `PA3.md`: đi qua tiêu chí 1, sau đó khoảng mười bài nộp tấn công riêng xây dựng từ buổi 6, slide 14.

**Cách chúng tôi tiếp cận model.** Trong PA#3, chúng tôi không bao giờ cần API key của nhóm. Model thực chỉ được gọi bởi deployment của nhóm, nơi key nằm trên server của nhóm, và trong dev-set run nhóm commit. Mọi thứ chúng tôi chạy trên máy mình đều tắt model và cắt network.

## Trang 7

### Những gì cần bàn giao

1. Gắn tag `pa3` cho commit nộp và push tag. Repository tiếp tục public.
2. Duy trì deployment từ deadline cho đến khi có điểm PA#4. Red team của nhóm trong PA#4 sẽ tấn công nó.
3. Đặt `PA3.md` ở thư mục gốc, gồm:
4. URL deployment và tài khoản test: một admin, hai TA ở hai lớp khác nhau và hai sinh viên trong lớp TA thứ nhất. Không chứa dữ liệu thực. Bất kỳ ai đọc public repository đều dùng được, nên đặt spending cap có xét điều này;
5. CI run cho tag, chứa sandbox tests;
6. Lệnh checker, dòng Docker build và công tắc model-off;
7. Thư mục dev-set run đã commit, có file prediction và báo cáo `eval.mjs`, không chỉ ba số liệu. Model thực không trả lời giống nhau hai lần, nên điểm dựa trên việc chấm lại file đã commit, không phải số liệu nhóm ghi;
8. Link video quay màn hình tối đa 5 phút, thể hiện luồng tiêu chí 1 trên deployment. Chúng tôi chỉ xem khi deployment không phản hồi.

### Cách nộp

Một file zip của repository bao gồm `.git`, tên theo mã số sinh viên tăng dần, nối bằng `-`, và tổng điểm tự chấm: `<StudentID1>-<StudentID2>-<StudentID3>_<total>.zip`, ví dụ `23120001-23120002-23120003_84.zip`. Một thành viên nộp từ Google account `<StudentID>@student.hcmus.edu.vn` của mình.

Zip phải chứa `SELF_ASSESSMENT_REPORT.md`: mỗi tiêu chí rubric một hàng, điểm nhóm nhận và bằng chứng dẫn đến file, commit, PR hoặc CI run. Thêm đoạn ngắn về những gì nhóm chưa làm được. Tổng trong bảng là số trong tên file. Template trên Classroom.

Tên file sai không mất điểm nhưng làm chậm kết quả: script chấm đối chiếu bài nộp với danh sách lớp bằng tên này.

Nộp trễ: tối đa 2 giờ mất 20% điểm, từ 2 đến 24 giờ mất 50%, quá 24 giờ không nhận. Hệ số trễ áp dụng sau điều chỉnh trung thực.

### Điều chỉnh trung thực

Tự đánh giá được so với điểm thực đạt. Chênh lệch là tổng điểm nhóm − điểm thực, cùng thang 100.

| Chênh lệch | Điều chỉnh |
|---|---|
| Trong ±10 | Không — đây là mức hiệu chỉnh bình thường |
| +11 đến +20 | −3 |
| +21 đến +30 | −6 |
| Lớn hơn +30 | −10 |
| −21 hoặc thấp hơn | −3 — đọc rubric trước khi tự hạ điểm |

## Trang 8

| Chênh lệch | Điều chỉnh |
|---|---|
| Không có `SELF_ASSESSMENT_REPORT.md` | −10, và bỏ qua tổng điểm trong tên file |

Tiêu chí nhóm nhận điểm nhưng không có dòng bằng chứng được tính là đã nhận điểm nhưng chưa làm trong phép so sánh này. Điều chỉnh không bao giờ làm bài nộp xuống dưới 0.

### Chuyển 100 điểm thành điểm môn học

PA#3 chiếm 7% môn học: 100 điểm ở đây tương đương 7% điểm môn học, 80 điểm tương đương 5,6% (0,56 trên thang 10).
