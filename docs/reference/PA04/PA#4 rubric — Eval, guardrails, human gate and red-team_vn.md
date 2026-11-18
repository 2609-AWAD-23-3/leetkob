# PA#4 — Eval, guardrails, human gate và red-team · rubric

> Bản dịch hỗ trợ đọc hiểu. [PDF gốc](PA%234%20rubric%20%E2%80%94%20Eval%2C%20guardrails%2C%20human%20gate%20and%20red-team.pdf) là nguồn có thẩm quyền; ưu tiên bản gốc khi có khác biệt. Đã đọc toàn bộ nội dung 7 trang; mốc trang theo phần trích xuất của công cụ PDF (công cụ ghi nhận ranh giới trang được suy ra).

## Trang 1

CSC13114 · milestone của project, nhóm tối đa 3 người · 7% điểm môn học · 100 điểm

Sản phẩm là LeeTKOB. Trong PA#3, pipeline đã chạy. Checkpoint này đánh giá liệu có thể tin cậy nó hay không: eval chặn merge, guardrails của mục 3 đề bài, bước Publish mà TA phải đáp ứng điều kiện mới được thực hiện, và lần chạy trên held-out set nhóm chưa từng thấy. Nhóm cũng tấn công deployment của nhóm khác và ghi lại phát hiện.

Ba câu hỏi của chủ đề 10 xuyên suốt mọi phần. Ai chịu hậu quả khi checker sai? Làm sao biết nó sai? Chặn nó ở đâu?

Hạn nộp: thứ Tư, ngày 2 tháng 12 năm 2026, 22:00. Mỗi nhóm nộp một bài, giữ nguyên nhóm PA#3.

### Nội dung được chấm

| # | Tiêu chí | Điểm |
|---|---|---|
| 1 | Eval làm gate cho CI | 20 |
| 2 | Lần chạy held-out | 20 |
| 3 | Guardrails của mục 3 | 20 |
| 4 | Human gate | 15 |
| 5 | Báo cáo red-team trên nhóm khác | 20 |
| 6 | AI-LOG.md | 5 |

### 1. Eval làm gate cho CI — 20 điểm

| Điểm | Biểu hiện |
|---|---|
| 17–20 | Một CI job chạy checker trên dev set công bố và cases riêng, tạo predictions bên trong job bằng model thực, rồi chạy `eval.mjs`. Mọi exit code khác 0 làm job thất bại và job là required check trên `main`. Có link pull request nơi gate đỏ (khấu trừ sai hoặc recall dưới 90%) và merge bị chặn, cùng commit sửa checker, không phải sửa data. Files dev set giống bản công bố từng byte. Có ít nhất 10 cases riêng, có label và tag, bao phủ `trap`, `injection` và `disguised`. Mỗi case được commit trước thay đổi checker xử lý case đó. `PA4.md` báo cáo ba lần chạy cùng commit: số cặp đổi verdict giữa các lần, recall và unsure rate thấp nhất/cao nhất. Đồng thời nêu chi phí một CI run. |
| 11–16 | Gate chạy trên mọi pull request và có thể thất bại, nhưng thiếu một điều: không required, có ít hơn 10 cases riêng, hoặc không có lần chạy lặp lại. |

## Trang 2

| Điểm | Biểu hiện |
|---|---|
| 4–10 | Eval chạy nhưng trên file predictions đã commit vào repository, hoặc với `continue-on-error`, hoặc chỉ trên `main` sau merge. Gate như vậy không bao giờ thấy thay đổi checker. |
| 0–3 | Không có eval trong CI, hoặc `eval.mjs`, label hay file dev set bị thay đổi. |

Model key trong CI nằm ở secrets của repository, không bao giờ trong file. Pull requests từ forks không nhận được secrets (buổi 7, slide 19). Nêu trong `PA4.md` cách gate xử lý điều đó.

### 2. Lần chạy held-out — 20 điểm

Chúng tôi chạy lệnh checker trên held-out set một lần, trong container của mình, và chấm output bằng bản `eval.mjs` của mình. Ngưỡng theo mục 3 của đề bài.

