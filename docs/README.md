# LeeTKOB — Documentation

## Bắt đầu từ đâu?

- [Tài liệu tham chiếu](reference/README.md): đề bài, rubric, requirements và mẫu.
- [Mục lục plans](plans/README.md): plan hiện hành, roadmap và các checkpoint.
- [PA02 — plan thực thi](plans/PA02.md): bản chính để cập nhật task/checklist/evidence.
- [Roadmap toàn project](plans/PROJECT.md): mục tiêu cuối môn, checkpoint boundaries và quyết định còn mở.
- [Architecture overview](architecture/overview.md), [data model](architecture/data-model.md), [architecture decisions](architecture/decisions/README.md).

## Phân loại tài liệu

| Vị trí | Mục đích |
| --- | --- |
| docs/reference/leetkob/ | Brief sản phẩm và bản dịch dùng chung toàn project. |
| docs/reference/PA02/–PA05/ | Requirement/rubric và bản dịch riêng từng checkpoint; chưa có nguồn thì ghi rõ đang chờ. |
| docs/reference/templates/ và examples/ | Mẫu học phần và ví dụ dùng chung, không phải artifact đã hoàn thiện. |
| docs/plans/ | Roadmap và kế hoạch thực thi theo checkpoint; checklist nằm ngay trong task. |
| docs/architecture/ | Kiến trúc dùng chung qua các checkpoint, không nhân bản trong từng plan. |
| docs/architecture/decisions/ | Quyết định kỹ thuật cụ thể kèm lý do và hệ quả, chỉ tạo khi có quyết định. |
| docs/plans/archive/ | Snapshot baseline/lịch sử; không chỉnh task tại đây. |

## Quy tắc cập nhật

- Mỗi checkpoint có một plan chính trong docs/plans/. README tại root là điểm vào; các bản nháp/backup ở root không dùng theo dõi tiến độ.
- Một task có một người trực tiếp thực hiện và một reviewer độc lập. Description/checklist/kết quả/note/evidence ở cùng task; cột Checklist trong chỉ mục chỉ tóm tắt tiến độ đã xác minh.
- PA03–PA05 hiện là khung roadmap theo brief, chưa phải plan thực thi theo rubric riêng. Chỉ bổ sung task/điểm/phân công khi có nguồn và quyết định phù hợp.
- Architecture files hiện là khung ghi quyết định, không phải bằng chứng T01/T02 đã hoàn tất. Chỉ cập nhật checkbox task khi có kết quả và review thật.
- Quy trình lập/review plan dùng skill academic-rubric-plan-review; cải tiến phương pháp được cập nhật vào skill, quyết định riêng của LeeTKOB được lưu ở docs của project.

## Phạm vi lưu trữ hiện tại

Cấu trúc này dùng cho root dự án LeeTKOB, không chỉ riêng checkpoint PA02. Các nguồn mà docs dẫn chiếu nằm trong docs/reference; links tương đối không phụ thuộc folder IA03 hoặc templates ngoài repo. Bản sao templates/examples giữ nội dung nguồn, không phải hồ sơ đã điền hay contract của LeeTKOB.

Repository của nhóm là [2609-AWAD-23-3/leetkob](https://github.com/2609-AWAD-23-3/leetkob), hiện ở chế độ private trong giai đoạn chuẩn bị documentation. Chưa chọn stack hoặc tạo source app. Cần xác nhận quyền chia sẻ tài liệu môn học trước khi public repository. Tài liệu nội bộ agent và bản nháp cũ không thuộc nội dung repo nhóm.

PA2.md ở root repo là hồ sơ evidence nộp bài, khác với docs/plans/PA02.md là kế hoạch. Việc tạo cây docs chưa tạo hồ sơ nộp hoặc hoàn tất quality gate.
