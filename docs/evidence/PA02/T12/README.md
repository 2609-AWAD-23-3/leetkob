# T12 — Kiểm chứng release PA02

Ngày kiểm tra: 11/11/2026. Source baseline: `8d79ba163dca07516369b9ba8f142e51f3181264` trên develop sau merge PR #26.

## Kiểm tra trước release

[Verification](verification.json) ghi runtime, quality commands, Git integrity, protection và phân loại từng finding security. Clone mới từ origin, cài dependencies bằng `npm ci --ignore-scripts`; cả bốn commands README exit 0, 83/83 tests pass, không skipped. `git fsck --full --no-reflogs` exit 0; break/fix commits T10 còn truy xuất được trong history.

Repo public; main required `quality-gate`, strict, một approval và enforce admins. PR #26 đã merge; Vượng (`vinny2707`) APPROVED đúng head `a617518`. Model spending cap vẫn chưa có evidence, đã khai trong README và self-assessment; tổng tự chấm giữ 95/100.

## Security audit

Dùng collector T05 và Gitleaks 8.30.1 với config chính thức được pin. Scan history: exit 1, 29 findings; working tree: exit 1, 4 findings. Scan refs/messages và Git configuration/remotes exit 0; không phát hiện credential URL hoặc inline authorization config.

Triage T05 gốc dừng ở findings ngoài hai manifest hoặc digest lịch sử không khớp source đã format. Kiểm tra riêng toàn bộ 33 findings: 7 cURL headers dùng đúng public fixture có định nghĩa tại `src/auth/identity.ts` trong cùng source revision; 26 SHA-256 entries khớp source tại revision có toàn bộ evidence document tương đương. Có 0 confirmed secrets và 0 unresolved findings trong phạm vi scan. Không đổi rules, ignore hoặc exit code để làm scanner xanh. Các report T05 đã commit giữ nguyên.

Kết quả chỉ áp dụng baseline/ref/config lúc thu; cần đối chiếu lại sau commit release và tại freeze. Scanner không chứng minh spending cap hoặc độ an toàn ngoài phạm vi đã kiểm tra.

## Tag CI và bản nộp

PA2.md giữ URL CI lọc tag pa2 trong commit freeze. Sau khi push tag, T12 đối chiếu remote tag/peeled SHA, run event=push và ref/SHA đúng commit nộp, kiểm tra SUCCESS rồi ghi run permalink tại Issue #12. Không lấy PR run thay tag run và không sửa/force-retag chỉ để chèn run ID vào commit đã freeze.

Tên ZIP theo self-assessment: `23120328-23120409-23120410_95.zip`, có `.git` cùng source/config/reports và history/refs cần kiểm tra; loại dependencies, build output, secrets, assistant memory và backups. Người nộp: Trần Quốc Vỹ (23120410), tài khoản sinh viên tương ứng. Deadline: 22:00 Asia/Bangkok, 11/11/2026. Chưa có tag/run hoặc ZIP/submission được xác minh trong snapshot pre-release này.
