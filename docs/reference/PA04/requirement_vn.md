# PA04 — Yêu cầu (bản dịch tiếng Việt)

> Bản dịch hỗ trợ đọc hiểu; [bản gốc](requirement.md) là nguồn có thẩm quyền. Khi có khác biệt, ưu tiên bản gốc.

Checkpoint theo nhóm · 100 điểm · 7% điểm môn học · giữ nguyên nhóm PA#3. Sản phẩm là LeeTKOB — đề bài chung của lớp được đính kèm. Rubric được đính kèm — hãy đọc trước khi bắt đầu.

Những gì được chấm: eval làm cổng chặn CI, predictions được model thật tạo ngay trong job (20); lần chạy held-out trên máy của giảng viên, đối chiếu ngưỡng ở mục 3 của đề bài: 0 wrongful deductions, recall ≥ 90%, unsure ≤ 20% (20); năm guardrails ở mục 3, mỗi guardrail có một test dùng fake model (20); human gate, API từ chối Publish khi còn bất kỳ verdict nào trong queue chưa được review (15); một báo cáo red-team trên deployment của nhóm khác (20); và `AI-LOG.md` (5).

Red team: giảng viên đăng mục tiêu của từng nhóm trên Classroom sau hạn PA#3. Chỉ tấn công deployment đó và repository public của nó, trong phạm vi rules of engagement ở mục 5 của rubric. Duy trì deployment PA#3 của nhóm: một nhóm khác sẽ tấn công nó. Nếu deployment mục tiêu không phản hồi, ghi lại từng lần thử kèm thời gian và email nhkhanh@fit.hcmus.edu.vn trong vòng 24 giờ kể từ bài đăng nêu tên mục tiêu của nhóm (mốc này thay cho "chậm nhất thứ Hai, ngày 30 tháng 11" trong rubric).

Gắn tag `pa4` cho commit được nộp và push tag; repository giữ public. Đặt `PA4.md` tại thư mục gốc (CI run của tag, pull request bị chặn và commit sửa, ba lần chạy dev lặp lại, chi phí của một CI run, mục Where we stop it, và model host mà lần chạy held-out phải kết nối tới), và báo cáo đặt trong `docs/red-team/`.

Hạn nộp: thứ Tư, ngày 2 tháng 12 năm 2026, 22:00 — một thành viên nộp từ tài khoản `<StudentID>@student.hcmus.edu.vn` của mình, kèm hai file đính kèm: một file zip của repository, bao gồm `.git`, đặt tên `<StudentID1>-<StudentID2>-<StudentID3>_<self-assessed total>.zip` theo thứ tự mã số tăng dần (ví dụ: `23120001-23120002-23120003_84.zip`), chứa `PA4.md`, `AI-LOG.md` và `SELF_ASSESSMENT_REPORT.md`; và `marking.env` đặt bên cạnh zip, không bao giờ nằm trong zip hay trong git. Không có `marking.env` hoạt động thì held-out set được chạy với model tắt. Nộp trễ: dưới 2 giờ −20%, từ 2–24 giờ −50%, sau 24 giờ không được chấp nhận.
