# PA03-T04 — Bằng chứng triển khai và kiểm chứng

Tài liệu này tập hợp kết quả của cả ba giai đoạn: xác thực và tài khoản mẫu; tạo/xem lab; tiếp nhận/xem bài nộp. Các hướng dẫn chạy bên dưới mô tả phiên bản hiện tại. Số liệu cũ được giữ trong phần lịch sử, không thay thế kết quả kiểm chứng mới nhất.

## 1. Phạm vi, mã nguồn và trạng thái

- Nhánh: `feat/pa03-t04-auth-lab-submissions`.
- Giai đoạn 1 được triển khai từ mã nguồn gốc `f37b5b314dd9b1bc2150efd4e1019943f139e37c`, sau đó có commit `9812a520b48d85f0f9ac1c30e482b51d43d64e94`.
- Giai đoạn 2–3 được kiểm chứng trên các thay đổi **chưa commit** tiếp nối `9812a520b48d85f0f9ac1c30e482b51d43d64e94`. Không gán kết quả này cho một SHA triển khai mới.
- Môi trường kiểm chứng: Windows/PowerShell, Node v24.22.3, npm 11.19.1, PostgreSQL 17 qua Docker Compose local. Ngày ghi nhận mới nhất: **22/11/2026**, múi giờ Asia/Bangkok.
- Đã có API xác thực, tạo/xem lab và tiếp nhận/xem bài nộp. Runtime dùng PostgreSQL; kiểm thử mặc định dùng fake qua cùng interface.
- **T04 chưa hoàn thành toàn bộ:** còn tích hợp T06 để xác nhận luồng nộp → chấm → kết quả thật và review độc lập của Vỹ. Publish runtime thuộc T09.

Nguồn contract: [xác thực](../../../contract/auth.md), [lab](../../../contract/labs.md), [bài nộp](../../../contract/submissions.md).

Khai báo sử dụng AI: [AI-log T04 gồm sáu mục](AI-LOG.md).

## 2. Hướng dẫn chạy phiên bản hiện tại

Yêu cầu Node 24.x từ 24.22.1 và npm 11.x. Chạy từ root repository:

```powershell
npm.cmd ci --ignore-scripts
# Chỉ cần nếu Docker Desktop chưa chạy:
docker desktop start --detach
docker compose -f docker/compose.postgres.yml up -d --wait
# Chỉ copy lần đầu nếu chưa có .env:
# Copy-Item .env.example .env
npm.cmd run db:migrate
# Chỉ khi cần tạo/cập nhật tài khoản mẫu dev:
npm.cmd run db:seed
npm.cmd run build
npm.cmd start
```

`npm run dev` chạy chế độ theo dõi mã nguồn. Sau khi thay `.env`, cần khởi động lại backend. Các lệnh dev/start/db:migrate/db:seed đọc `.env` tùy chọn tại root bằng Node CLI; biến môi trường đã đặt được ưu tiên. Chạy trực tiếp `node dist/api/server.js` không tự đọc `.env` nếu thiếu cờ tương ứng. Tests không đọc `.env`; suite database cần `TEST_DATABASE_URL` riêng.

API yêu cầu `DATABASE_URL`, đợi khởi tạo Store và migrations xong mới listen, đóng kết nối khi dừng hoặc khởi động lỗi; không tự chuyển sang fake/fixture tokens khi database lỗi. Runtime tự áp dụng migration còn thiếu, nên `db:migrate` là bước kiểm tra tường minh, không cần chạy lại thủ công trước mọi lần start. API không tự seed và không cần seed lại để có route mới. `/health` chỉ phản ánh tiến trình còn hoạt động, không phải phép kiểm tra database trực tiếp.

Migrations nằm trong `src/db/migrations/`, mỗi migration có file riêng và đăng ký theo thứ tự trong `index.ts`. Việc tách thư mục giữ nguyên ID/SQL cũ, không làm database chạy lại migration đã áp dụng. Mã seed ở `src/db/seeds/demo-accounts.ts`; `scripts/seed-demo.mjs` là lối vào CLI. Các fixture fake T03 chỉ dành cho test, không dùng làm tài khoản đăng nhập runtime.