| Điểm | Biểu hiện |
|---|---|
| 17–20 | Đạt cả ba ngưỡng: 0 khấu trừ sai, recall ≥ 90%, unsure ≤ 20%. Trong dải này, recall quyết định: 20 khi từ 95% trở lên, 18–19 từ 92% đến dưới 95%, 17 khi dưới 92%. |
| 11–16 | 0 khấu trừ sai, nhưng recall từ 75% đến 90%, hoặc unsure trên 20%. Checker an toàn nhưng chưa hỗ trợ TA đủ. |
| 5–10 | 0 khấu trừ sai và recall dưới 75%; hoặc đúng một khấu trừ sai. |
| 1–4 | Hai khấu trừ sai trở lên. |
| 0 | Lệnh thất bại, file không hợp lệ (`eval.mjs` exit code 2), hoặc lần chạy bị tiêu diệt trước khi ghi file. |

Chúng tôi không sửa lệnh của nhóm. Nếu phía chúng tôi lỗi (proxy, máy), chúng tôi chạy lại. Cặp bị thiếu được tính là `unsure`, đúng theo `eval.mjs`.

### 3. Guardrails của mục 3 — 20 điểm

Năm guardrails, mỗi cái có test dùng fake model và không network:

1. **Schema.** Output không khớp schema trở thành `unsure`: JSON không hợp lệ, JSON trong code fence hoặc sau văn xuôi, verdict không biết, ràng buộc bị thiếu hoặc trùng.
2. **Evidence.** Mọi dòng bằng chứng phải khớp chính xác code nộp, nếu không verdict trở thành `unsure`: dòng bịa, đúng text nhưng sai số dòng, dòng chỉ tồn tại trong comment đã loại bỏ. Nếu loại bỏ comment, ánh xạ số dòng về code gốc.
3. **Timeout.** Call hết thời gian trở thành `unsure`.
4. **Cost cap mỗi lab.** Khi chạm cap, các ràng buộc còn lại trở thành `unsure` và TA thấy lý do.
5. **Không lấy mức khấu trừ từ model.** Field deduction hoặc bất kỳ chỉ dẫn nào về điểm trong output model không thay đổi gì. Mức khấu trừ hiển thị là mức TA đã đặt.

## Trang 3

| Điểm | Biểu hiện |
|---|---|
| 17–20 | Đủ cả năm, mỗi cái có test, và hard rules vẫn quyết định ràng buộc ban-list trước. Mỗi guardrail và test nằm trong commit riêng, test không muộn hơn code. Không bài nộp injection nào của chúng tôi trên deployment biến lời giải vi phạm thành `pass`: chúng kết thúc là `violation` hoặc `unsure`. |
| 11–16 | Bốn trong năm, hoặc đủ năm nhưng một test không thể thất bại (vẫn pass nếu bỏ guardrail). |
| 4–10 | Chỉ có giới hạn PA#3 (schema và timeout). |
| 0–3 | Tin cậy nguyên trạng output model. |

History tách hoặc dựng lại sau khi hoàn thành công việc không được tính là mỗi phần một commit; nhận mức điểm cho commits trộn nhiều phần.

### 4. Human gate — 15 điểm

| Điểm | Biểu hiện |
|---|---|
| 13–15 | Mọi `violation`, mọi `unsure` và 10% ngẫu nhiên các verdict `pass` (làm tròn lên, server chọn, không phải các verdict đầu tiên) vào review queue của TA. Test với seed cố định chứng minh mẫu chọn. API từ chối Publish, không chỉ ẩn trên màn hình, khi còn verdict trong queue chưa review; đồng thời từ chối sinh viên và TA lớp khác: chúng tôi thử cả ba bằng direct requests. Publish là action duy nhất làm mức khấu trừ hiển thị cho sinh viên. Checker không có tool hay code path ghi điểm. `PA4.md` có mục `Where we stop it` trả lời ba câu hỏi bằng số liệu của nhóm, giải thích vì sao gate nằm ở Publish chứ không ở từng verdict, bao gồm hậu quả/chi phí của những pass không được lấy mẫu. |
| 8–12 | Gate giữ được ở API nhưng thiếu mẫu chọn, mẫu không ngẫu nhiên, hoặc thiếu `Where we stop it`. |
| 3–7 | Gate chỉ ở màn hình: direct request publish được khi còn review chờ. |
| 0–2 | Không có bước Publish hoặc điểm được công bố không qua review. |

### 5. Báo cáo red-team trên nhóm khác — 20 điểm

Giảng viên giao mỗi nhóm một mục tiêu trên Classroom sau deadline PA#3. Deployment và tài khoản test của mục tiêu nằm trong `PA3.md` của họ.

