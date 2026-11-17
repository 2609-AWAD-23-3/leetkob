# PA03-T00 — Kiểm tra layout

Worktree `leetkob-t00`, nhánh `feat/pa03-t00-skeleton`. Windows/PowerShell với Node `24.22.1`, npm `11.19.1` (dùng `npm.cmd`); runtime đặt ngoài repo. Baseline ngày 17/11/2026 lúc 17:43 ICT, kiểm tra sau di chuyển lúc 17:50 ICT. Mốc kiểm tra sau ở bảng bao gồm toàn bộ thay đổi code, test, cấu hình và hướng dẫn; commit ghi evidence đứng sau mốc này.

- Baseline: `8d79ba163dca07516369b9ba8f142e51f3181264` (`origin/develop`).
- Sau di chuyển: `975dd83b410b766d5329ab5376ef05917b75b721`, chạy với `dist/` mới.

| Lệnh | Baseline | Sau di chuyển |
| --- | --- | --- |
| `npm ci --ignore-scripts` | exit 0 | Dùng lại dependency đã cài; lockfile không đổi |
| `npm run lint` | exit 0 | exit 0 |
| `npm run format-check` | exit 0 | exit 0 |
| `npm run type-check` | exit 0 | exit 0 |
| `npm test` | exit 0, 83/83 pass | exit 0, 83/83 pass |
| `npm run build` | Build nằm trong `npm test` | exit 0 |
| `npm run worker` | Chưa có script | exit 0 |
| `npm run checker` | Chưa có script | exit 0 |
| `git diff --check` và `git diff --check origin/develop...HEAD` | — | exit 0 cho cả hai |

Hai kết quả TAP có cùng 83 tên test, 0 fail, 0 skip, 0 todo. Mỗi commit di chuyển cũng chạy `npm test`, 83/83 pass. So sánh đủ 21 file `src/` và `tests/` có trước T00 cho thấy nội dung giống nhau sau khi áp dụng đúng các đổi đường dẫn (import và đường dẫn chạy listener trong smoke test). Contract suite chỉ đổi ba đường dẫn import. `git diff -M --stat origin/develop...HEAD` cùng `--name-status` nhận ra 19 rename (15 source, 4 test); hai file test còn lại giữ đường dẫn. Kiểm tra 18 link Markdown tương đối mới hoặc đã sửa đều tìm thấy đích.

`git diff --exit-code origin/develop...HEAD -- docs/contract/publish.md package-lock.json leetkob-eval eval-cases docs/plans/archive` exit 0. Các thay đổi dưới `docs/evidence/PA02/` chỉ cập nhật link tương đối gãy do di chuyển file. Các glob source/test trong tsconfig, phạm vi Oxlint/Prettier và lệnh CI đã bao phủ cây mới; bước CI đổi tên hiển thị, giữ check `quality-gate`.

Kết quả trên là kiểm tra local. Cần CI trên PR và review của Phúc để nghiệm thu. Xem [layout](../../../architecture/project-structure.md) và [nhật ký theo task](AI-LOG.md).