### Tài khoản mẫu và chính sách seed dev

Mật khẩu chung hiện tại là **`password123`**, dữ liệu dev công khai. Vẫn băm bằng scrypt với salt riêng trước khi lưu. Tài khoản tự đăng ký giữ yêu cầu password riêng: 15–128 Unicode code point.

| Nhóm tài khoản | Membership |
| --- | --- |
| `admin.vuong`, `admin.phuc`, `admin.vy` | Không tự có membership lớp |
| `ta01`–`ta05` / `ta06`–`ta10` | Lớp 1 / lớp 2 |
| `student001`–`student060` | Cả hai lớp |
| `student061`–`student080` | Chỉ lớp 1 |
| `student081`–`student100` | Chỉ lớp 2 |

Tổng cộng **113 tài khoản, 2 lớp và 170 membership**; mỗi lớp có 80 student và 5 TA. Không seed lab, bài nộp hoặc kết quả chấm.

`db:seed` chạy migration rồi thêm dữ liệu còn thiếu trong transaction. Với tài khoản demo khớp ID/username/role, password khác sẽ được đặt lại về password dev và thu hồi session của tài khoản đó; nếu password đã khớp thì giữ hash/session. Dữ liệu không thuộc bộ seed được giữ nguyên; xung đột ID/username/role làm rollback. Đây không phải cơ chế cấp tài khoản thật trên VPS; T12 phải có cấu hình/credential triển khai riêng.

Không cần bước `--init` hoặc file JSON private ở phiên bản hiện tại. File cũ `.local/seed-accounts.json`, nếu còn, đã lỗi thời: CLI không đọc và không tự xóa file này.

### Swagger và giao diện database

- API docs: `http://127.0.0.1:3000/docs/`, đổi cổng theo cấu hình hoặc dùng link trong startup log. OpenAPI JSON tại `/docs/json`; chỉ mô tả các route thực sự được mount.
- Bấm **Try it out** để gọi API. Sau login, copy `accessToken` vào **Authorize**, không thêm `Bearer`. Khi đổi tài khoản, dùng Logout trong hộp Authorize rồi nhập token mới. Swagger dùng origin hiện tại, phục vụ tài nguyên UI local và không giữ authorization sau khi tải lại trang.
- Xem/sửa dữ liệu bằng `npm.cmd run db:studio`, mở `http://localhost:5555`; PostgreSQL và `.env` phải sẵn sàng, backend có thể dừng. Studio dùng Prisma CLI dev để đọc schema hiện có, không thay quyền quản lý migration, không sinh Prisma Client/seed/tables. Thao tác sửa ghi trực tiếp vào database dev. Dừng bằng Ctrl+C; có thể đổi cổng với `-- --port 5556`.

<a id="phase-1"></a>

## 3. Giai đoạn 1 — Xác thực và tài khoản mẫu

### Phần đã triển khai