**Rules of engagement.** Chỉ tấn công deployment và public repository của mục tiêu được giao, dùng tài khoản trong `PA3.md` của họ. Không gửi nhiều traffic hơn một sinh viên có thể gửi: tối đa khoảng một request mỗi giây. Mỗi loại tấn công tài nguyên (fork bomb, memory, output) làm một lần là đủ. Kích hoạt cost cap của mục tiêu đúng một lần để chứng minh nó giữ được hay không, không thêm nữa. Không tấn công hosting provider hoặc bất kỳ ai khác. Nếu phát hiện key đang hoạt động hoặc dữ liệu cá nhân thực, dừng lại, không sử dụng và báo giảng viên cùng mục tiêu ngay trong ngày.

Viết báo cáo trong `docs/red-team/<target's student IDs>.md`. Mỗi tấn công một mục:

## Trang 4

- Category và rule được test: một yêu cầu tối thiểu của mục 5, guardrail hoặc human gate của mục 3, hoặc contract riêng của mục tiêu;
- Input chính xác: file `.cpp`, request hoặc các bước;
- Kỳ vọng và quan sát: response, log line hoặc screenshot kèm thời gian;
- Giữ được hay bị phá vỡ (held hoặc broke), và ai chịu hậu quả nếu bị phá vỡ, theo cách diễn đạt của mục 3;
- Với trường hợp phá vỡ, bản sửa nhóm đề xuất.

Các categories: yêu cầu tối thiểu sandbox, model key và dữ liệu gửi model, prompt injection trên ràng buộc ngữ nghĩa, vượt guardrail (evidence, schema, cost cap), human gate và authorization (Publish, queue của lớp khác, bài nộp của sinh viên khác).

| Điểm | Biểu hiện |
|---|---|
| 17–20 | Ít nhất 8 tấn công thuộc ít nhất 5 categories, mỗi tấn công tái hiện được chỉ từ báo cáo. Chúng tôi tự chọn hai tấn công chạy lại trên mục tiêu và nhận kết quả như báo cáo. Báo cáo cả tấn công giữ được lẫn bị phá vỡ. Ít nhất một tấn công xuất phát từ đọc code mục tiêu, không chỉ thử màn hình. |
| 11–16 | Ít nhất 6 tấn công thuộc ít nhất 4 categories, phần lớn tái hiện được; hoặc một lần chạy lại của chúng tôi cho kết quả khác; hoặc rule được test trong mỗi tấn công mơ hồ. |
| 4–10 | Danh sách thử nghiệm không có input chính xác hay output quan sát, hoặc checklist chung không gắn với LeeTKOB. |
| 0–3 | Thiếu, hoặc tấn công thứ khác ngoài deployment được giao, hoặc vi phạm rules of engagement. |

Mục tiêu giữ được mọi thứ không làm giảm điểm nhóm. Báo cáo được chấm theo tấn công và bằng chứng, không phải số lần phá vỡ. Nếu deployment mục tiêu không phản hồi, ghi từng lần thử kèm thời gian và báo giảng viên chậm nhất thứ Hai, ngày 30 tháng 11. Tấn công code mục tiêu chạy trên máy của nhóm, với key của nhóm, cũng được tính; nêu rõ đã chạy theo cách đó.

### 6. AI-LOG.md — 5 điểm

| Điểm | Biểu hiện |
|---|---|
| 5 | Công cụ nào, cho phần nào, và các mục Changed / Rejected thực. Ví dụ: assistant “sửa” eval đỏ bằng đổi label, hoặc guardrail test không thể thất bại, cùng cách nhóm phát hiện. |
| 2–4 | Có liệt kê công cụ; Changed / Rejected trống hoặc chung chung. |
| 0–1 | Thiếu. |

`Tool: none` là mục hợp lệ nếu nhóm chọn không dùng công cụ.

## Trang 5

### Bắt lỗi assistant

| Dấu hiệu | Ý nghĩa | Chúng tôi kiểm tra |
|---|---|---|
| Label, file `.cpp` dev hoặc `eval.mjs` thay đổi trong checker PR | Mục tiêu đã bị thay đổi | SHA-256 so với bản công bố: `eval.mjs` bắt đầu `c836edd8713521bb`, `labels.jsonl` bắt đầu `262cda7b0ef5612e`. Dù sao chúng tôi cũng chấm bằng bản của mình |
| Gate đọc `predictions.jsonl` từ repository | Không bao giờ đỏ khi checker đổi | Tiêu chí 1 |
| `continue-on-error`, `\|\| true` hoặc không kiểm tra exit code | Gate không thể thất bại | Tiêu chí 1 |
| Case riêng đổi label trong commit làm gate xanh | Case bị sửa để pass | `git log -p` trên cases |
| Guardrail test vẫn pass khi xóa guardrail | Test kiểm tra fake, không phải guardrail | Chúng tôi xóa guardrail và chạy test |
| Prompt nêu tên lời giải dev set hoặc xử lý riêng code của chúng | Tinh chỉnh theo dev set | Lần chạy held-out bộc lộ điều này |
| Publish ẩn trên màn hình nhưng endpoint không kiểm tra | Nút ẩn không phải kiểm tra (buổi 6, slide 12) | Tiêu chí 4, direct requests |

