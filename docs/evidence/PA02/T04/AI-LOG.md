# AI assistance — T04 — 08/11/2026

Tool: OpenClaw/Codex (GPT-6), shell, npm và tài liệu chính thức.

Asked for: Triển khai phần T04 có thể làm trên nhánh mới, theo quy trình,
đầy đủ evidence/log cho commands, cleanup/isolation và các negative probes.

Kept: AI tạo quality scripts/config, Node discovery wrapper, helper app thật,
support test, README handoff và records command/result cho baseline/negative/clean environment.

Changed: AI đổi lựa chọn ESLint/typescript-eslint sang Oxlint sau peer conflict TS7;
giữ nguyên stack/runtime; format smoke suite/tsconfig chỉ để baseline format xanh.
Thêm guard không tìm thấy files và giữ exit status/signal failure của Node runner.

Rejected: Không ép peer deps, không downgrade TypeScript, không tạo framework,
clock/seed toàn cục, fake publish handler, thêm endpoints hoặc nhận local tests là CI.

By hand: AI thực hiện edits/commands/logs; không ghi nhận code do người dùng viết.
Ngày 08/11/2026, người dùng báo đã chạy lại các bước kiểm tra và tất cả đều pass,
Không có log terminal của lượt
chạy đó được cung cấp; không coi xác nhận này là independent review của Phúc.
