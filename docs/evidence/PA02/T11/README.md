# T11 — Hồ sơ nộp PA02

Executor: tranquocvy. Reviewer độc lập: vinny2707. Ngày kiểm tra: 11/11/2026.
Baseline source: `b9fcd4c` (develop sau PR #25 đồng bộ main `7881e6c`).

## Nguồn và đầu ra

Đã đọc [requirement gốc](../../../reference/PA02/requirement.md), [rubric PDF](../../../reference/PA02/PA%232%20rubric%20%E2%80%94%20Harness%20and%20quality%20gate.pdf) toàn bộ trang 1–4, [class brief PDF](../../../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief.pdf) toàn bộ trang 1–4; đối chiếu [contract mẫu IA03](../../../reference/examples/IA03-CONTRACT.md), [AI-log template](../../../reference/templates/AI-LOG.md), [self-assessment template](../../../reference/templates/SELF_ASSESSMENT_REPORT-template.md), [Issue #11](https://github.com/2609-AWAD-23-3/leetkob/issues/11).

| Yêu cầu | Artifact / kết quả |
| --- | --- |
| README setup, commands và model/cost | [README root](../../../../README.md); loại claim skeleton/CI cũ, phân biệt npm start với configured publish demo, ghi cap chưa xác minh |
| Links repo/protection/blocked PR/fix/deliberate break/tag CI | [PA2.md](../../../../PA2.md); links lịch sử đã đối chiếu API, tag-run còn T12 |
| Tool/Asked for/Kept/Changed/Rejected/By hand | [AI-LOG root](../../../../AI-LOG.md), tổng hợp setup/scope/T01–T05/T08–T11; không copy transcript hoặc bịa manual authorship |
| Ba thành viên, bảy dòng rubric, evidence/tổng/phần chưa làm | [Self-assessment](../../../../SELF_ASSESSMENT_REPORT.md); trọng số 15/10/10/20/25/15/5, tự chấm 95/100 |

## Kiểm chứng thực thi

Môi trường Windows x64, Node v24.22.1, npm 11.19.1. Clone local sạch bằng `git clone --no-hardlinks --no-checkout`, checkout baseline b9fcd4c, overlay bốn báo cáo root T11 rồi cài từ lockfile; không dùng node_modules của checkout đang sửa. Kết quả áp dụng cho source baseline cùng bốn báo cáo root được kiểm tra.

| Command / probe | Kết quả |
| --- | --- |
| npm ci --ignore-scripts | exit 0, 58 packages; npm audit summary 0 vulnerabilities, không thay secrets audit |
| npm run lint | exit 0 |
| npm run format-check | exit 0 |
| npm run type-check | exit 0 |
| npm test | exit 0, 83/83 pass, fail/skipped/todo đều 0 |
| README JS demo | Cùng imports/store/resolver của block README, thay listen bằng app.inject: initial 200, repeat 200, body không đổi, idempotent-replayed=true; close app đạt. Phạm vi probe: app.inject, không kiểm chứng curl/listen. |
| Break/fix ancestry | `git merge-base --is-ancestor 934af86e HEAD` và `65097bab HEAD`: đều exit 0 |
| Break/fix diffs | `git diff 934af86e^ 934af86e --name-only` và `git diff 934af86e 65097bab --name-only`: chỉ src/modules/publish/index.ts, không đổi contract/tests |

Local commands/README demo do assistant thực hiện. Sau cập nhật metadata, format-check chạy lại exit 0. Các local Markdown targets trong bốn báo cáo, evidence T11 và plan đều trỏ tới file trong repo. Bảy dòng rubric đúng trọng số/tổng 95; 20 AI entries có đủ sáu trường. git diff --check exit 0. Hai link contract/tests sai relative path có sẵn trong plan đã được sửa, không đổi source hoặc tests.

## Đối chiếu GitHub ngày 11/11/2026

- GET repository: public, default main.
- GET branches/main/protection: strict=true, contexts=[quality-gate], 1 approval, dismiss_stale_reviews=true, enforce_admins=true, force push/deletion=false.
- Run 42994215858: pull_request, head 934af86e190384eacfb7ce7c6de06e0c6362db59, failure.
- Run 42994580687: pull_request, head 65097bab5deb18fc4aac7706ab139b5f12195a55, success.
- PR #24 MERGED tại 7881e6caf1d8ad9a10636af262e97372eef769e9. Approval cuối: tranquocvy/head 8808f92; vinny2707/head 70d65c6 đã dismissed.
- PR #20 được vinny2707 APPROVED tại afb30ada. PR #15 CLOSED; contract/implementation hiện hành được tích hợp qua PR #20.
- Không có tag pa2 local sau fetch; `git ls-remote --tags origin refs/tags/pa2` exit 0, không trả ref. Chưa có evidence tag run/ZIP/submission tại thời điểm kiểm tra.