`CODEOWNERS` trên tests, `.github/` và eval data, với review bắt buộc từ code owners, có nghĩa là một người phê duyệt các thay đổi đó (buổi 7, slide 22).

### Những gì chúng tôi chạy khi chấm

1. Repository từ tag `pa4` trong zip. So sánh files dev set với bản công bố.
2. Checks và guardrail tests, bằng các lệnh trong README, trong container cắt network sau khi cài dependencies, bị tiêu diệt sau 15 phút.
3. Lần chạy held-out. Chúng tôi build checker image và chạy lệnh trên held-out set, bị tiêu diệt sau 30 phút. Container không có network ngoại trừ proxy chỉ cho phép đến model host README nêu. Chấm output bằng bản `eval.mjs` của chúng tôi.
4. Deployment: Publish khi còn review chờ (với vai trò TA, TA khác, sinh viên), mẫu chọn pass và các bài nộp injection của chúng tôi.
5. Báo cáo nhóm viết: chúng tôi chạy lại hai tấn công trên mục tiêu.

**Cách chúng tôi tiếp cận model cho lần chạy held-out.** Nhóm tự trả tiền calls. Đính kèm file `marking.env` vào bài nộp Classroom, bên cạnh zip, không ở trong zip, và không bao giờ trong

## Trang 6

Git. File chỉ chứa các biến lệnh checker cần: key tạo riêng cho lần chạy này, hoặc URL và token của model endpoint riêng của nhóm. Chúng tôi chỉ dùng cho held-out run, không việc gì khác. Thu hồi key khi có điểm PA#4. Không có `marking.env` hoạt động thì chúng tôi chạy checker với model tắt, trên thực tế nghĩa là recall dưới 90%.

### Những gì cần bàn giao

1. Gắn tag `pa4` cho commit nộp và push tag. Repository tiếp tục public, deployment tiếp tục chạy.
2. Đặt `PA4.md` ở thư mục gốc, gồm: CI run cho tag, pull request bị chặn và commit sửa, ba dev runs lặp lại, chi phí một CI run, mục `Where we stop it`, và model host held-out run phải truy cập.
3. Báo cáo red-team trong `docs/red-team/`.
4. `marking.env`, đính kèm bên cạnh zip.

### Cách nộp

Một file zip của repository bao gồm `.git`, tên theo mã số sinh viên tăng dần, nối bằng `-`, và tổng điểm tự chấm: `<StudentID1>-<StudentID2>-<StudentID3>_<total>.zip`, ví dụ `23120001-23120002-23120003_84.zip`. Một thành viên nộp từ Google account `<StudentID>@student.hcmus.edu.vn` của mình, kèm `marking.env` là file đính kèm thứ hai.

Zip phải chứa `SELF_ASSESSMENT_REPORT.md`: mỗi tiêu chí rubric một hàng, điểm nhóm nhận và bằng chứng dẫn đến file, commit, PR hoặc CI run. Với tiêu chí 2, nhận điểm theo gợi ý từ các dev-set runs và nêu rõ điều đó. Thêm đoạn ngắn về những gì nhóm chưa làm được. Tổng trong bảng là số trong tên file. Template trên Classroom.

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

## Trang 7

| Chênh lệch | Điều chỉnh |
|---|---|
| Không có `SELF_ASSESSMENT_REPORT.md` | −10, và bỏ qua tổng điểm trong tên file |

Tiêu chí nhóm nhận điểm nhưng không có dòng bằng chứng được tính là đã nhận điểm nhưng chưa làm trong phép so sánh này. Điều chỉnh không bao giờ làm bài nộp xuống dưới 0.

### Chuyển 100 điểm thành điểm môn học

PA#4 chiếm 7% môn học: 100 điểm ở đây tương đương 7% điểm môn học, 80 điểm tương đương 5,6% (0,56 trên thang 10).
