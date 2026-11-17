## Tóm tắt

Mô tả vấn đề, cách làm kỹ thuật và kết quả quan sát được. Tiêu đề PR viết tiếng Anh; phần mô tả viết tiếng Việt, giữ nguyên thuật ngữ kỹ thuật, identifier và lệnh; không dùng icon trang trí.

## Task và Issue

- Task ID: PAxx-Txx
- Issue liên quan: Refs #<số>
- Mục plan chuẩn:
- Reviewer độc lập: @<account>
- Nhánh đích và lý do:

PR target develop dùng Refs và chỉ đóng Issue thủ công sau khi merge được chấp nhận và đủ gate của task. Chỉ dùng closing keyword trên PR target main khi merge đó thật sự hoàn thành Issue. Không đóng Issue release/nộp bài trước khi có evidence bàn giao.

## Scope và ownership

- Thành phần và artifact thay đổi:
- File dùng chung hoặc interface đã thống nhất thay đổi:
- Ngoài scope:

## Kiểm chứng

| Lệnh hoặc kiểm tra quan sát được | Kết quả | Evidence |
| --- | --- | --- |
| Thay bằng lệnh/kiểm tra thực tế | Chưa chạy / đạt / lỗi, kèm lý do | Link run hoặc output tái lập được |

Không báo thiếu CI là đạt. Giải thích test chưa chạy và blocker còn lại. Giữ evidence lỗi mà task yêu cầu.

## Ảnh hưởng contract, dữ liệu và bảo mật

Mô tả thay đổi contract/version, state/fixture, phân quyền/ownership, secrets/chi phí và migration hoặc tương thích. Ghi không áp dụng kèm lý do khi phù hợp. Không đưa credential hay log nhạy cảm.

## Checklist

- [ ] PR target đúng nhánh, ghi rõ task, Issue và reviewer độc lập.
- [ ] Thay đổi nằm trong scope đã thống nhất của người thực hiện; file dùng chung theo bàn giao đã ghi.
- [ ] Kiểm tra và evidence của task đã đủ, hoặc PR để draft kèm blocker rõ ràng.
- [ ] Lệnh kiểm chứng thực tế, kết quả và các kiểm tra chưa chạy đã ghi lại.
- [ ] Contract/tests vẫn khớp; không nới assertion hay eval label chỉ để pass.
- [ ] Không có credential, memory của assistant, bản backup dọn dẹp hay artifact không liên quan.
- [ ] Plan và Issue khớp nhau về scope, trạng thái checklist, dependency và evidence.
- [ ] Mục review để trống cho tới khi reviewer độc lập thật sự kiểm tra.

## Ghi nhận review

Reviewer được yêu cầu ghi một GitHub review thật từ tài khoản của mình, kiểm checklist review của task và nêu lỗi hoặc evidence nghiệm thu. Tác giả không tự approve PR. Template này không ngầm định reviewer đã approve.

## Việc còn lại và đóng Issue

Liệt kê tiêu chí nghiệm thu còn mở sau PR này. Ghi rõ ai được đóng Issue và chỉ sau gate evidence/merge/bàn giao nào. Merge PR không tự hoàn thành mọi task.
