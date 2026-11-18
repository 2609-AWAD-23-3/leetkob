# Đầu vào AI-log — PA03-T01

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 17/11/2026 — Lập plan PA03, quy ước và Issues

**Công cụ (Tool):** Claude Code (desktop app); bộ handoff do Codex trong OpenClaw soạn; GitHub CLI.

**Yêu cầu (Asked for):** đọc rubric PA03, brief, final project, FAQ product owners và dev set; lập plan PA03 vừa đủ rubric, chia task đều theo độ phức tạp; tạo milestone và Issues theo quy ước repo.

**Phần giữ lại (Kept):** cấu trúc plan và Issue của PA02 (plan là bản chuẩn, Issue là bản theo dõi, một người thực hiện và một reviewer khác người); 13 task ban đầu cùng đối chiếu rubric 100 điểm; quyết định Postgres, phân loại constraint theo README dev set, giới hạn sandbox theo FAQ-05.

**Phần điều chỉnh (Changed):**
- Dev set và FAQ được tìm thấy qua Classroom (repo `fithcmus/awad-leetkob-eval`, FAQ của product owners), nên bỏ hai việc "lấy dev set" và "hỏi FAQ" khỏi danh sách quyết định.
- Hash file dev set trên máy Windows không khớp rubric do `core.autocrlf`; kiểm lại bằng nội dung commit (`git show HEAD:<file>`) thì khớp. Thêm `leetkob-eval/** -text` để giữ nguyên byte (thuộc PA03-T10).
- Task ID trùng với PA02 nên đổi sang dạng kèm milestone (`PA03-T01`, nhánh `pa03-tXX`). Đổi tên nhánh trên GitHub làm PR #28 tự đóng; mở lại thành PR #30.
- Quy ước ngôn ngữ đổi theo quyết định của người dùng: tiêu đề Issue/PR tiếng Anh, phần mô tả tiếng Việt.
- Thêm PA03-T00 (dựng lại cấu trúc thư mục) theo phản hồi của nhóm và cân lại tải.

**Phần không chọn (Rejected):** dựng lịch sử PA01 từ bản nháp TaxCat có placeholder; cấu hình checker theo từng bài dev set; Judge0; rate limit, chặn nộp trễ, UI admin quản lý lớp và lấy mẫu 10% pass trong PA03 vì rubric PA03 không chấm; tạo file prediction từ `labels.jsonl` (chỉ dùng để kiểm định dạng `eval.mjs`, không giữ lại).

**Phần làm tay (By hand):** người dùng chốt Postgres, quy ước ngôn ngữ, phân công và yêu cầu thêm T00. Người dùng đăng nhập Classroom để assistant đọc bài đăng dev set.

## 18/11/2026 — Sửa plan theo review của Vượng (PR #30)

**Công cụ (Tool):** Claude Code.

**Yêu cầu (Asked for):** sửa bốn điểm trong review CHANGES_REQUESTED của @vinny2707 tại head `ed1a9c3`.

**Phần giữ lại (Kept):** phân công, dependencies và scope các task không liên quan.

**Phần điều chỉnh (Changed):**
- Publish gate: plan cũ chỉ chặn Publish khi còn `violation`/`unsure` chưa review, hẹp hơn rubric tiêu chí 5 ("refuses while any verdict is unreviewed"). Sửa mục 2 và PA03-T09: mọi verdict, kể cả `pass`, phải được review trước Publish; cho TA xác nhận hàng loạt các `pass`.
- PA03-T13: chi phí lab 80 bài ghi cả trong README và `AI-LOG.md` (tiêu chí 4).
- Ranh giới chung: `npm test` chạy được không cần network, Docker hay Postgres; test cần hạ tầng dùng script riêng trong CI (áp vào PA03-T03 và PA03-T05).
- Số liệu: 14 Issues; ngày công Vượng ~8.5–10.5, Vỹ ~6.5–9.5.

**Phần không chọn (Rejected):** chuyển lấy mẫu 10% pass vào PA03 để thu hẹp số verdict phải review; rubric PA03 chỉ yêu cầu Publish chặn khi còn verdict chưa review, sampling thuộc PA04.

**Phần làm tay (By hand):** Vượng phát hiện bốn điểm và đối chiếu với PDF rubric gốc. Người dùng yêu cầu assistant sửa trực tiếp.
