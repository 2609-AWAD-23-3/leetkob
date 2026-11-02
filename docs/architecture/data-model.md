# LeeTKOB — Data model

**Trạng thái:** khung tài liệu cho T02 trong [plan PA02](../plans/PA02.md); chưa phải schema, migrations hoặc state machine đã chốt.
**Nguồn:** [class project brief](../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief.pdf).

## Quan hệ đã có từ brief

- Accounts có roles admin, TA, student; TA thuộc các lớp.
- Mỗi lab thuộc một lớp; TA khai báo constraints và deduction.
- Student có submissions; submission Accepted là đầu vào constraint review.
- Review có verdict/evidence theo constraint; TA xử lý queue và publish điểm.
- Student có thể appeal deduction của submission mình sau publish.

Đây là mô hình nghiệp vụ khái niệm, không tự định nghĩa storage schema, ID types, retention hoặc cardinality chi tiết mà brief chưa nêu.

## Nội dung T02 cần chốt

Thực hiện Vượng, reviewer Vỹ theo PA02: entities/IDs/relations tối thiểu; trạng thái và transitions; read/write/reset interfaces; fixtures; guarantees retry/concurrency/persistence theo contracts; limitations và decisions cần FAQ. Ưu tiên dữ liệu đủ cho PA02, không xây toàn schema cuối kỳ trước khi cần.

T01 nhận requirements của mô hình làm đầu vào; chỉ người thực hiện T02 ghi model/store/shared data fixtures. Thay đổi shared schema phải review và chạy tests liên quan theo plan.

Liên quan: [Architecture overview](overview.md), [quyết định kiến trúc](decisions/README.md).
