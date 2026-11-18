# Final project — Thông báo yêu cầu

> Bản dịch hỗ trợ của [requirement.md](requirement.md). Khi có khác biệt, thông báo và rubric gốc được ưu tiên. Giữ nguyên thuật ngữ kỹ thuật tiếng Anh.

Final project chiếm **40% điểm học phần**, gồm sáu milestone; PA#2–PA#6 thực hiện LeeTKOB theo nhóm tối đa 3 người. Mỗi milestone có assignment Classroom riêng, hạn nộp **22:00**, kèm rubric. Tài liệu tổng hợp đính kèm trình bày lịch, 11 feature bắt buộc (F1–F11), các rule áp dụng và nội dung chấm điểm. Rubric PA#3–PA#6 cũng được đính kèm.

| Milestone | Nội dung | Trọng số | Hạn nộp / trạng thái |
| --- | --- | --- | --- |
| PA#1 | Proposal và planning | 4% | Thứ Tư 07/10; đã chấm |
| PA#2 | Harness và quality gate, kèm contract của một endpoint LeeTKOB | 4% | Thứ Tư 11/11; đã đóng |
| PA#3 | Prototype có LLM feature chạy: lab, queue, sandbox, hard rules, model, review queue và checker command trên public deployment | 7% | Thứ Tư 25/11 |
| PA#4 | Eval, guardrails, human gate và red-team | 7% | Thứ Tư 02/12 |
| PA#5 | Final build chạy và được quan sát: publishing, appeals, logs, metrics, traces, load test 80 submissions, một incident post-mortem | 3% | Thứ Tư 16/12 |
| PA#6 | Final demo và vấn đáp cá nhân | 15% | Buổi 14–15: Thứ Năm 24/12 và 31/12; OWNERS.md hạn Thứ Hai 21/12 |

**SEMINAR không thuộc project**: chiếm 7% cùng phần assignments; study hạn Chủ Nhật 29/11.

PA#6 cho mỗi thành viên một điểm trên 100: **final build 40 điểm**, giống nhau cho toàn nhóm — kiểm tra từng feature F1–F11 trên deployment, reload, thử hai rule bằng failure cases, kiểm tra role và phần nhóm làm vượt brief — cộng với **giải thích code của nhóm 60 điểm** cho từng cá nhân. Đóng assistant khi trả lời; không yêu cầu viết code.

PA#3, SEMINAR study và PA#4 nằm trong tám ngày (25/11, 29/11, 02/12). Red team PA#4 tấn công deployment đã nộp ở PA#3: **giữ deployment chạy từ 25/11**.

Mỗi milestone PA#1–PA#5 nộp một ZIP có tên gồm student IDs và tổng điểm tự chấm, bên trong có `SELF_ASSESSMENT_REPORT.md`. Honesty adjustment trong từng rubric so sánh tổng tự chấm với điểm được chấm. Thông báo này thay thế thông báo cũ “Project checkpoints PA#2-PA#6 - dates”; không có ngày nào thay đổi.

Individual assignments còn mở hoặc sắp có: IA#4 (release và rollback), hạn Thứ Tư 18/11; IA#5 (individual eval), hạn Thứ Tư 09/12.
