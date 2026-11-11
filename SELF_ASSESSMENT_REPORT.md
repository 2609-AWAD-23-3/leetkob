# Self-assessment — PA02

| StudentID | Thành viên          | GitHub     |
| --------- | ------------------- | ---------- |
| 23120328  | Bửu Huỳnh Vĩnh Phúc | BHVPhuc    |
| 23120409  | Nguyễn Khắc Vượng   | vinny2707  |
| 23120410  | Trần Quốc Vỹ        | tranquocvy |

Người nộp: Trần Quốc Vỹ, 23120410.

## Điểm tự chấm: 95 / 100

| Tiêu chí               |     Max | Tự chấm | Evidence và cơ sở                                                                                                                                                                                                                                                                               |
| ---------------------- | ------: | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 Rules file          |      15 |      15 | [AGENTS.md](AGENTS.md): bốn phần và never theo sản phẩm; [hai incidents/trace](docs/evidence/PA02/T05/AI-LOG.md#t05-i01) đã dẫn trực tiếp từ rules.                                                                                                                                             |
| R2 Permissions/secrets |      10 |       8 | [Permissions](docs/security/permissions.md), [.env.example](.env.example), [scan/triage](docs/evidence/PA02/T05/security-scan.md); có ba mức nhưng [spending cap chưa xác minh](docs/evidence/PA02/T05/model-cost.md), không nhận band 9–10. Scan lịch sử không thay audit freeze T12.          |
| R3 Commands            |      10 |      10 | [README](README.md), [workflow](.github/workflows/ci.yml), [kiểm chứng T11](docs/evidence/PA02/T11/README.md): cùng bốn commands, fresh environment và failures được runner truyền ra.                                                                                                          |
| R4 Blocking CI         |      20 |      19 | [PA2.md](PA2.md): protection live, PR #24 blocked, đỏ/fix xanh; [T10](docs/evidence/PA02/T10/verification.json) ghi cả check/review requirement. Main history sau bật protection đi qua PR #23/#24; chưa có audit log độc lập chứng minh không direct push ở mọi thời điểm.                     |
| R5 Endpoint contract   |      25 |      24 | [Publish contract](docs/contract/publish.md): role/class ownership, field rules, RFC 9457 types/status, repeat safety và versioning. Chưa có kiểm chứng client do người ngoài nhóm xây; runtime mặc định chưa mount publish, demo phải inject dependencies.                                     |
| R6 Contract tests      |      15 |      14 | [Publish tests](tests/contract/publish.test.mjs), [auth/error tests](tests/auth/publish-auth-errors.test.mjs), [deliberate break/fix](PA2.md): errors, ownership, idempotency và required CI. 500 internal được test ở shared HTTP boundary, chưa có case ném lỗi riêng qua route publish thật. |
| R7 AI log              |       5 |       5 | [AI-LOG.md](AI-LOG.md): công cụ/phần việc theo task, Changed/Rejected cụ thể; By hand phân biệt khai báo đầu vào với quan sát của người tổng hợp.                                                                                                                                               |
| **Tổng**               | **100** |  **95** | Tổng điểm tự chấm của nhóm.                                                                                                                                                                                                                                                                     |

Tên file nộp: `23120328-23120409-23120410_95.zip`.

## Những gì chưa làm được

Chưa có bằng chứng spending cap, provider/model triển khai hoặc measured cost/lab; chỉ có estimate tham chiếu. T06/T07 deferred, không claim hoàn thành. Chưa có persistence/distributed concurrency, default publish runtime wiring hoặc tính năng LLM/judge/deployment cuối môn; các tính năng cuối môn nằm ngoài phạm vi PA02.

## Sẽ làm khác đi

Giữ README và metadata đồng bộ ngay khi task được tích hợp; thu evidence cap và chuẩn hóa họ tên trước lượt chốt hồ sơ để không phải bổ sung sát hạn.
