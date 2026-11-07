# AI log input — planning và workflow trước T01

Đầu vào bổ sung cho T11; không thêm task ID ngoài T01–T12 và không đánh dấu T09/T11/T12 đã hoàn thành. Bản tường trình được bổ sung sau công việc, đối chiếu plan và nhánh workflow hiện có; cần người thực hiện xác nhận trước khi chốt hồ sơ nộp.

## 2026-11-02 — PA02: plan, Issues và quy trình PR
Tool: OpenClaw assistant.
Asked for: tổ chức plan theo yêu cầu/rubric, phân công nhóm, tạo Issues tiếng Anh và quy trình task PR vào develop; sau đó đồng bộ việc chuyển T12 sang Vỹ.
Kept: 12 work packages có executor/reviewer riêng và checklist/evidence; plan là nguồn scope, Issues là bản operational mirror; workflow và templates ở PR #13.
Changed: assistant đồng bộ T12 sang Vỹ, reviewer Phúc trên nhánh quy trình theo yêu cầu người dùng; làm rõ develop-target PR dùng Refs thay vì giả nhận closing keyword sẽ đóng Issue. Nhánh T01 chưa tích hợp PR #13 nên vẫn phải giữ thay đổi phân công khi tích hợp, không lấy plan cũ trên T01 ghi đè.
Rejected: không dùng reviewer tự duyệt, không đóng Issue chỉ vì skeleton chạy được, không coi file workflow/policy là branch protection đã được enforce. Đây là các quyết định/phạm vi loại bỏ, không tự nhận mọi phương án đã có code.
By hand: người dùng xác nhận vai trò B/Vỹ và yêu cầu chuyển T12; tài liệu/Issues/templates do assistant thao tác. Chưa gán phần đó thành nội dung sinh viên tự viết; chưa có xác nhận independent approval được ghi trong hồ sơ này.

Evidence: [PR #13](https://github.com/2609-AWAD-23-3/leetkob/pull/13), [workflow source commit](https://github.com/2609-AWAD-23-3/leetkob/commit/107e5a260495e351d864eef615ff6df4c59b6dc6), [plan PA02](../../plans/PA02.md). PR/commit là tham chiếu lịch sử; file này không phải lần xác minh trạng thái GitHub mới.

T11 tổng hợp cùng [entry T01](T01/AI-LOG.md), không copy dữ liệu tài khoản/credential hoặc toàn bộ chat. Các lỗi/cải tiến khác chỉ bổ sung khi có nguồn cụ thể, không tái dựng một câu chuyện sự cố để đạt điểm rules.
