# PA02 — Evidence và đầu vào AI log

Hồ sơ theo task để reviewer kiểm tra và T11 tổng hợp; không phải một checklist acceptance thứ hai. Scope/checklist chính vẫn ở [plan PA02](../../plans/PA02.md). Bản bổ sung hiện chỉ ở local, chưa commit/push.

## Yêu cầu nguồn

- [Requirement](../../reference/PA02/requirement.md): bản nộp có PA2.md, AI-LOG.md và SELF_ASSESSMENT_REPORT.md.
- [Template AI log](../../reference/templates/AI-LOG.md): một entry cho mỗi task có assistant tham gia, ghi trong quá trình làm; một AI-LOG.md ở root cho mỗi milestone. Đây là bản tường trình ngắn, không phải transcript hay toàn bộ log tool.
- [Rubric gốc](../../reference/PA02/PA%232%20rubric%20%E2%80%94%20Harness%20and%20quality%20gate.pdf), trang 3: R7 tối đa 5 điểm, nêu tool/phần việc và Changed/Rejected thực tế. Trang 3–4 yêu cầu links evidence trong PA2.md và evidence từng dòng self-assessment.

Nguồn không bắt buộc một lần push riêng cho mỗi task. Gửi code + evidence + AI entry cùng PR task là quy ước làm việc đề xuất để không dồn việc ghi nhớ đến cuối. Chỉ publish khi được phép; không biến việc lưu log thành quyền tự commit/push.

## Hồ sơ hiện có

| Task | Hồ sơ | AI input | Phạm vi |
| --- | --- | --- | --- |
| T01 | [Evidence](T01/README.md), [outputs](T01/verification.json) | [AI entry](T01/AI-LOG.md) | Candidate skeleton, chưa chấp nhận toàn task |

Chưa tạo hồ sơ rỗng hoặc tự nhận tiến độ các task khác. [AI input planning/workflow trước T01](SETUP-AI-LOG.md) được ghi riêng và cần người làm xác nhận khi đưa vào log cuối; entry T01 không thay cho phần đó.

## Quy ước bàn giao đề xuất

1. Người làm task ghi command, kết quả/exit code, thời gian, source SHA, file/test hoặc PR/run links và giới hạn kiểm chứng; bổ sung AI entry theo template nếu dùng AI.
2. Trước khi gửi review, cập nhật link hồ sơ trong section task của plan và Issue tiếng Anh khi được phép sửa remote; không tự tick review.
3. Khi được phép publish, đưa các đầu vào này cùng PR task. Nếu cần bổ sung sau thì dùng commit tiếp theo, không sửa lịch sử để giả thành log đã ghi từ đầu.
4. T11 do Vượng tổng hợp vào các file root. T09/T10 cung cấp run đỏ, blocked-state, break/fix SHA và run xanh thật; local smoke output không thay thế bằng chứng đó.
5. T12 kiểm tra hồ sơ đã nằm trong commit/tag/ZIP nộp. Các file local chưa commit không đi theo tag hoặc fresh clone.

T11 cần mở hồ sơ từ sớm; dependencies trong plan là điều kiện chốt, không phải lý do chờ cuối kỳ mới ghi AI log. Chưa tạo hoặc sửa bộ root thay executor T11 trong lần bổ sung T01 này.
