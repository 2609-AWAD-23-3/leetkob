# LeeTKOB — Hướng dẫn cho assistant

## stack

- Backend Node.js 24.x (tối thiểu 24.22.1), npm 11.x, TypeScript strict/ESM, Fastify 5; dùng phiên bản trong package.json và lockfile.

## commands

- Cài: `npm ci --ignore-scripts`; build: `npm run build`; kiểm tra diff: `git diff --check`. PowerShell có thể cần `npm.cmd`.
- Quality checks: `npm run lint`, `npm run format-check`, `npm run type-check`, `npm test`. Đối chiếu package.json của checkout; thiếu script phải báo rõ, không nhận đã chạy.
- Dùng Prettier local theo lockfile và cấu hình repo (`endOfLine: lf`); chạy `npm run format-check` trước khi công bố thay đổi. Lệnh chỉ kiểm tra, không tự sửa; lint/test không thay thế format-check. CI/branch protection phối hợp T04/T09.
- Test nằm trong `tests/unit/`, `tests/contract/`, `tests/integration/` và `tests/e2e/` khi có luồng đầy đủ; helper dùng chung ở `tests/support/`. Giữ discovery đệ quy và chạy cùng quality commands local/CI.

## conventions

- Đọc scope, contract và ownership của task trong docs/plans trước khi sửa; dùng interface dùng chung, không tự mở rộng scope hoặc sửa thay task của người khác.
- Xem [cấu trúc project](docs/architecture/project-structure.md) trước khi thêm file: route/module ở `src/api/`, store ở `src/db/`, cấu hình ở `src/shared/`; entry point `src/api/server.ts`, `src/worker/index.ts`, `src/cli/checker.ts`. Chỉ tạo thư mục dự kiến khi có nội dung thật. Phối hợp với Vượng khi đổi router/app hoặc checker/eval, với Phúc khi đổi workflow.
- `src/pipeline/` dùng chung worker và checker (chạy tắt network) nên không import từ `src/api/` hay `src/db/`; dữ liệu vào qua tham số hoặc interface do worker/checker truyền vào.
- Kiểm tra repo root, branch và git status; bảo toàn thay đổi trước khi chuyển worktree/nhánh. Nguồn: [sự cố sai worktree](docs/evidence/PA02/T05/AI-LOG.md#t05-i01).
- Sửa local không tự bao gồm quyền commit/push hoặc cập nhật PR/issue; cần authorization tương ứng, không hỏi lặp khi đã được cho phép. Nguồn: [sự cố công bố remote](docs/evidence/PA02/T05/AI-LOG.md#t05-i02).
- Dùng fixtures theo instance và clock xác định khi test; ghi command, exit code, source SHA, giới hạn và AI assistance trung thực. Xem [permissions](docs/security/permissions.md).

## never

- Không đưa secrets vào sandbox chạy bài sinh viên, source, fixtures, prompt hoặc output/report.
- Không gọi model thật trong unit tests; dùng fake/stub.
- Không sửa test, eval data hoặc label chỉ để check pass; sửa nguyên nhân lỗi và chỉ đổi kỳ vọng khi yêu cầu/contract thay đổi rõ ràng.
- Không bypass checks, bịa evidence/approval, tự approve PR của mình hoặc ghi đè thay đổi chưa bảo toàn.
