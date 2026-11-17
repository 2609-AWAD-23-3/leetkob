# AI log — PA03-T00

## 2026-11-17 — Sắp xếp cấu trúc LeeTKOB

Tool: Codex.
Asked for: Chạy prompt `codex-prompt-pa03-t00.md` cho T00: đối chiếu plan/rubric, chuyển code và test giữ nguyên hành vi, kiểm tra và chuẩn bị PR vào `develop`.
Kept: Layout một package từ prompt và ba điểm vào API, worker, checker. Codex tạo bản đồ T01–T13/F1–F11, thực hiện các bước `git mv` và chạy kiểm tra; [kết quả](README.md) ghi số test và SHA.
Changed: Giữ RFC 9457 trong cụm auth của API vì code đang gắn với Fastify và Publish; phân loại các bài smoke/lifecycle theo boundary Fastify vào integration, giữ helper riêng. Dùng Node 24.22.1/npm 11.19.1 ở thư mục tạm vì Node mặc định thấp hơn yêu cầu.
Rejected: Không tạo thư mục trống cho các chỗ dự kiến. Giữ nguyên các glob của tsconfig, Oxlint và Prettier vì chúng đã bao phủ cây mới; không siết glob theo các suite đang có. Không chép các thay đổi đang chờ review từ PR #30 vào nhánh T00.
By hand: Vỹ cung cấp prompt và ràng buộc. Các thay đổi, lệnh kiểm tra và bản ghi này trong phiên do Codex thực hiện; chưa có kiểm tra độc lập của reviewer trong phiên local.

## 2026-11-17 — Sửa theo review nội bộ PR #44

Tool: Codex.
Asked for: Vỹ yêu cầu sửa các điểm trong review nội bộ PR #44 và giới hạn công việc ở “chỉ sửa và chạy kiểm tra local, chưa commit/push”.
Kept: Bố cục `commands` và `conventions` từ `073f3d9`. Đối chiếu `SELF_ASSESSMENT_REPORT.md` với base của PR cho thấy chỉ đổi đích link R6 và phần căn cột bảng.
Changed: Làm rõ phụ thuộc của API, worker và checker, đồng thời ghi các điểm chưa chốt về frontend, lỗi RFC 9457 và ADR. Sửa nhãn hai link evidence T03 theo đích hiện tại. Trong bản nháp local của mô tả PR, để trống mục “Ghi nhận của reviewer”, giữ ô “Review độc lập” chưa tick và ghi chú về diff của báo cáo tự chấm.
Rejected: T04 được nêu trong yêu cầu nhưng hai link thực tế nằm ở T03. Chỉnh đúng hai nhãn tại T03, giữ nguyên đích và nội dung evidence.
By hand: Vỹ cung cấp nhận xét review nội bộ và phạm vi sửa. Codex sửa tài liệu và chạy checks local trên worktree tại `073f3d9`. Lint, format-check, type-check, test và diff check đều exit 0 trong lượt sửa review. `npm test` pass 83/83, 0 fail, 0 skip.
