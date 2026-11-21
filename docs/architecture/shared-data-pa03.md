# PA03-T03 — Dữ liệu dùng chung, `Store` và `Queue`

**Trạng thái:** giai đoạn 1 (kiểu dữ liệu, interface, bản fake in-memory) và giai đoạn 2 (Postgres) đã code, chờ review trong cùng một PR. Người thực hiện: @vinny2707. Reviewer: @BHVPhuc. Issue: [#32](https://github.com/2609-AWAD-23-3/leetkob/issues/32).

Tài liệu này mở rộng [data model PA02](data-model.md) cho pipeline PA03, để PA03-T04, T06, T08, T09 làm song song trên cùng một interface. Code là nguồn chính xác nhất; bảng dưới tóm tắt và ghi lý do.

## 1. Quyết định thiết kế

| # | Quyết định | Lý do |
| --- | --- | --- |
| D1 | Interface mới trả `Promise`. Thao tác publish (cùng ngữ nghĩa và kiểu kết quả của PA02) nằm trong `Store` async qua `PublicationStore`, có trên cả bản fake lẫn Postgres. `PublishStore` PA02 (sync), module route Publish và 83 test cũ **giữ nguyên**; PA03-T09 trỏ route sang `Store` mới khi nối Publish vào queue thật | Postgres là I/O bất đồng bộ. Đổi `PublishStore` PA02 sang async kéo theo sửa route, hàm phân quyền và khoảng 80 lời gọi trong test cũ, trong khi việc nối route là phạm vi của T09 |
| D2 | Giữ cấu trúc chia tầng của T00: kiểu domain ở `src/shared/domain/`, interface và cài đặt ở `src/db/`, cả hai tách file theo domain | `src/pipeline/` không được import `src/api/` hay `src/db/` (AGENTS.md); mỗi task sửa đúng file của mình |
| D3 | Interface tách theo bên dùng; `Store` gộp lại | Mỗi task chỉ phụ thuộc phần mình dùng; test dễ fake |
| D4 | Review queue không phải bảng riêng: là verdict của bài được tính và Accepted, mỗi verdict mang quyết định TA | Không phải đồng bộ hai nơi khi student nộp lại; PA03 đưa mọi verdict vào queue |
| D5 | Nộp bài ghi submission và job trong một bước nguyên tử; `complete` ghi kết quả chấm, verdict và hoàn tất job trong một bước, verdict có unique key `(submissionId, constraintId)` | "Chấm đúng một lần" của T06 khi worker dừng giữa chừng |
| D6 | Không ORM; giai đoạn 2 dùng `pg` và migration SQL | Plan loại ORM tổng quát khỏi PA03 |
| D7 | ID theo `^[a-zA-Z0-9_-]{1,64}$` do store sinh (`crypto.randomUUID()`), thời gian ISO 8601 UTC | Giữ quy ước của contract publish v1 |
| D8 | Store nhận `clock` và `idGenerator` inject được | Test xác định (AGENTS.md) |

## 2. Quyết định nghiệp vụ theo FAQ

| Điểm | Quyết định | Nguồn |
| --- | --- | --- |
| Mức trừ | `0 < deduction ≤ 10` trên thang 10, do TA đặt; model không bao giờ đặt | FAQ-06, FAQ-11 |
| Bài được tính | Bài cuối có `submittedAt` trong khoảng `opensAt ≤ t < deadline`, bất kể kết quả. Hai adapter chụp clock ngay khi gọi `submit`, trước khi chờ readiness/connection hoặc I/O; không lấy thời điểm từ client và không đổi sang giờ INSERT. Nộp đúng lúc deadline là trễ; trước hạn là bản tạm tính | FAQ-02, FAQ-03 |
| Bài không Accepted | Không soát, không verdict, không vào queue, không chặn Publish; `complete` từ chối verdict cho kết quả khác `AC` | FAQ-04 |
| Giới hạn chạy | Lab có `limits` (CPU 1000–5000 ms, mặc định 1000; memory 64–512 MB, mặc định 256); giới hạn cố định là hằng số `FIXED_JUDGE_LIMITS` | FAQ-05 |
| Kết quả chấm | `AC`/`WA`/`TLE`/`MLE`/`RE`/`CE`, kèm verdict từng test; không lưu output để trả cho student | FAQ-02 |
| `unsure` | `unsureCause`: `model_unsure`, `schema_error`, `evidence_mismatch`, `timeout`, `cost_cap`; `reason` là giải thích nếu có | FAQ-09 |
| Quyết định TA | Đổi được trước Publish; mỗi lần đổi quyết định, evidence hoặc người review đều ghi nhật ký (ai, lúc nào, cũ, mới, evidence), lặp lại y hệt thì không ghi. Người review phải là user có thật; evidence phải đúng dạng. `decide` nhận `evidence` để PA04 bắt buộc khi chọn `violation`. Khóa sau Publish làm ở giai đoạn 2 | FAQ-09, FAQ-10, FAQ-12 |
| Verdict của bài AC | `complete` bắt **đủ một verdict hợp lệ cho mỗi constraint**; lỗi model hay timeout thì pipeline (T07/T08) ghi `unsure` với `unsureCause` tương ứng chứ không bỏ trống. Verdict sai dạng hoặc trùng cặp trong cùng lần gọi bị từ chối (`TypeError`), không ghi gì | FAQ-09 |
| Pending | Mục queue chưa có quyết định TA, cộng bài được tính chưa chấm xong (`queued`, `judging`, `failed`); phòng hờ, cặp (bài AC, constraint) chưa có verdict cũng tính là pending. Publish chờ toàn bộ pipeline | FAQ-12 |
| Lease | Mỗi lần `claim` tạo một `leaseToken` mới; `extendLease`, `complete`, `fail` phải đưa đúng token đó (không dùng `workerId`), nên công việc còn sót của một lần claim cũ, kể cả cùng worker, không đụng được lease hiện tại | T06 |
| Lỗi hệ thống | `claim` và `fail` đều nhận `maxAttempts`. Job đã dùng hết lượt (kể cả khi worker crash liên tục và không gọi `fail`) bị kết thúc ở lần `claim` sau, submission thành `failed`; `requeue` chấm lại với lượt thử mới | FAQ-03 |
| Ba mốc của lab | `Lab.opensAt` → `deadline` → Publish. TA có thể đặt `opensAt` khi tạo lab; không đặt thì lab mở ngay lúc tạo (`opensAt = createdAt`). `opensAt` phải trước `deadline`. `labPhase(lab, now)` trả `draft` / `open` / `closed`: API dùng để ẩn lab `draft` với sinh viên và chỉ nhận bài khi `open` | FAQ-03, FAQ-06, FAQ-07 |
| Sửa constraint, mẫu 10% `pass` | Ngoài PA03 (không có API sửa constraint; mọi verdict vào queue). Khi có API sửa constraint: lab `draft` sửa tự do, lab `open` chỉ được giảm mức trừ, xóa hoặc sửa câu chữ (FAQ-07) | FAQ-07, FAQ-10 |
| Field lạ | Lab, `limits`, test, constraint, verdict, evidence và kết quả chấm phải có đúng các field đã định nghĩa; có field lạ thì `TypeError`, store chỉ chép field đã biết | Đồng bộ fake và Postgres |

## 3. File và bên dùng

```text
src/shared/domain/
  users.ts          Role, User, ClassRoom, ClassMembership
  labs.ts           Constraint, TestCase, Lab, LabLimits, NewLab, LabPhase, labPhase; MAX_SCORE,
                    DEFAULT_LAB_LIMITS, LAB_LIMIT_RANGES, FIXED_JUDGE_LIMITS
  submissions.ts    SubmissionStatus, JudgeVerdict, TestResult, JudgeResult, Submission, Job
  verdicts.ts       VerdictValue, TaDecision, VerdictSource, UnsureCause, Evidence,
                    ConstraintVerdict, NewConstraintVerdict, ReviewItem,
                    ReviewDecisionLog, ModelCallOutcome, ModelCallLog, NewModelCallLog
src/shared/verdict-schema.ts   MODEL_VERDICT_SCHEMA, ModelVerdictItem,
                               ParseModelVerdictsResult, parseModelVerdicts
src/db/
  auth-store.ts       AuthStore          T04
  lab-store.ts        LabStore           T04, T09
  submission-store.ts SubmissionStore    T04, T06, T11
  job-queue.ts        JobQueue           T06
  verdict-store.ts    VerdictStore       T08, T11
  review-store.ts     ReviewStore        T09
  publication-store.ts PublicationStore T09 (publish trên Store async)
  store.ts            Store gộp tất cả + close()
  validation.ts       kiểm tra đầu vào dùng chung cho mọi bản cài đặt, để bản fake
                      từ chối đúng những giá trị Postgres (CHECK, enum, FK) sẽ từ chối
  in-memory/          bản fake: createInMemoryStore({ seed?, clock?, idGenerator? }) → { store, reset }
                      seed.ts: createStoreSeed() cho test
  postgres/           createPostgresStore({ connectionString, schema?, seed?, clock?, idGenerator? })
                      → { store, ready, reset }; migrations.ts, client.ts (pool, transaction, migrate),
                      một file mỗi domain
docker/compose.postgres.yml   Postgres 17 local, cổng 127.0.0.1:5433
scripts/db-migrate.mjs        npm run db:migrate (DATABASE_URL)
scripts/test-db.mjs           npm run test:db (TEST_DATABASE_URL)
```

`src/db/index.ts` export thêm các tên mới và giữ nguyên export PA02.

| Interface | Hàm |
| --- | --- |
| `AuthStore` | `findUserByUsername`, `getUser`, `createSession`, `getSessionUser`, `deleteSession`, `getMembership`, `listMemberships` |
| `LabStore` | `createLab`, `getLab`, `listLabsForUser` |
| `SubmissionStore` | `submit`, `getSubmission`, `listSubmissions`, `listCountedSubmissions`, `requeue` |
| `JobQueue` | `claim`, `extendLease`, `complete`, `fail` |
| `VerdictStore` | `listVerdicts`, `recordModelCall`, `listModelCalls` |
| `ReviewStore` | `listReviewQueue`, `getReviewItem`, `getReviewState`, `decide`, `confirmPasses`, `listDecisionLog` |
| `PublicationStore` | `isTaAssignedToClass`, `getPublication`, `publishLab` |

Store không kiểm tra quyền. API (T04, T09) xác định principal và kiểm tra role/membership trước khi gọi store. Kiểm tra giai đoạn của lab cũng ở API: dùng `labPhase` để ẩn lab `draft` với sinh viên và chỉ nhận bài khi lab `open` (từ chối trước `opensAt` và từ `deadline`); kích thước code (64 KB) kiểm ở API. Session chỉ lưu hash của token, không lưu token gốc.

## 4. JSON schema verdict của model

`MODEL_VERDICT_SCHEMA` trong `src/shared/verdict-schema.ts`: object chỉ có `verdicts`, mỗi phần tử có đúng `constraintId`, `verdict` (`pass`/`violation`/`unsure`), `evidence` (`[{ line ≥ 1, text }]`) và `reason` (string hoặc null). Không có trường điểm trừ; `additionalProperties: false` khiến output có thêm trường như `deduction` bị coi là sai schema.

`parseModelVerdicts(value, constraintIds)` kiểm schema và các luật schema không diễn tả được: mỗi constraint được hỏi có đúng một verdict, không có constraint lạ, `violation` có ít nhất một dòng evidence. Lỗi thì T08 ghi `unsure` với `unsureCause: 'schema_error'`. Dòng evidence của model tính trên code đã bỏ comment; T08 map về dòng gốc và đối chiếu nội dung (sai thì `evidence_mismatch`).

## 5. Giai đoạn 2: Postgres

- **Chạy local:** `docker compose -f docker/compose.postgres.yml up -d --wait`, rồi `DATABASE_URL=postgres://leetkob:leetkob_local@127.0.0.1:5433/leetkob npm run db:migrate`. Mật khẩu trong file Compose chỉ dùng cho máy local, cổng chỉ mở ở `127.0.0.1`; deployment (PA03-T12) đặt thông tin kết nối riêng qua env của server.
- **Migration:** `src/db/postgres/migrations.ts` (`0001_init`, `0002_model_call_metrics`), mỗi migration chạy một lần trong transaction và ghi vào `schema_migrations`; không sửa migration đã merge, chỉ thêm migration mới. Advisory lock trong transaction bảo vệ cả bước tạo schema và bảng metadata lần đầu; sau đó khóa bảng metadata để tuần tự hóa từng migration. CHECK và khóa ngoại khớp `src/db/validation.ts`.
- **Bảng:** `users`, `classes`, `class_memberships`, `sessions`, `labs` (CHECK `opens_at < deadline`, khoảng giới hạn FAQ-05), `lab_tests`, `lab_constraints` (CHECK `0 < deduction ≤ 10`), `submissions`, `jobs`, `verdicts` (unique `(submission_id, constraint_id)`), `review_decisions`, `model_calls`, `publications` (khóa chính `lab_id`).
- **Thời gian** ghi từ clock của store, không dùng `now()` của database, để test xác định.
- **Transaction:** nộp bài ghi submission và job cùng lúc; `claim` dùng `FOR UPDATE SKIP LOCKED`; `extendLease`, `complete`, `fail` kiểm hạn lease bằng clock sau khi lấy khóa job, `complete` kiểm lại sau khi chờ khóa submission và trước khi ghi. `decide`, `confirmPasses` và `publishLab` đều **khóa dòng lab trước** rồi mới đọc hoặc ghi, nên review không thể ghi sau khi Publish đã đọc quyết định (và ngược lại), nhiều request Publish đồng thời chỉ tạo một publication. `getReviewState` tính mọi count trong **một SQL statement**, cùng snapshot, để worker hoàn tất giữa các lần đọc không làm bỏ sót pending.
- **Validation:** hai adapter kiểm metrics trước khi lưu: token và latency là số nguyên trong `[0, 2147483647]`, chi phí hữu hạn và không âm; migration `0002_model_call_metrics` thêm CHECK tương ứng vào database đã có. Seed phải tham chiếu người tạo lab tồn tại; seed/reset sai không thay state cũ.
- **Test:** `tests/integration/postgres-store.test.mjs` chạy lại toàn bộ `tests/support/store-conformance.mjs` trên Postgres (mỗi test một schema riêng, xóa khi xong) và thêm các test riêng: dữ liệu còn sau khi đóng rồi mở lại store; một **process riêng** claim job rồi chết giữa chừng, hết lease thì store mới trong process test lấy lại và chỉ lưu một bộ verdict (ghép worker thật thuộc T06); `decide` và `confirmPasses` phải chờ Publish đang giữ khóa lab và thấy lab đã công bố; nhiều worker claim đồng thời lấy job khác nhau; Publish đồng thời chỉ tạo một publication; worker hoàn tất xen giữa lúc Publish đọc; khởi tạo schema/migration đồng thời; nâng cấp từ `0001_init` giữ dữ liệu; lease hết hạn trong lúc chờ connection hoặc khóa; database từ chối metrics âm hoặc không hữu hạn. Không có `TEST_DATABASE_URL` thì file tự skip, nên `npm test` không cần Postgres. `npm run test:db` báo lỗi nếu thiếu biến này. CI có job `postgres-store` riêng với service Postgres 17; job `quality-gate` giữ nguyên.
- **Ranh giới nghiệm thu:** thao tác publish trên `Store` async đã chạy trên Postgres, nhưng **endpoint HTTP Publish chưa dùng Postgres**: route vẫn dùng store in-memory PA02 cho tới khi T09 trỏ sang `Store` mới.
- **Contract Publish v1 không đổi.** Route Publish vẫn dùng store in-memory PA02 nên đoạn "Storage and concurrency bounds" trong `docs/contract/publish.md` vẫn đúng; T09 cập nhật đoạn này kèm rationale khi trỏ route sang `Store` mới.

## 6. Câu hỏi mở cho reviewer

1. Phúc (T06): `claim`/`extendLease`/`complete`/`fail` đã đủ cho worker chưa? Lease và `maxAttempts` do worker truyền vào; worker nên dùng cùng một `maxAttempts` cho `claim` và `fail`. Phúc (CI): job `postgres-store` mới trong `.github/workflows/ci.yml`.
2. Vỹ (T08): một call cho nhiều constraint semantic hay mỗi constraint một call? `parseModelVerdicts` và `ModelCallLog.constraintIds` hỗ trợ cả hai.
3. T04: token đăng nhập ngẫu nhiên, store lưu SHA-256 và hạn 12 giờ? API tạo lab nhận `opensAt` tùy chọn; API danh sách lab và nộp bài phải dùng `labPhase`.
4. T09: trỏ route Publish sang `Store` (`PublicationStore`), chuyển hàm phân quyền sang async và cập nhật đoạn storage của contract v1.
