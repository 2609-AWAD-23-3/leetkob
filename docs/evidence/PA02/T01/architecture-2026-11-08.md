# T01 — Bổ sung kiến trúc runtime/lifecycle và wiring publish

**Ngày:** 08/11/2026, Asia/Bangkok. **Source HEAD:** `738b183aef8e180f8e72ef22edcef3521e65c3c1`, nhánh `feat/t01-architecture-skeleton`. Tài liệu mới là local diff, SHA này không phải commit chứa diff.

## Phạm vi và provenance

- Chỉ sửa [architecture overview](../../../architecture/overview.md) và tạo evidence này; không thay code, contract, tests, manifest hoặc GitHub metadata/settings.
- Giữ nguyên dirty `docs/README.md`, `docs/plans/PA02.md` và các evidence có trước. Không resolve conflict, stage, commit, push, merge hay tag.
- Đọc source app/config/server/publish và smoke suite, data-model stub, AI-log template; đối chiếu scope/workflow/CONTRIBUTING ở worktree `docs/pa02-minimum-scope` tại `0a278b9` và thông tin GitHub trực tiếp.
- `gh issue view 2 --json body,comments`: exit 0; T02 chưa có owner API confirmation/comments. `gh issue view 3 --json comments`: exit 0; đề xuất C còn mở, chỉ giữ phần cần publish.
- `gh pr view 14 --json headRefOid,state,mergeable`: exit 0; head `738b183a`, OPEN, CONFLICTING. Người yêu cầu nói đã kiểm tra/duyệt phần conflict; không suy ra approval của reviewer độc lập cho bản mới hoặc một conflict-resolution diff chưa có.
- Kiểm tra local bằng `git -c safe.directory=D:/Workspace/Web/leetkob status --short --branch` và `worktree list`: exit 0. Ngoại lệ trust chỉ ở từng lệnh cho repo đã được chỉ định; không sửa global config.

## Kiểm chứng và giới hạn

Diff docs-only: kiểm tra whitespace, local Markdown file links và trạng thái source sau sửa; kết quả cụ thể ghi bên dưới sau khi chạy. Không chạy build/tests vì không đổi executable behavior; không dùng kết quả cũ làm lần chạy mới. Không chứng minh wiring, credential transport, concurrency hoặc RFC 9457 đã implement; publish plugin vẫn rỗng.

Kết quả thực chạy: `git diff --check` exit 0; kiểm tra 7 local file links trong overview và evidence này, 0 missing (không kiểm tra anchor hoặc fetch lại mọi URL); `git diff -- src tests package.json package-lock.json` trống, exit 0. `git status --short --branch` exit 0, giữ nguyên các đường dẫn dirty có trước và thêm overview/evidence mới, không có staging. Kiểm tra links/status chạy trong cùng lệnh PowerShell, tổng exit 0. `diff --check` mặc định không bao gồm file evidence untracked; không tuyên bố nó đã kiểm tra file đó.

Không tick checklist T01 hoàn tất hoặc sửa plan/Issue: còn đầu vào T02, review delta và tích hợp. Không claim điểm rubric hoặc CI/protection evidence. Review của Phúc trên candidate cũ vẫn được bảo toàn.

## AI-log input cho T11

Tool: OpenClaw / Codex assistant, không dùng subagent.

Asked for: Liệt kê phần còn chờ người yêu cầu review và hoàn thiện tài liệu runtime/lifecycle/wiring của T01 ở local, chưa commit.

Kept: Fastify/TypeScript skeleton, app factory/listener separation, module seam và ownership A/B/C; review cũ gắn đúng SHA.

Changed: Cập nhật status cũ về publish/review; bổ sung bảng lifecycle, đề xuất typed dependency composition, capability handoffs, request flow, giới hạn và review gates bằng tiếng Việt.

Rejected: Tự implement state/auth/publish, thêm endpoints, coi interface đề xuất là API đã chốt, coi user review conflict là independent approval hoặc quyền commit/merge.

By hand: Người yêu cầu xác nhận đã kiểm tra/duyệt phần conflict trong hội thoại. Không claim người yêu cầu tự viết tài liệu này, hoặc đã review/approve diff mới; không có human acceptance mới được giả định. T11 tổng hợp entry này vào hồ sơ root sau này.

## Cập nhật sau review của người yêu cầu — 08/11/2026

Các đoạn phía trên ghi trạng thái lúc soạn candidate. Sau đó người yêu cầu xác nhận đã review tài liệu local và yêu cầu đồng bộ. Đã cập nhật riêng section T01 của plan, status README/architecture và evidence; giữ nguyên phần local có trước ngoài các cập nhật trạng thái được yêu cầu, không resolve thay hoặc publish. T01 execution local 5/5 là hoàn thành ghi tài liệu/nền skeleton, không phải xác nhận API T02 hoặc merge PR. Phúc đã review hai mục cũ cho 738b183a; delta mới vẫn cần reviewer kiểm tra. Lần audit build/smoke 08/11 được ghi ở README evidence, không sửa kết quả lịch sử verification.json.

Tool: OpenClaw / Codex assistant.

Asked for: Đồng bộ trạng thái sau user review theo Issue T01 hiện tại, giữ T02 cho Vượng và conflict cho người yêu cầu; giải thích lần kiểm tra vừa chạy.

Kept: Code/stack, evidence lịch sử, ownership/reviews theo SHA, các thay đổi local có trước.

Changed: Đồng bộ checklist thực hiện T01 và hai xác nhận review lịch sử, ghi user review mới và audit 08/11; không tự đổi checklist remote.

Rejected: Bắt T01 chờ implementation/API T02 hoàn chỉnh; coi user review là independent approval của Phúc; commit/publish hoặc resolve thay.

By hand: Người yêu cầu xác nhận đã review local, chốt publish và sẽ tự resolve. Việc ghi/sửa docs và chạy audit do assistant thực hiện; không có claim người yêu cầu tự viết code hoặc review thay Phúc.
