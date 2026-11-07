# Plans — LeeTKOB

## Bản chính và baseline

**PA02 hiện hành:** [PA02.md](PA02.md).

**Theo dõi thực hiện:** [PA02 milestone và task Issues](https://github.com/2609-AWAD-23-3/leetkob/milestone/1); [workflow](../workflow.md) quy định PR/review và điều kiện đóng issue. Các Issue chứa đầy đủ bản tiếng Anh của task/checklist; đồng bộ với plan khi thay đổi scope/trạng thái, không tự nhận hoàn thành từ việc tạo Issue.

Baseline cấu trúc/phân công/checklist của PA02 được ghi nhận ngày 02/11/2026 theo phiên bản đã thống nhất. [Snapshot baseline](archive/PA02-baseline-2026-11-02.md) chỉ dùng đối chiếu; các nguồn tham chiếu được chỉnh đường dẫn theo vị trí lưu mới. Việc ghi nhận baseline không xác nhận các task dự án đã được thực hiện.

| Tài liệu | Vai trò | Trạng thái |
| --- | --- | --- |
| [PROJECT.md](PROJECT.md) | Roadmap toàn project và ranh giới checkpoint | Theo brief; chưa phải kế hoạch chi tiết tất cả PA |
| [PA02.md](PA02.md) | Harness, quality gate, endpoint contract/tests | Plan hiện hành, 12 task và checkbox theo dõi |
| [PA03.md](PA03.md) | Prototype có LLM chạy được | Khung roadmap; cần rubric/requirement riêng |
| [PA04.md](PA04.md) | Eval, guardrails, human gate, red-team | Khung roadmap; cần rubric/requirement riêng |
| [PA05.md](PA05.md) | Final build, deployment, load, observability | Khung roadmap; cần rubric/requirement riêng |

## Cách dùng

1. Xem PROJECT.md để hiểu đầu ra toàn kỳ và việc thuộc checkpoint nào.
2. Làm task tại plan checkpoint hiện hành; người làm cập nhật checklist thực hiện/evidence, reviewer cập nhật checklist review ở chính task đó.
3. Chỉ đổi ô ☐ thành ☑ trong chỉ mục khi task đạt điều kiện và đã review; không đánh dấu theo thời gian hoặc theo việc có file.
4. Quyết định kiến trúc dùng chung ghi ở [architecture](../architecture/overview.md); plan dẫn chiếu quyết định, không tạo nhiều bản thiết kế khác nhau.
5. Khi có rubric checkpoint tiếp theo, đọc nguồn, cập nhật plan theo skill academic-rubric-plan-review; không tự kế thừa trọng số, tag hoặc bộ hồ sơ PA02 sang PA khác.
6. Thay đổi phạm vi/phân công/dependencies phải đồng bộ chỉ mục với task chi tiết; giữ một người thực hiện thật trên mỗi đầu ra.

Không sửa snapshot trong archive. Chỉ giữ snapshot baseline đã thống nhất trong cây docs. Các plan.before-*.md và PLAN-REVIEW.md là bản nháp/review cũ, đã được tách khỏi root và sao lưu ngoài project; không dùng theo dõi tiến độ và không thuộc docs nhóm.
