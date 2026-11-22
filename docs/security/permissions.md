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

- API đọc HOST/PORT và yêu cầu DATABASE_URL. Các npm command dev/start/db:migrate/db:seed load `.env` tùy chọn tại root bằng Node CLI; biến môi trường có sẵn được ưu tiên. Tests không tự load file này. Xem [contract auth](../contract/auth.md) và [runbook T04](../evidence/PA03/T04/README.md).
- `.env.example` chứa các default local công khai khớp Compose; `.env` là file private bị Git ignore. Không đưa URL triển khai hoặc password triển khai vào file tracked.
- Auth dùng session PostgreSQL, raw Bearer token chỉ trả khi login; production không dùng fixture identity. Publish PA02 giữ boundary cũ để T09 tích hợp.
- Bộ seed dev trong `src/db/seeds/demo-accounts.ts` dùng credential công khai `password123` cho tài khoản hư cấu. `db:seed` có thể đặt lại password và thu hồi session của đúng tài khoản demo khớp ID/username/role; không áp dụng cho user thật. Credential VPS/admin thật phải cấp riêng, không dùng seed dev.
- Limiter theo tiến trình, trustProxy false; cần cấu hình proxy và limiter dùng chung trước khi scale nhiều instance.
- `npm run db:studio` đọc `.env` qua Node CLI và mở Prisma Studio local trên cổng 5555 để xem/sửa DB dev. Thay đổi trên giao diện ghi trực tiếp vào database; Studio không đi qua phân quyền API và không dành cho public deployment. Cấu hình chỉ lấy DATABASE_URL từ env, không đưa URL chứa credential vào command arguments.
- .gitignore không xóa secrets đã tracked hoặc lịch sử; evidence chỉ áp dụng cho snapshot được ghi rõ.