- Đăng ký student, login bằng password thật, session phía server, `/auth/me` và logout phiên hiện tại. Student mới đăng ký chưa có membership.
- Runtime dùng PostgreSQL, không dùng fixture tokens; không thêm JWT, cookie hoặc refresh token.
- Seed 113 tài khoản và chính sách password dev như phần trên; không bổ sung email/MSSV trong giai đoạn này. Đối chiếu [FAQ-01](https://github.com/tkob-team/LeeTKOB-FAQ/blob/main/FAQ.md#faq-01): không bắt buộc dùng email/MSSV làm định danh đăng nhập; yêu cầu bỏ định danh trước khi đưa code tới model không đồng nghĩa phải lưu các trường đó trên tài khoản.
- Migration 0003 tạo ràng buộc username sau chuẩn hóa mà không sửa migration 0001/0002. Nếu dữ liệu cũ xung đột thì dừng, yêu cầu xử lý tường minh; không tự đổi tên/xóa tài khoản.
- Thêm `.env` tùy chọn qua Node CLI, Swagger với ví dụ tài khoản nhất quán và link docs trong startup log.
- Thêm Prisma Studio chỉ cho môi trường dev. Phiên bản đã pin: Swagger 9.9.5, Swagger UI 6.1.5, Prisma 7.10.1; override Effect 3.22.1 cho `@prisma/config` vì bản upstream khi đó bị ảnh hưởng bởi [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw). Các lần cài dùng `--ignore-scripts`; lần audit được ghi nhận khi cài không báo lỗ hổng đã biết, không phải cam kết cho tương lai.

### Sửa lỗi sau review

Đã sửa ba lỗi tái hiện được: lỗi kết nối pool đang rảnh có thể làm tiến trình thoát vì sự kiện không được xử lý; password chứa surrogate đơn bị đổi thành cùng byte thay thế khi mã hóa UTF-8; tên hiển thị chứa NUL được fake nhận nhưng PostgreSQL trả lỗi. Đã thêm xử lý lỗi pool có che chi tiết, từ chối Unicode lỗi ở biên HTTP/dịch vụ password và dùng chung validation tên hiển thị. Tiếng Việt/emoji hợp lệ vẫn được hỗ trợ.

Kiểm thử dùng tiến trình con để xác minh mất kết nối idle không làm API chết và có thể kết nối lại; chỉ ngắt backend PostgreSQL của chính phép kiểm tra. Có kiểm thử Unicode ở fake/PG và luồng signup/login PostgreSQL thật.

**Giới hạn đã được người dùng chấp nhận:** một login đã xác minh password cũ trước khi seed dev đồng thời đặt lại password có thể tạo session sau bước thu hồi của seed. Chưa sửa race này; chưa có API reset password công khai. Phải xem lại tính nguyên tử khi phát triển API đó.

### Bằng chứng và lịch sử kiểm chứng — 21/11/2026

| Mốc kiểm chứng | Lệnh/phép kiểm tra | Mã thoát | Kết quả ghi nhận |
| --- | --- | --- | --- |
| Sau bổ sung Swagger ban đầu | `npm test` | 0 | 171 đạt, 1 suite PostgreSQL bỏ qua |
| Database giai đoạn đầu | `TEST_DATABASE_URL=<database local dành cho kiểm thử>; npm run test:db` | 0 | 74/74 đạt: auth thật, seed đồng thời, migration username và hồi quy T03 |
| Ví dụ Swagger và link startup | `npm test` | 0 | 172 đạt, 1 suite bỏ qua; probe xác nhận link docs theo cổng và địa chỉ listen thực tế |
| Công cụ Studio | `npm run db:studio` và kiểm tra trình duyệt | 0 | Đọc được bảng và hai lớp demo tại thời điểm kiểm tra; không sửa hàng dữ liệu |
| Sau ba bản sửa review | `npm test` | 0 | 175 đạt, 1 suite PostgreSQL bỏ qua |
| Sau ba bản sửa review | `TEST_DATABASE_URL=<database local dành cho kiểm thử>; npm run test:db` | 0 | 77/77 đạt, gồm mất kết nối idle và dữ liệu văn bản không hợp lệ |
| Các mốc chốt trên | lint, format-check, type-check, diff-check | 0 | Các kiểm tra tương ứng đều đạt |

Các probe bổ sung đã xác nhận `.env` được đọc khi child process không có DATABASE_URL; db:migrate/db:seed/start và loader dev hoạt động. Đăng nhập admin/TA/student, membership hiện tại, logout và từ chối token bị thu hồi đã được kiểm tra qua HTTP. Tài khoản đăng ký được lưu bền vững.

**Lịch sử seed, không phải hướng dẫn hiện tại:** phiên bản trước từng dùng `db:seed -- --init` tạo file password private, rồi seed lần đầu thêm 113 tài khoản; chạy lại bỏ qua 113. Kiểm tra không ghi đè file cũ đạt (assertion thoát 0, subprocess seed bị từ chối thoát 1, digest không đổi). Sau khi người dùng đổi chính sách sang password công khai, lần seed chuyển đổi cập nhật 113 password, không thêm tài khoản; HTTP login/me/logout đã đạt với password dev. Các kết quả này thuộc thời điểm chuyển đổi, không hứa rằng mọi lần seed hiện tại đều cập nhật 113 tài khoản.

Ở bước Swagger ban đầu, chỉ kiểm tra HTML/tài nguyên/spec và HTTP bằng chương trình, chưa kiểm tra trực quan UI. Sau đó có kiểm tra Studio qua trình duyệt. Các lượt UI cho lab/bài nộp được ghi riêng bên dưới. Không suy ra trạng thái tiến trình Studio hiện tại từ một lần kiểm chứng cũ.

<a id="phase-2"></a>

## 4. Giai đoạn 2 — Tạo và xem lab

### Phần đã triển khai

- Ba API tạo lab, danh sách lab theo lớp và chi tiết theo role; session bất đồng bộ, danh tính lấy từ server và membership hiện tại.
- TA tạo lab trong lớp phụ trách. Student không thấy draft; vẫn xem được open/closed. DTO student không có test/createdBy/dữ liệu review; danh sách chỉ đọc metadata, sắp xếp ổn định.
- Nhập JSON trực tiếp hoặc một trường JSON `lab` cùng file `testsFile`/`constraintsFile`; mỗi nhóm chỉ có một nguồn, thứ tự part không ảnh hưởng.
- UTF-8 strict/BOM, kiểm tra Unicode/NUL, bảo toàn nội dung chuỗi; giới hạn tổng body 20 MiB, đề 256 KiB, tổng test đã giải mã 16 MiB và các giới hạn trong contract. Bộ đếm áp dụng cả multipart framing và chunked request.
- Idempotency UUID v4 theo TA/lớp, fingerprint ổn định, TTL 24 giờ; cùng nội dung trả lại lab cũ, khác nội dung trả 409, replay kiểm tra lại quyền và vẫn hợp lệ sau deadline nếu key còn hạn.
- Fake và PostgreSQL cùng hành vi; advisory lock và transaction ghi lab/tests/constraints/key; migration 0004 và reset fixtures. Không sửa SQL/ID của migration cũ.

### Kiểm tra qua Swagger

1. Login `ta01`, Authorize, POST `/classes/{classId}/labs` với `demo-class-1`. Dùng JSON mẫu, deadline tương lai và UUID v4 mới (`[guid]::NewGuid().ToString()`). Kỳ vọng 201 và Location.
2. Execute lại cùng key/payload: cùng ID, `Idempotent-Replayed: true`; đổi payload nhưng giữ key: 409.
3. Chọn multipart: dán [lab-metadata.json](../../../examples/labs/lab-metadata.json) vào ô `lab`, chọn [tests.json](../../../examples/labs/tests.json) và [constraints.json](../../../examples/labs/constraints.json). Dùng key mới. File mẫu là dữ liệu stdin/stdout cho C++, không phải mã nguồn từ dev set.
4. Nếu không chọn một file, **bỏ tick Send empty value** của file đó và cung cấp nhóm tương ứng trong JSON `lab`.
5. Login `student001`: chi tiết không có tests/createdBy/review, danh sách chỉ có metadata; draft bị ẩn. Login `ta06`: truy cập lab/lớp 1 trả 404. Student/admin tạo lab trả 403; thiếu token trả 401.

Đã quan sát các bước JSON tạo 201, replay cùng ID/header, upload cả hai file tạo 201, student đọc 200 với DTO đúng và TA lớp khác nhận 404 qua trình duyệt với PostgreSQL thật. Server/schema tạm đã dọn; không sửa schema ứng dụng. Ảnh cục bộ: `.local/t04-phase2-student.jpg`.

Kiểm tra UI phát hiện khai báo encoding `text/plain` cho trường `lab` khiến Swagger gửi thành file/Blob. Đã bỏ khai báo đó, thêm assertion hồi quy cho OpenAPI và xác nhận upload lại thành công. Kiểm tra stream gốc cũng chặn UTF-8 lỗi trước khi busboy có thể thay byte bằng ký tự thay thế.

### Kết quả kiểm chứng — 22/11/2026

| Lệnh/phép kiểm tra | Mã thoát | Kết quả |
| --- | --- | --- |
| `npm install --save-exact @fastify/multipart@10.1.9 --ignore-scripts` | 0 | Pin multipart/busboy; audit khi cài không báo lỗ hổng; lockfile chỉ thêm phần liên quan |
| `npm run lint` | 0 | Không lỗi/cảnh báo |
| `npm run format-check` | 0 | Đạt Prettier theo lockfile |
| `npm run type-check` | 0 | Đạt TypeScript strict |
| `npm test` | 0 | 192 đạt, 1 suite PostgreSQL bỏ qua khi không có TEST_DATABASE_URL |
| `TEST_DATABASE_URL=<database local dành cho kiểm thử>; npm run test:db` | 0 | 81/81 đạt |
| `node --test tests/unit/lab-creation.test.mjs tests/integration/labs-upload.test.mjs` | 0 | 8/8 đạt: các biên dung lượng và UTF-8 của trường multipart |
| `TEST_DATABASE_URL=<database local dành cho kiểm thử>; node --test --test-reporter=tap --test-name-pattern='upgrading an existing initial schema' tests/integration/postgres-store.test.mjs` | 0 | 1/1 đạt sau bổ sung so sánh nguyên hàng lab/test/constraint trước và sau nâng cấp |
| `git diff --check` | 0 | Không lỗi whitespace |

Lượt database 81/81 có trước lần tăng assertion bảo toàn nguyên hàng; sau đó đã chạy riêng test nâng cấp 1/1, không đổi mã database. Lượt mặc định 192 đạt có cả kiểm tra quyền trước parser và phân biệt lỗi database với lỗi validation.

Phạm vi kiểm thử: quyền/DTO, mốc opensAt/deadline, JSON/file tương đương, đảo part, thiếu/trùng nguồn, dữ liệu lỗi, giữ newline/whitespace, đúng/vượt giới hạn, tổng multipart trên 20 MiB dù từng part hợp lệ, chunked/truncation/abort, scope và TTL, đồng thời cùng key, rollback, mở lại Store, reset và truy vấn summary không tải bảng test. Các hồi quy giai đoạn 1/T03/Publish cùng chạy.

<a id="phase-3"></a>

## 5. Giai đoạn 3 — Tiếp nhận và xem bài nộp

### Phần đã triển khai

| API | Quyền và chức năng |
| --- | --- |
| POST `/labs/:labId/submissions` | Student thuộc lớp nộp JSON code hoặc một `.cpp` |
| GET `/labs/:labId/submissions/mine` | Student xem lịch sử của chính mình |
| GET `/labs/:labId/submissions` | TA cùng lớp xem danh sách, lọc và phân trang |
| GET `/submissions/:submissionId` | Chủ bài còn membership hoặc TA cùng lớp xem chi tiết |

Code tối đa 64 KiB, body tối đa 1 MiB, UTF-8 strict/BOM; giữ nguyên code và lưu vào `submissions.code TEXT`, không lưu file gốc. Tách bộ đọc JSON/file khỏi nghiệp vụ để sau này mở rộng. Bài mới có `status: queued`, `judgeResult: null`; chưa chạy compiler, sandbox hoặc model.

Server ghi thời gian nhận bài sau khi body đã đầy đủ/hợp lệ và trước chờ database; dùng cùng mốc để kiểm tra hạn và lưu. Giữ tất cả lần nộp; bài cuối trong hạn được tính bất kể kết quả, sequence phân định khi timestamp trùng. Replay không biến bài cũ thành lần nộp mới.

Idempotency UUID v4 theo student/lab, TTL 24 giờ, JSON/file cùng code có cùng fingerprint. Transaction ghi submission/job/key nguyên tử; replay sau hạn còn được nhận nếu key còn hiệu lực và quyền hiện tại hợp lệ. Key hết hạn chỉ tạo lần mới nếu còn trong hạn. Migration 0005 thêm bảng key/index và reset tương ứng; không thay hành vi `submit` cũ hoặc vòng đời queue của T06.

Danh sách chỉ tải metadata, mặc định 20/tối đa 100, thứ tự submittedAt rồi sequence giảm dần. Cursor gắn lab/filter, không cấp quyền. Student không lọc sang bài người khác; TA không vượt lớp. Sau deadline vẫn đọc được, thu hồi membership thì mất quyền. Limiter POST theo student/app: 10 request/phút, gồm replay/body lỗi, có Retry-After; tối đa 10.000 bucket, hết chỗ trả 503. Thông báo soát được đưa vào Swagger/response.

### Kiểm tra qua Swagger

1. TA `ta01` tạo lab lớp 1 với deadline tương lai như giai đoạn 2.
2. Login `student001`, thay token trong Authorize. POST bài nộp bằng JSON code, lab ID vừa tạo và key UUID v4 mới; nhận 201, Location, queued/null và thông báo soát.
3. Execute lại cùng code/key: cùng ID, `Idempotent-Replayed: true`, không thêm job. Đổi code cùng key: 409; nộp lại có chủ đích dùng key mới.
4. Chọn multipart, upload [sum.cpp](../../../examples/submissions/sum.cpp) vào `codeFile` với key mới; nhận 201 và đọc lại đúng nội dung. Không gửi ZIP/nhiều file.
5. Student gọi `/mine` và detail; summary không có code/test data. TA `ta01` gọi danh sách, lọc `studentId=demo-student001`, thử `limit=1` và cursor trang tiếp theo.
6. TA `ta06` đọc bài lớp 1 nhận 404. Student không gọi danh sách TA/đọc bài người khác. Khi lab đóng, đọc vẫn được, nộp mới trả 409; replay key còn hạn vẫn thành công.

### Kết quả kiểm chứng — 22/11/2026

| Lệnh/phép kiểm tra | Mã thoát | Kết quả |
| --- | --- | --- |
| `npm run lint` | 0 | Không lỗi/cảnh báo |
| `npm run format-check` | 0 | Đạt Prettier local |
| `npm run type-check` | 0 | Đạt TypeScript strict |
| `npm test` | 0 | **207 đạt, 1 suite PostgreSQL bỏ qua** khi không có TEST_DATABASE_URL |
| `TEST_DATABASE_URL=<database local dành cho kiểm thử>; npm run test:db` | 0 | **86/86 đạt** |
| `TEST_DATABASE_URL=<database local dành cho kiểm thử>; node --test --test-reporter=tap --test-name-pattern='postgres submissions' tests/integration/postgres-store.test.mjs` | 0 | 5/5 đạt, sau đó chạy lại trong lượt đầy đủ 86/86 |
| `node --env-file=.env .local/t04-phase3-ui.mjs` | 0 | 13 bước qua Swagger trên trình duyệt; 2 submission/2 job, không chạy worker |
| `git diff --check` | 0 | Không lỗi whitespace |

Các lệnh dùng `TEST_DATABASE_URL=<...>;` trong bảng biểu diễn điều kiện môi trường, không phải lệnh PowerShell để copy nguyên văn. Cách chạy suite database với giá trị local công khai:

```powershell
$env:TEST_DATABASE_URL = 'postgres://leetkob:leetkob_local@127.0.0.1:5433/leetkob'
npm.cmd run test:db
```

Phạm vi kiểm thử: quyền/chủ bài và quyền trước parser, membership bị thu hồi, draft/closed, đúng/vượt 64 KiB và 1 MiB, UTF-8/BOM/Unicode/newline, multipart trùng/thiếu, chunked/truncated/aborted, JSON/file replay, limiter/capacity, cursor/filter và truy vấn metadata. PostgreSQL kiểm tra mở lại Store, chờ advisory lock thực sự qua deadline (quan sát bằng `pg_locks`), caller sửa input khi đang chờ, ranh giới TTL, lỗi ghi job/key làm rollback mọi hàng, nâng cấp giữ nguyên dữ liệu và hồi quy submit/worker/Publish cũ.

**Kiểm tra trình duyệt:** dùng Microsoft Edge headless riêng và Playwright 1.65.1 tạm cài với `--ignore-scripts` trong `.local/browser-review/` bị Git ignore; không thêm dependency tracked hoặc profile trình duyệt người dùng. Đây là tự động hóa UI, không phải review thủ công độc lập.

13 bước gồm login TA/tạo lab, login student/nộp JSON/replay/upload `.cpp`/lịch sử/detail, TA lọc và phân trang, TA khác lớp nhận 404. Truy vấn database xác nhận đúng 2 bài và 2 job, mọi bài vẫn queued. Browser/server/schema riêng được dọn trong `finally`; không reset/reseed schema ứng dụng. Ảnh `.local/t04-phase3-swagger.jpg` và bản tóm tắt `.local/t04-phase3-swagger-evidence.json` chỉ lưu local, không commit bearer token.

Probe UI ban đầu chưa đợi trạng thái Try it out nên thất bại; đã sửa cách chờ rồi chạy lại đạt, không cần sửa hành vi API. Không cài hoặc dựa vào Postman CLI; bộ test Node và OpenAPI local là nguồn kiểm chứng tái sử dụng.

## 6. Checklist, giới hạn và sự hỗ trợ của AI

- [x] Giai đoạn 1: auth/session thật, seed, runtime/env, Swagger và ba bản sửa review.
- [x] Giai đoạn 2: tạo/list/detail lab, JSON/file, quyền/DTO, idempotency và migration 0004.
- [x] Giai đoạn 3: bốn API nhận/đọc bài, thông báo soát, thời gian nhận, limiter, phân trang, transaction/idempotency và migration 0005.
- [x] Viết test quyền/chống trùng trước implementation. Giai đoạn 2 quan sát route/method chưa có; giai đoạn 3 quan sát 404 thay vì 201 trong `.local/t04-phase3-red.tap`.
- [x] Fake/PostgreSQL có kiểm thử conformance; nâng cấp/reset/rollback/mở lại Store; hồi quy auth/lab/Publish/T03.
- [x] Contract, file mẫu, hướng dẫn chạy và bằng chứng kiểm chứng được cập nhật.
- [ ] Review độc lập của Vỹ; không tick thay reviewer.
- [ ] Tích hợp T06 và xác nhận luồng nộp → chấm → kết quả thật của toàn T04.

Tests mặc định không cần PostgreSQL; suite database dùng schema riêng và clock xác định khi kiểm tra thời gian. Các log `.local/t04-phase2-*.tap` và `.local/t04-phase3-*.tap` bị Git ignore. Đã gặp EACCES khi sandbox chặn socket local; một số lượt bị chặn/treo được dừng rồi chạy lại với quyền phù hợp. Ở giai đoạn 3 còn gặp ECONNREFUSED do Docker Desktop tắt; đã khởi động lại Docker/Compose trước khi chạy lại. Không nới assertion hoặc bypass checks để xử lý lỗi môi trường. Kỳ vọng số migration được tăng tương ứng khi thêm 0003/0004/0005.

Codex hỗ trợ contract, implementation, ví dụ và kiểm thử. Không gọi model thật, không thực thi mã nguồn mẫu trong sandbox, không chỉnh/dùng dữ liệu dev set làm prompt hoặc ví dụ. Kết quả giả lập trong fixture không được gọi là kết quả chấm thật. File mẫu được tự viết. Không commit/push/cập nhật issue/PR trong các lượt triển khai được ghi ở đây.

Chưa đo tải 80 người đồng thời, chưa benchmark password trên VPS, chưa có limiter phân tán hoặc GET polling riêng; giữ `trustProxy: false`. Phân trang không phải snapshot cố định. Hai ý định dùng hai key khác nhau vẫn có thể tạo hai tài nguyên. Quyền được kiểm tra trên từng request; chưa gộp transaction thay đổi membership với upload đang xử lý. Race seed dev/password đã chấp nhận ở giai đoạn 1 vẫn còn. ZIP/nhiều file, sửa/xóa bài, API reset password và chấm thật không được suy ra là đã triển khai từ bằng chứng này.
