# PA03 — Prototype với tính năng LLM hoạt động

Nhóm 2609-AWAD-23-3: Bửu Huỳnh Vĩnh Phúc (23120328), Nguyễn Khắc Vượng (23120409), Trần Quốc Vỹ (23120410). Repository public: [2609-AWAD-23-3/leetkob](https://github.com/2609-AWAD-23-3/leetkob), commit nộp gắn tag `pa3`.

Nguồn: [requirement](docs/reference/PA03/requirement.md), [rubric gốc](docs/reference/PA03/PA%233%20rubric%20%E2%80%94%20Prototype%20with%20the%20LLM%20feature%20running.pdf), [plan](docs/plans/PA03.md), [tự chấm](SELF_ASSESSMENT_REPORT.md), [AI-LOG](AI-LOG.md).

## 1. Deployment

| Hạng mục       | Giá trị                                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL            | `https://app.flytest.io.vn`                                                                                                                                                                                                  |
| Health         | `GET https://app.flytest.io.vn/health` → `200 {"status":"ok"}`                                                                                                                                                               |
| Giao diện      | Sản phẩm PA03 là API, dùng trực tiếp qua Swagger UI tại `https://app.flytest.io.vn/docs/` (OpenAPI JSON tại `/docs/json`).                                                                                                   |
| Hạ tầng        | VM Azure `70.153.86.114` (Ubuntu 24.04), Docker Compose `postgres`, `api`, `worker`, `caddy`; chỉ Caddy mở `80`/`443`. Chi tiết: [evidence T12](docs/evidence/PA03/T12/README.md), [runbook](docs/deploy/pa03-runbook.md).   |
| Model          | `claude-haiku-5-5` (Anthropic), key chỉ nằm trong `deploy/.env` trên server, không vào sandbox ([ADR 0001](docs/architecture/decisions/0001-host-model-and-spending-cap.md)).                                                |
| Spending cap   | Workspace `leetkob` $5/tháng, organization $10/tháng (cảnh báo $4), Auto-reload tắt: hết credit thì API dừng. Đã tính tới việc ai đọc repo cũng dùng được tài khoản test ([evidence T02](docs/evidence/PA03/T02/README.md)). |
| Thời gian chạy | Giữ chạy từ hạn nộp tới khi có điểm PA04.                                                                                                                                                                                    |

## 2. Tài khoản test

Năm tài khoản chỉ có dữ liệu giả, tạo bằng `scripts/seed-deploy.mjs` (không dùng seed dev `password123`, seed dev bị chặn trên production).

| Username       | Role    | Lớp           | Password                           |
| -------------- | ------- | ------------- | ---------------------------------- |
| `pa3.admin`    | admin   | —             | `pa3-adm-7523228f33682ce4145301e4` |
| `pa3.ta1`      | TA      | `pa3-class-1` | `pa3-ta1-302ffb51435a381943e6e781` |
| `pa3.ta2`      | TA      | `pa3-class-2` | `pa3-ta2-55500ecdb44e14879ab22e32` |
| `pa3.student1` | student | `pa3-class-1` | `pa3-st1-3d8d5a768a1d850ddd16c6f2` |
| `pa3.student2` | student | `pa3-class-1` | `pa3-st2-2f61eb7ec8d0fb8c38c87a26` |

Hai sinh viên cùng lớp với TA thứ nhất; `pa3.ta2` là TA của lớp khác.

## 3. Đi qua tiêu chí 1 bằng API

Mọi bước gọi qua Swagger UI hoặc HTTP. Login bằng `POST /auth/login` với `{ "username", "password" }`, dán `accessToken` vào **Authorize** (không thêm `Bearer`).

1. `pa3.ta1` tạo lab `sort-merge`: `POST /classes/pa3-class-1/labs` với header `Idempotency-Key` là một UUID v4 mới, body gồm `title`, `statement`, `tests`, `constraints` (`{ id, text, deduction }`), `deadline` ở tương lai. Có thể upload `tests`/`constraints` bằng file JSON (multipart). Contract: [labs](docs/contract/labs.md).
2. `pa3.student1` và `pa3.student2` nộp bài: `POST /labs/{labId}/submissions` (JSON `code` hoặc một file `.cpp`, `Idempotency-Key` mới mỗi lần nộp). Bài ở trạng thái `queued`; worker chấm trong sandbox rồi chuyển `judged`. Student xem kết quả chấm test ở `GET /submissions/{id}` hoặc `GET /labs/{labId}/submissions/mine`, không thấy verdict (FAQ-08). Contract: [submissions](docs/contract/submissions.md).
3. `pa3.ta1` mở `GET /labs/{labId}/review-queue`: mỗi bài được tính × constraint có verdict (`pass`/`violation`/`unsure`), nguồn (`hard_rule`/`model`), dòng evidence và mức trừ của lab; chi tiết code ở `GET /review-items/{itemId}`. Contract: [review queue](docs/contract/review-queue.md).
4. `pa3.ta2` gọi `GET /labs/{labId}` và `/labs/{labId}/review-queue` của lab trên: `404`. Student và admin gọi review queue: `403`.
5. `POST /labs/{labId}/publish` trả `409` khi còn verdict chưa review, kể cả `pass` ([publish](docs/contract/publish.md)).

Lần chạy kiểm chứng trên deployment: [evidence T12](docs/evidence/PA03/T12/README.md) (lab `3962d1dc-1236-422e-befd-e6bccfb03809`, ba request id của provider) và lượt kiểm độc lập 48/48 của reviewer trên [PR #82](https://github.com/2609-AWAD-23-3/leetkob/pull/82). Các lab kiểm chứng này vẫn còn trên deployment, chưa review và chưa Publish.

## 4. CI run của tag `pa3`

- [CI runs của tag `pa3`](https://github.com/2609-AWAD-23-3/leetkob/actions/workflows/ci.yml?query=event%3Apush+branch%3Apa3): run chạy khi push tag lên commit nộp, gồm ba job `quality-gate`, `postgres-store` và `sandbox-attacks`.
- Job `sandbox-attacks` chạy `npm run test:sandbox`: 9 bài tấn công trong [`sandbox/attacks/`](sandbox/attacks/) (M1–M9) cùng các ca hồi quy, compile và run đều trong sandbox. Suite: [`tests/sandbox/sandbox-attacks.mjs`](tests/sandbox/sandbox-attacks.mjs); kết quả từng minimum: [evidence T05](docs/evidence/PA03/T05/README.md).
- Job `postgres-store` gồm test dừng worker → nộp → khởi động lại → đúng một bộ verdict ([`tests/integration/worker-postgres.test.mjs`](tests/integration/worker-postgres.test.mjs), [evidence T06](docs/evidence/PA03/T06/README.md)).

## 5. Lệnh checker, Docker build và model-off

Checker chỉ đọc `problems/*/statement.md`, `problems/*/constraints.json` và `solutions/*/*.cpp`. Chi tiết và cách chạy trên PowerShell: [README](README.md#checker-và-eval-pa03-t10).

```sh
docker build -f docker/checker.Dockerfile -t leetkob-checker .
docker run --rm --network none -e MODEL_OFF=1 -v "$PWD/leetkob-eval:/data:ro" leetkob-checker /data > predictions.jsonl
node leetkob-eval/eval.mjs --data leetkob-eval --predictions predictions.jsonl
```

- `MODEL_OFF=1`: chỉ chạy hard rules, ghi `unsure` cho mọi constraint semantic, không tạo model client, không mở network.
- Kết quả model-off của nhóm trên dev set: 0 khấu trừ sai, mọi cặp ban-list được hard rules quyết, `eval.mjs` exit 1 vì recall/unsure khi tắt model ([`docs/evidence/PA03/T10/model-off/`](docs/evidence/PA03/T10/model-off/)).
- Dev set trong `leetkob-eval/` nguyên byte từ commit `552c811` (`eval.mjs` `c836edd8713521bb…`, `labels.jsonl` `262cda7b0ef5612e…`; `npm test` so SHA-256 từng file). Case riêng của nhóm: [`eval-cases/`](eval-cases/) (6 solution, 12 cặp, có `trap` và `injection`).

## 6. Dev-set run với model thật

Thư mục: [`docs/evidence/PA03/T10/dev-run/`](docs/evidence/PA03/T10/dev-run/) gồm `predictions.jsonl` (checker tạo), `eval-report.txt` và `eval-summary.json` (báo cáo `eval.mjs`), `call-log.jsonl` (quyết định từng cặp và 39 model call có request id `req_…`, model, token, thời gian, chi phí, prompt đã gửi).

| Wrongful deductions | Recall       | Unsure rate | Call | Chi phí   |
| ------------------- | ------------ | ----------- | ---: | --------- |
| 1                   | 100% (37/37) | 0% (0/102)  |   39 | $0.009157 |

Chấm lại `predictions.jsonl` đã commit bằng `eval.mjs` ra đúng ba số này. Khấu trừ sai duy nhất là một constraint semantic của bài `reverse-words`; nhóm không chỉnh prompt hay rule theo dev set. Model và chi phí một lab 80 bài: [README](README.md#model-và-chi-phí).

## 7. Video

Video quay màn hình luồng tiêu chí 1 trên deployment: https://youtu.be/dr_ny5GNwGc (Phúc quay; đủ 6 bước: TA `pa3.ta1` tạo lab `sort-merge` với 7 test và `C1`/`C2`, student nộp `s01`/`s04`/`s09`, `queued` → `judged`, review queue có verdict, dòng evidence và mức trừ, `pa3.ta2` bị `404`). Video dài 6:19, vượt mức 5 phút của đề; nhóm tự trừ điểm cho việc này trong [SELF_ASSESSMENT_REPORT.md](SELF_ASSESSMENT_REPORT.md).
