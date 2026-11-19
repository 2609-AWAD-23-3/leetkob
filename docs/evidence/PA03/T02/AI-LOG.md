# Đầu vào AI-log — PA03-T02

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 18–19/11/2026 — Chọn host, dựng VPS, chọn model và ghi quyết định

**Công cụ (Tool):** Claude Code (desktop app), SSH, Azure Portal và Cloud Shell, Claude Console.

**Yêu cầu (Asked for):** so sánh host và model cho T02; hướng dẫn tạo VM; cài Docker, tạo user `deploy`, thêm SSH key của Phúc và Vỹ; viết ADR, evidence và mở PR.

**Phần giữ lại (Kept):** VPS Linux có Docker theo gợi ý của plan, không dùng PaaS; size 2 vCPU, 4 GB; Ubuntu 24.04 để có cgroup v2; Claude Haiku 5.5 gọi trực tiếp Claude API; spend limit theo workspace cộng Auto-reload tắt làm hard cap.

**Phần điều chỉnh (Changed):**
- Assistant đề xuất Hetzner hoặc Azure for Students; thẻ của Vượng bị từ chối nên chọn Azure for Students và để Vỹ thanh toán model.
- East Asia và Southeast Asia bị policy của subscription chặn (`RequestDisallowedByAzure`); tra assignment "Allowed resource deployment regions" rồi chọn Indonesia Central.
- Lệnh `ssh-keygen -f ~/.ssh/...` do assistant đưa thất bại trên PowerShell 5.1 vì `~` không được mở rộng cho chương trình ngoài; đổi sang `$HOME`.
- Assistant đề xuất hạ limit organization từ $500 xuống thấp hơn và thêm cảnh báo; Vượng đặt $10 và cảnh báo $4.
- Ảnh billing được cắt bỏ địa chỉ và thông tin thẻ; ảnh spend limits được assistant cắt bỏ tab trình duyệt và URL; ảnh API key được assistant che email và phần hiển thị của key.
- Plan dự kiến Vỹ tạo key; Vượng có role Admin nên tự tạo key rồi chuyển riêng cho Vỹ giữ.

**Phần không chọn (Rejected):** PaaS vì không có Docker daemon cho sandbox; Google Cloud và Hetzner vì cần thẻ; DeepSeek V4.1 Flash vì đắt hơn khoảng 2.5 lần và dữ liệu gửi ra ngoài; OpenRouter vì thêm trung gian; model free tier vì rate limit và có thể dùng dữ liệu để huấn luyện.

**Phần làm tay (By hand):** Vượng tạo VM trên Azure Portal, chọn region và size, chạy Cloud Shell để xem policy và Public IP, chỉnh limit organization trên Claude Console, tạo API key `leetkob-key` trong workspace `leetkob` (lựa chọn "Somewhere else", key không qua assistant) và chụp ảnh. Vỹ tạo organization, nạp $5, tạo workspace `leetkob` và limit workspace. Phúc và Vỹ gửi SSH public key. Assistant chạy các lệnh cài Docker, tạo `deploy`, thêm key và kiểm tra qua SSH; soạn ADR, evidence và PR.
