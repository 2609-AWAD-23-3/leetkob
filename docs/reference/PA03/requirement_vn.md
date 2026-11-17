# PA03 — Yêu cầu (bản dịch tiếng Việt)

> Bản dịch hỗ trợ đọc hiểu; [bản gốc](requirement.md) là nguồn có thẩm quyền. Khi có khác biệt, ưu tiên bản gốc.

Checkpoint theo nhóm · 100 điểm · 7% điểm môn học. Sản phẩm là LeeTKOB — đề bài chung của lớp được đính kèm. Rubric được đính kèm — hãy đọc trước khi bắt đầu.

Những gì cần xây dựng: TA tạo một lab kèm các ràng buộc; sinh viên nộp bài; mã nguồn được đưa vào queue và một worker riêng biệt chấm bài trong sandbox đáp ứng chín yêu cầu tối thiểu của đề bài, mỗi yêu cầu có một bài nộp tấn công chạy trong CI. Bài nộp Accepted đi qua hard rules trước, sau đó đến model; đầu ra của model được kiểm tra theo schema và có timeout. Các verdict cùng bằng chứng được đưa vào review queue của TA và không bao giờ đến sinh viên nếu chưa qua TA. Ngoài ra: một lệnh checker duy nhất kèm Dockerfile và công tắc tắt model `MODEL_OFF=1`, cùng lần eval đầu tiên trên dev set.

Từ milestone này trở đi, LeeTKOB chạy trên một public deployment: duy trì hoạt động cho đến khi có điểm PA#4, vì một nhóm khác sẽ tấn công hệ thống trong PA#4. Ghi URL, các tài khoản thử nghiệm, CI run và lần chạy dev set đã commit vào `PA3.md` tại thư mục gốc. Gắn tag `pa3` cho commit được nộp và push tag; repository phải public.

Hạn nộp: thứ Tư, ngày 25 tháng 11 năm 2026, 22:00 — một thành viên nộp từ tài khoản `<StudentID>@student.hcmus.edu.vn` của mình: một file zip của repository, bao gồm `.git`, đặt tên `<StudentID1>-<StudentID2>-<StudentID3>_<self-assessed total>.zip` theo thứ tự mã số tăng dần (ví dụ: `23120001-23120002-23120003_84.zip`), chứa `PA3.md`, `AI-LOG.md` và `SELF_ASSESSMENT_REPORT.md`. Nộp trễ: dưới 2 giờ −20%, từ 2–24 giờ −50%, sau 24 giờ không được chấp nhận.
