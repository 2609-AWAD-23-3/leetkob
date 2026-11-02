# LeeTKOB — Architecture overview

**Trạng thái:** khung tài liệu cho T01 trong [plan PA02](../plans/PA02.md); chưa phải architecture chi tiết đã chốt hoặc bằng chứng T01 hoàn tất.
**Nguồn:** [class project brief](../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief.pdf).

## Định hướng ban đầu

Một backend chia module là đề xuất hiện tại để giảm thành phần vận hành. PA02 chia submissions, review-queue, publish; module boundaries không đồng nghĩa ba microservices. Stack/runtime/persistence/queue chưa chốt.

## Luồng sản phẩm theo brief

TA tạo lab/constraints → student submit → queue/judge trong sandbox → Accepted → hard rules → model cho semantic constraints còn lại → schema/evidence guards → TA review queue → TA publish → appeals.

Luồng trên là đích toàn project, không phải pipeline đã có ở PA02. Checklist triển khai từng phần nằm trong các [checkpoint plans](../plans/README.md).

## Ranh giới bắt buộc cần thể hiện trong thiết kế

- Auth/role/ownership và quan hệ class/lab nhất quán; không tin user tự khai role.
- Sandbox chạy code không tin cậy phải được isolation theo minimums của brief, không nhận model key/secrets.
- Model chỉ trả verdict/evidence, không tự quyết deduction hoặc publish.
- Test fixtures của PA02 tách khỏi việc chứng minh queue/judge/model pipeline hoạt động thật.
- Contract/errors/commands và CI gate dùng chung, tránh mỗi module tạo một cách riêng.

## Nội dung T01 cần chốt vào tài liệu này

Thực hiện Vỹ, reviewer Phúc theo PA02: repo root và stack/runtime; module responsibilities và dependency direction; app lifecycle/config/route registration; identity/data/test boundaries; thành phần nào PA02 có thật, phần nào defer; lý do và hệ quả lựa chọn. Yêu cầu data/security từ các task khác là đầu vào, không phải nhiều người cùng ghi baseline.

Liên quan: [Data model](data-model.md), [quyết định kiến trúc](decisions/README.md). Chưa tạo quyết định chấp thuận khi nhóm chưa chốt.
