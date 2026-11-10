# T05 — Sự cố thật và quy tắc rút ra

Nguồn là công việc T02 và trao đổi thực tế của người yêu cầu trong phiên làm việc này. Đây là tóm tắt bổ sung sau sự kiện, không phải raw chat, không nhận là phát hiện tự động trong Git. Người dùng đã đồng ý nội dung tường trình và khai báo công việc ngày 11/11/2026; xác nhận này không thay review độc lập của Vỹ. Không có sự cố secret thật nào được suy ra từ hai tình huống này.

<a id="t05-i01"></a>

## T05-I01 — Công việc nằm ở worktree không đúng repo được chỉ định

- **Ngày ghi nhận:** 09/11/2026, khi tiếp nối T02.
- **Thực tế:** người yêu cầu chỉ định repo ổ D:, nhưng nhánh feat/t02-publish-state và 60 dòng kế hoạch chưa commit đang ở worktree ổ C:. Người dùng yêu cầu bảo toàn rồi chuyển về đúng repo.
- **Xử lý đã làm:** kiểm tra cả hai worktree, sao lưu file và đối chiếu SHA-256; giải phóng nhánh khỏi worktree C: tại cùng commit rồi checkout nhánh và khôi phục bản kế hoạch vào repo D:. Không tạo nhánh trùng hoặc xóa worktree để giải quyết tình huống.
- **Nguồn truy vết:** [AI-log T02](../T02/AI-LOG.md) ghi yêu cầu bảo toàn/chuyển về D:; [thiết kế T02](../../../architecture/data-model.md) phát triển từ kế hoạch đó. Chi tiết backup là bằng chứng thao tác local trong phiên, không được nhận là artifact đã commit hoặc scan history.
- **Rule rút ra:** kiểm tra repo root, branch và working tree trước khi sửa; bảo toàn local changes trước khi chuyển worktree/nhánh.
- **Rule được áp dụng tại:** [AGENTS.md — conventions](../../../../AGENTS.md#conventions).

<a id="t05-i02"></a>

## T05-I02 — Người dùng chưa muốn công bố remote nhưng assistant đã push/mở PR

- **Ngày ghi nhận:** trong chuỗi công việc T02 ngày 09/11/2026.
- **Thực tế:** assistant hiểu yêu cầu triển khai plan là bao gồm commit/push, cập nhật issue và mở PR #18. Người dùng hỏi lại khi biết đã push; assistant thừa nhận đã đi quá kỳ vọng kiểm soát từng bước của người dùng. Không diễn giải đây là sự cố credential hoặc bypass protection.
- **Nguồn truy vết:** [PR #18](https://github.com/2609-AWAD-23-3/leetkob/pull/18), các commit implementation/evidence 94d9e22, 4a33130, fe8cd0a; [AI-log T05](AI-LOG.md) ghi lại phản hồi người dùng và rule mới. Phản hồi nằm trong phiên hội thoại, không giả nhận có GitHub comment chứa toàn bộ sự kiện.
- **Điều chỉnh sau đó:** khi người dùng yêu cầu dịch tài liệu, assistant giữ thay đổi local; chỉ push bản dịch tại a499efc sau khi người dùng yêu cầu rõ. Không coi quyền push T02 là quyền push mọi task về sau.
- **Rule rút ra:** tách quyền sửa local khỏi quyền commit/push/cập nhật remote; nếu chưa có authorization tương ứng thì hỏi trước, không hỏi lặp khi đã cho rõ.
- **Rule được áp dụng tại:** [AGENTS.md — conventions](../../../../AGENTS.md#conventions), [permissions](../../../security/permissions.md).

Hai rule trên là thay đổi xuất phát từ sự cố thực tế, không phải deliberate break T10 và không tạo tác động phá hoại mới để lấy điểm. Bản tổng hợp T11 cần giữ đúng nguồn gốc AI assistance và phản hồi người dùng.
