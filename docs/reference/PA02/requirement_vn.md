# PA02 - Harness và quality gate

> Bản dịch từ `requirement.md`. Giữ nguyên thuật ngữ chuyên ngành, tên file, đường dẫn, lệnh và identifier kỹ thuật.

Checkpoint theo nhóm · 100 điểm · chiếm 4% điểm môn học. Sản phẩm là **LeeTKOB** - đọc class project brief đính kèm trước. Rubric được đính kèm; hãy đọc trước khi bắt đầu.

## Những gì cần xây dựng

- Một rules file cho assistant.
- Quyền hạn được ghi thành văn bản và không có secrets trong lịch sử Git.
- Mỗi check có một lệnh riêng: lint, format check, type check và tests; dùng cùng các lệnh đó ở local và trong CI.
- Branch `main` được bảo vệ, với các check trên là required checks.
- Contract của một endpoint LeeTKOB tại `docs/contract/<endpoint>.md`.
- Contract tests chạy trong CI đó.

## Chứng minh quality gate thực sự chặn lỗi

Đưa vào `PA2.md` ở root các liên kết tới:

- Một pull request bị check đỏ chặn.
- Commit sửa lỗi khiến check chuyển xanh.
- Một lần cố ý làm sai contract và được CI phát hiện.

Gắn tag `pa2` cho commit nộp bài và push tag; repository phải public.

## Nộp bài

**Hạn nộp: thứ Tư, ngày 11/11/2026, lúc 22:00.**

Một thành viên nộp từ tài khoản `<StudentID>@student.hcmus.edu.vn`:

- Một file zip chứa repository, **bao gồm cả `.git`**.
- Tên file: `<StudentID1>-<StudentID2>-<StudentID3>_<self-assessed total>.zip`, với các StudentID theo thứ tự tăng dần.
- Ví dụ: `23120001-23120002-23120003_84.zip`.
- Trong zip phải có `PA2.md`, `AI-LOG.md` và `SELF_ASSESSMENT_REPORT.md`.
