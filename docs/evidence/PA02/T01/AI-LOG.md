# AI log input — T01

Đầu vào cho người tổng hợp T11, không thay thế AI-LOG.md bắt buộc ở root. Đây là bản ghi do assistant soạn; không tự nhận sinh viên đã viết code hoặc review độc lập. Mục triển khai được đối chiếu với phần AI assistance đã ghi trong PR #14; mục cập nhật sau ghi theo yêu cầu review local. Không phải transcript chat.

## 2026-11-02 — T01: architecture baseline và skeleton
Tool: OpenClaw assistant và worker QA kỹ thuật chỉ đọc. Codex CLI không được dùng trong phần triển khai này.
Asked for: triển khai T01 đồng thời giải thích phạm vi, lựa chọn và cách chạy.
Kept: nền TypeScript/Fastify, app factory tách listener/config, ba module plugins và smoke tests; đây là candidate đang review, chưa phải stack được nhóm chấp thuận.
Changed: assistant sửa regex content-type ban đầu khiến smoke test không parse thành assertion media-type chính xác; thêm noEmitOnError. Không phải sinh viên sửa bằng tay. Source/tests hiện tại nằm trong commit 738b183aef8e180f8e72ef22edcef3521e65c3c1.
Rejected: không đưa vào T01 business response thành công giả, auth/store tự suy diễn hoặc scaffold nhiều service; không coi smoke checks là hoàn tất T04/T09. Đây là lựa chọn phạm vi, không giả nhận mọi phương án đều đã có implementation để xóa.
By hand: chưa có bằng chứng sinh viên tự viết implementation hoặc reviewer Phúc chấp thuận. Người dùng đặt yêu cầu và đặt điều kiện review; chưa gán phần assistant viết thành công việc làm tay.

Evidence: [PR #14](https://github.com/2609-AWAD-23-3/leetkob/pull/14), [source commit](https://github.com/2609-AWAD-23-3/leetkob/commit/738b183aef8e180f8e72ef22edcef3521e65c3c1), [hồ sơ T01](README.md).

## 2026-11-02 — T01: phản hồi ngôn ngữ và bổ sung hồ sơ
Tool: OpenClaw assistant.
Asked for: cho review local trước khi xuất bản; sau đó bỏ bản dịch, giữ bản English cũ và kiểm tra evidence/AI log để tổng hợp theo task.
Kept: giữ README/architecture/comments cũ của commit 738b183; giữ nguyên logic, manifest, lockfile và các acceptance checkboxes.
Changed: assistant hoàn tác 12 file bản dịch chưa commit; bổ sung evidence build/smoke/fresh local clone và bản ghi task này. Collector phụ trợ ban đầu lỗi escaping newline nên không parse; assistant sửa rồi kiểm tra syntax và chạy lại, không sửa source/tests để có kết quả xanh.
Rejected: người dùng yêu cầu bỏ toàn bộ bản dịch local vì muốn giữ bản cũ gọn hơn. Không commit/push/force-push bản dịch hoặc các hồ sơ mới trong lượt bổ sung này.
By hand: phản hồi và quyết định bỏ bản dịch là của người dùng; thao tác hoàn tác, soạn hồ sơ và chạy checks do assistant thực hiện. Chưa có xác nhận human review và chưa ghi nhận phần implementation sinh viên làm tay.

Evidence: [command outputs có thời gian, exit codes và source SHA](verification.json). Lỗi collector/smoke syntax không phải deliberate implementation-only contract break của T10 và không được dùng làm bằng chứng CI chặn merge.

## Bàn giao T11

Vượng tổng hợp entry này vào AI-LOG.md ở root, giữ đủ Tool / Asked for / Kept / Changed / Rejected / By hand và chỉ bổ sung thao tác làm tay đã được người thực hiện xác nhận. Không cần nộp toàn bộ chat hoặc nội dung chứa thông tin nhạy cảm. Các task khác phải ghi entry riêng khi thực sự dùng AI; không suy từ entry T01 rằng toàn milestone đã đủ log.
