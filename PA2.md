# PA02 — Harness và quality gate

Phạm vi: một endpoint POST /labs/{labId}/publish. T06/T07 deferred, không phải Done. Nguồn: [requirement](docs/reference/PA02/requirement.md), [rubric gốc](docs/reference/PA02/PA%232%20rubric%20%E2%80%94%20Harness%20and%20quality%20gate.pdf).

## Liên kết bắt buộc

| Hạng mục           | Evidence                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository public  | [2609-AWAD-23-3/leetkob](https://github.com/2609-AWAD-23-3/leetkob), xác minh API 11/11/2026                                                                                                                                                |
| Protected main     | [Snapshot cấu hình protection T09](docs/evidence/PA02/T09/verification.json); T11 kiểm tra lại required quality-gate, strict, 1 approval, enforce admins, không force push/deletion                                                         |
| PR bị chặn khi đỏ  | [PR #24 → main](https://github.com/2609-AWAD-23-3/leetkob/pull/24), [run đỏ](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/42994215858), [snapshot BLOCKED và merge bị từ chối](docs/evidence/PA02/T10/verification.json)          |
| Deliberate break   | [934af86e190384eacfb7ce7c6de06e0c6362db59](https://github.com/2609-AWAD-23-3/leetkob/commit/934af86e190384eacfb7ce7c6de06e0c6362db59), chỉ đổi implementation pending gate; assertion 200 !== 409                                           |
| Fix và PR xanh     | [65097bab5deb18fc4aac7706ab139b5f12195a55](https://github.com/2609-AWAD-23-3/leetkob/commit/65097bab5deb18fc4aac7706ab139b5f12195a55), [run xanh](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/42994580687), cùng PR #24 đã merge |
| Contract/tests     | [Contract](docs/contract/publish.md), [publish tests](tests/contract/publish.test.mjs), [auth/error tests gồm 500 internal](tests/auth/publish-auth-errors.test.mjs)                                                                        |
| CI run của tag pa2 | [Danh sách CI runs của tag pa2](https://github.com/2609-AWAD-23-3/leetkob/actions/workflows/ci.yml?query=event%3Apush+branch%3Apa2) — run chạy khi push tag pa2 lên commit nộp.                                                             |

Break/fix giữ nguyên contract/tests, còn trong ancestry của baseline develop b9fcd4c. BLOCKED là snapshot lịch sử từ executor: khi probe, required check và yêu cầu approval đều chưa đạt; không khẳng định đã cô lập riêng từng rào chắn. Review cuối PR #24 là tranquocvy tại head 8808f92; review trước của vinny2707 đã DISMISSED, không dùng nó làm approval cuối.

## Rules, security và chi phí

[Rules](AGENTS.md), [permissions](docs/security/permissions.md), [.env.example](.env.example), [scan/triage](docs/evidence/PA02/T05/security-scan.md) và [model/cost](docs/evidence/PA02/T05/model-cost.md). Spending cap chưa được xác minh; chi phí hiện chỉ là estimate, chưa có số đo thực tế.
