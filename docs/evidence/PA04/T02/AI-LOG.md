# AI log — PA04-T02

## 2026-11-27 — G5: không lấy mức trừ từ model

Tool: Claude Code (desktop app).
Asked for: Vượng giao T02 theo plan PA04 và Issue #55: đọc yêu cầu và hiện trạng code, chốt G2 dùng evidence dạng `{line, text}`, rồi làm từng guardrail theo thứ tự G5, G1, G2, G3; mỗi guardrail dừng lại cho Vượng review rồi mới commit, vì rubric chấm "mỗi guardrail và test trong commit riêng, test không muộn hơn code".
Kept: Theo quyết định G5 trong plan PA04: schema gửi qua `output_config.format` giữ `additionalProperties: false`; chỉ bước kiểm phía nhóm (`parseModelOutput`) đổi từ đòi đúng bộ key (`hasExactKeys`) sang chỉ đòi đủ field bắt buộc (`hasRequiredKeys`), nên field lạ như `deduction` bị bỏ qua và verdict được giữ. Thiếu field hoặc sai kiểu vẫn là `schema_error` (G1).
Changed: Test viết và chạy trước code: 4 test đỏ (3 test G5 và nhánh e2e có `deduction: 0`), sau khi sửa code 74/74 xanh. Ba trường hợp test PA03 đòi field lạ thành `schema_error` được thay bằng test G5, vì yêu cầu đã đổi theo plan, không phải để test xanh. Thêm nhánh e2e: model trả `deduction: 0` và lời dặn chấm điểm, review item vẫn hiện mức trừ TA đặt.
Rejected: Giữ kiểm chặt và chấp nhận `schema_error` (làm bài đúng thành `unsure`, đẩy unsure rate lên ở tiêu chí 2); bỏ `additionalProperties: false` khỏi schema gửi model (structured output cần nó).
By hand: Vượng chốt thứ tự làm và cách review từng guardrail. Claude viết test, sửa `schema.ts`, chạy: lint, format-check, type-check, `git diff --check` exit 0; `npm test` 571 test, 568 pass, 3 skipped.

## 2026-11-27 — G5 sau review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review G5 (chưa commit): comment của `parseModelOutput` trỏ tới bảng quy tắc PA03-T08 đã lỗi thời (dòng 73: field thừa là `schema_error`); chưa có evidence G5 (lý do bỏ 3 test cũ, kết quả thử xoá guardrail); lưu ý G2 phải đọc phần tử evidence bằng `hasRequiredKeys`; lời dặn chấm điểm trong `reason` vẫn hiện cho TA (không bắt buộc).
Kept: Không sửa evidence PA03 (lịch sử). Ghi trong evidence T02 rằng G5 thay dòng 73 của T08. Giữ nguyên chữ `reason`, ghi là giới hạn đã biết.
Changed: Comment của `parseModelOutput` trỏ sang evidence PA03-T08 và PA04-T02. Thêm mục G5 trong README evidence. Chạy lại hai lần thử xoá guardrail đúng như Vượng mô tả: quay về kiểm field chặt thì 4 test đỏ; chép field lạ vào kết quả thô thì không test nào đỏ, vì kết quả đã parse được dựng theo tên field.
Rejected: Thêm test cho trường hợp "chép field lạ vào kết quả thô" (hành vi do cấu trúc code bảo đảm, test sẽ chỉ kiểm lại cách dựng object); lược lời dặn chấm điểm khỏi `reason` trong G5 (ngoài yêu cầu rubric).
By hand: Vượng tìm ra các điểm trên khi review. Claude sửa comment, viết evidence, chạy lại kiểm xoá guardrail và quality checks.
