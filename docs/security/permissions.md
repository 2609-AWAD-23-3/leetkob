# T05 — Quyền hạn của assistant

**Thực hiện:** Vượng (vinny2707). **Review độc lập:** Vỹ (tranquocvy).
Nguồn: [T05 trong plan PA02](../plans/PA02.md#t05--rules-permissions-v%C3%A0-secrets), [rubric](../reference/PA02/PA%232%20rubric%20%E2%80%94%20Harness%20and%20quality%20gate_vn.md).
Assistant đọc [AGENTS.md](../../AGENTS.md) ở root; tài liệu này bổ sung ba mức quyền.

## allowed — Được làm trong task đã được giao

- Đọc/search source, tài liệu và issue/PR liên quan; kiểm tra repo root, branch, diff và trạng thái Git.
- Sửa file local đúng phạm vi task đã được người dùng cho phép; giữ nguyên công việc khác.
- Chạy build/tests/checks hiện có, kiểm tra links và scan secrets chỉ đọc. Lưu dữ liệu scan đã redacted; không in secret.
- Fetch refs phục vụ kiểm tra; tạo checkout cô lập khi cần review mà không đổi branch/source đang làm.
- Dùng công cụ tạm phục vụ kiểm chứng trong phạm vi đã được cho phép, có nguồn/phiên bản/checksum; không cài global hoặc sửa PATH lâu dài.
- Quyền đã được người dùng cho rõ tiếp tục có hiệu lực trong phạm vi đó; không yêu cầu xác nhận lặp lại.

## ask first — Cần được cho phép trước nếu chưa có authorization tương ứng

- Commit, push, tạo/cập nhật PR/issue, gửi comment/review, request reviewer, merge, tag/release hoặc đóng issue. Yêu cầu sửa local không tự bao gồm công bố lên remote. Approve/merge là hành động riêng với comment kỹ thuật.
- Thay đổi ownership, phạm vi task, dependency/manifest/lockfile, app wiring hoặc shared runner thuộc người khác.
- Cài công cụ hệ thống/global, đổi cấu hình Git/máy, settings/visibility/protection của repo hoặc cấu hình sandbox.
- Gọi provider thật, sử dụng API key, đổi spending cap, mua dịch vụ hoặc hành động có thể phát sinh chi phí.
- Xóa/di chuyển dữ liệu, thay nhánh khi có local changes, rewrite history hoặc revoke/rotate credential. Chuẩn bị phương án bảo toàn và mô tả đúng tác động trước khi xin phép.

## never — Không được làm

- Gửi secrets sang model, đưa secrets vào sandbox chạy code sinh viên, commit/log/report hoặc in raw credential ra terminal.
- Gọi model thật trong unit tests; đổi tests/eval/labels chỉ để xanh; giấu failed exit hoặc bịa evidence/incident/chi phí.
- Tự nhận người khác đã review, tự approve PR của mình, tự tick review checklist hoặc hoàn tất task khi thiếu acceptance.
- Bypass auth/protection, direct-push/force-push main/develop, ghi đè thay đổi người dùng hoặc chạy phá hoại để đủ rubric.

## Chính sách và enforcement

Đây là quy tắc hành vi, không phải cấu hình tự động chặn lệnh. Sandbox/approval do môi trường cung cấp; không được suy ra rằng ba mức trên đã được máy cưỡng chế chỉ vì có tài liệu này. CI/protection thuộc T09 và cần evidence riêng.

Trạng thái triển khai và kết quả kiểm chứng được ghi tại [hồ sơ T05](../evidence/PA02/T05/README.md). Quyền thực hiện hành động áp dụng theo authorization của người dùng cho task; không suy ra quyền công bố remote từ trạng thái tài liệu.

## Environment hiện tại

- [.env.example](../../.env.example) chỉ liệt kê HOST và PORT đang được code đọc; giá trị trống, không có credential.
- App không tự load .env. Nếu không đặt hai biến, code dùng 127.0.0.1:3000; nếu truyền chuỗi rỗng thì config từ chối. Không source/copy giá trị trống của example vào process env để chạy app.
- Đối chiếu baseline 09245d7: config runtime vẫn chỉ đọc HOST/PORT. T03 nhận bảng token và identity resolver bằng cấu hình trong code, chưa có biến môi trường model/provider/auth credential. Khi implementation thay đổi, đối chiếu lại source rồi cập nhật example; không thêm biến giả rồi nhận là đã hỗ trợ.
- .gitignore ngăn các file local phổ biến, nhưng không xóa file đã tracked hoặc secret trong lịch sử. Luôn cần scan history trước khi bàn giao.
