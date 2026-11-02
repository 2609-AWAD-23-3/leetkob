# LeeTKOB — Roadmap toàn project

**Nguồn:** [class project brief](../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief.pdf), mục 3–7.
**Trạng thái:** roadmap theo brief, không tự bổ sung trọng số hoặc acceptance criteria của rubric tương lai.

## Mục tiêu cuối môn

Xây dựng hệ thống hỗ trợ TA kiểm tra constraints trên submissions C++ Accepted trước khi công bố điểm: hard rules chạy trước, model chỉ đánh giá semantic constraints, output/evidence được kiểm chứng và TA giữ quyền quyết định/publish. Hệ thống có accounts/roles, submission/judging queue và sandbox, review queue, publishing/appeals, eval gates, load evidence và public deployment theo brief.

## Các checkpoint

Các hạn dưới đây theo brief năm 2026, đều 22:00 trừ seminar/oral là các buổi theo lịch lớp.

| Mốc | Hạn / lịch | Đầu ra trọng tâm | Plan |
| --- | --- | --- | --- |
| PA02 | 11/11/2026 | Rules/permissions, checks, blocking CI và một endpoint contract/tests | [PA02](PA02.md) |
| PA03 | 25/11/2026 | TA tạo lab/constraints; submit → sandbox qua queue → Accepted → hard rules/model → review queue | [PA03](PA03.md) |
| PA04 | 02/12/2026 | Dev-set eval gate, guardrails, human gate và red-team report | [PA04](PA04.md) |
| PA05 | 16/12/2026 | Publishing/appeals, real-time, observability, 80-submission load test, public deployment, incident post-mortem | [PA05](PA05.md) |
| Seminar | 10/12 và 17/12 | Chủ đề optimisation theo lịch lớp | Bổ sung khi có brief riêng |
| PA06 | 24/12 và 31/12 | Oral cá nhân về code và quyết định của nhóm | Bổ sung khi có hướng dẫn riêng |

## Bất biến xuyên checkpoint

- Model không chọn deduction; TA khai báo deduction. Human gate theo brief: violation, unsure và 10% pass ngẫu nhiên vào review queue; publish phải qua TA.
- Hard rule quyết định constraint thì không gọi model cho constraint đó; schema/evidence line/timeout guards và cap/lab theo brief.
- Sandbox không network, giới hạn CPU/wall time/memory/process/output, non-root, không host mounts/Docker socket, không secrets. Có attack tests chứng minh khi triển khai sandbox.
- Ngưỡng eval của brief: zero wrongful deductions, violations caught ≥90%, unsure ≤20%; không biến các ngưỡng thành bằng chứng đã đạt.
- Không secrets trong Git history; không model calls thật trong unit tests; không sửa tests/eval/labels chỉ để pass.

## Những quyết định còn mở

Repo code, stack/runtime, persistence, queue, sandbox/provider cụ thể, deployment và model/cost configuration được chốt theo nhu cầu checkpoint và ghi trong [architecture](../architecture/overview.md). Không triển khai toàn bộ hạ tầng chỉ để chuẩn bị PA02.

A/B/C và ba modules hiện là phân công PA02 trong PA02.md; không mặc định giữ nguyên toàn bộ phân công đó cho mọi checkpoint. Chỉ PA02 đã có rubric trong bộ tài liệu hiện dùng.
