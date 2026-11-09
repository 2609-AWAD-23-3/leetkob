# LeeTKOB — Mô hình dữ liệu và store publish của T02

**Thực hiện:** Vượng (vinny2707). **Reviewer độc lập:** Vỹ (tranquocvy).
**Tiêu chí nghiệm thu:** [PA02/T02](../plans/PA02.md#t02--data-foundation), [Issue #2](https://github.com/2609-AWAD-23-3/leetkob/issues/2).

**Trạng thái:** bản triển khai chờ review trên nhánh feat/t02-publish-state, phát triển từ 9ac6bf5. Kế hoạch T02 chưa commit ban đầu đã được phát triển thành thiết kế và implementation bên dưới. Xem [evidence T02](../evidence/PA02/T02/README.md) để biết kết quả kiểm tra thực tế và những bước còn thiếu. Vẫn cần review độc lập và tích hợp; tài liệu này chưa xác nhận T03/T08 hoàn thành hoặc chốt HTTP contract.

## 1. Yêu cầu và phạm vi

Nguồn là brief môn học, mục 3–4, và FAQ của product owners trên Classroom. Bản FAQ đã đối chiếu nằm tại D:/semester1-year4/advanced_web_development/project/docs/FAQ.md, ngoài repo; ứng dụng không phụ thuộc đường dẫn này. Bảng dưới diễn giải các yêu cầu, giữ mã FAQ để reviewer tra lại nguồn môn học.

| Nguồn | Yêu cầu áp dụng |
| --- | --- |
| FAQ-01 | Mỗi lab thuộc một lớp. Một lớp có nhiều TA; một TA có thể phụ trách nhiều lớp. TA chỉ truy cập dữ liệu lớp mình phụ trách. |
| FAQ-02 | Bài được tính là bài cuối trước deadline, bất kể kết quả chấm. Queue hiện hành chỉ xét bài được tính. |
| FAQ-09 | Verdict unsure phải được TA quyết định pass hoặc violation; không tự động trở thành khoản trừ. |
| FAQ-10 | Một mục queue ứng với một cặp bài được tính–constraint. Queue gồm mọi violation/unsure và một mẫu pass. Vì vậy pending không đồng nghĩa với unsure. |
| FAQ-12 | Công bố điểm cả lab khi hết hạn nộp và mọi mục queue đã có quyết định TA. Gọi lại không thay đổi publication; không unpublish. Chỉnh điểm từng bài sau đó thuộc phần việc khác. |

T02 do Vượng đề xuất để Phúc dùng cho T03/T08; draft của Phúc không ràng buộc thiết kế này. T01 đã cung cấp skeleton. T02 chỉ làm dữ liệu/store/fixtures; chưa làm xác thực, HTTP routes/errors, chọn bài được tính, chọn mẫu queue, gọi model, tính điểm, database/ORM, quản lý tài khoản hoặc khiếu nại.

## 2. Mô hình dữ liệu

Các thành phần được export qua [data/index.ts](../../src/data/index.ts). Types và store độc lập với Fastify, không thêm package.

| Type | Trường và ý nghĩa |
| --- | --- |
| Lab | id: ID lab; classId: lớp của lab; deadline: hạn nộp |
| TaClassMembership | taId, classId: một cặp TA–lớp duy nhất; hỗ trợ quan hệ nhiều–nhiều |
| ReviewQueueItem | id, labId, submissionId, constraintId, verdict, taDecision |
| PublicationSummary | queueItemCount: tổng mục queue; passDecisionCount: số TA chọn pass; violationDecisionCount: số TA chọn violation |
| ReviewState | Các số đếm của summary và pendingCount: số mục chưa có quyết định TA |
| Publication | labId, publishedAt: thời điểm công bố; publishedBy: TA công bố; summary. Tối đa một bản ghi cho mỗi lab |
| SeedState | Bốn mảng labs, memberships, queueItems, publications để khởi tạo/reset |

ID là chuỗi không rỗng, phân biệt hoa/thường, không có khoảng trắng đầu/cuối; không bắt buộc UUID. Thời gian lưu theo UTC ISO chuẩn, ví dụ 2026-11-09T15:00:00.000Z, tương ứng 22:00 giờ Việt Nam. submissionId/constraintId chỉ là tham chiếu do fixture cung cấp; T02 chưa xây entity tương ứng. Membership có thể chứa lớp chưa có lab trong seed; chưa có bảng lớp hoặc danh sách tài khoản đầy đủ.

### Verdict và quyết định TA

- verdict nhận pass | violation | unsure.
- taDecision nhận null | pass | violation. null nghĩa là pending; bỏ hẳn trường taDecision là seed sai.
- Ví dụ verdict là violation nhưng TA chọn pass: mục đó đã resolved và được đếm vào passDecisionCount.
- Một verdict pass được chọn vào queue nhưng chưa có quyết định TA vẫn pending.

ID của các mục queue phải duy nhất; bộ (labId, submissionId, constraintId) cũng phải duy nhất. Seed chỉ chứa queue hiện hành, không chứa lịch sử submissions hoặc toàn bộ verdict. Bên tạo seed chịu trách nhiệm chọn đúng bài được tính và đúng queue; T02 chưa có pipeline để kiểm chứng việc chọn đó.

Store giữ các số đếm review tối thiểu phục vụ publish; chưa cung cấp API đọc/sửa từng mục hoặc quy trình TA duyệt bài.

### Summary khi công bố

Người yêu cầu chọn thống kê review, không chứa điểm sinh viên. Summary đếm quyết định TA tại lúc publish; khi thành công:

~~~text
passDecisionCount + violationDecisionCount === queueItemCount
~~~

Queue rỗng có cả ba số đếm bằng 0. Summary không phải bảng điểm, số sinh viên hoặc phép tính khoản trừ. Gọi publish lại giữ nguyên summary, người công bố và thời điểm ban đầu. Chỉnh điểm về sau không sửa snapshot này và nằm ngoài T02.

## 3. Interface và luồng publish

~~~ts
interface PublishStore {
  getLab(labId: string): Lab | undefined;
  isTaAssignedToClass(taId: string, classId: string): boolean;
  getReviewState(labId: string): ReviewState | undefined;
  getPublication(labId: string): Publication | undefined;
  publishLab(input: { labId: string; publishedBy: string }): PublishResult;
}
~~~

Các hàm chạy đồng bộ và trả bản sao dữ liệu. Lab/review state không tồn tại thì trả undefined. getPublication trả undefined cho cả lab không tồn tại và lab chưa công bố; dùng getLab để phân biệt. Không có cặp membership thì trả false.

PublishResult có trường kind để bên gọi phân biệt kết quả. Thứ tự kiểm tra:

| Điều kiện | Kết quả | Thay đổi state |
| --- | --- | --- |
| Không có lab | kind: lab_not_found | Không |
| Đã có publication | kind: already_published; kèm publication cũ | Không; không đọc clock |
| now < deadline | kind: before_deadline; kèm deadline | Không |
| Còn pending | kind: pending_reviews; kèm pendingCount | Không |
| Đủ điều kiện | kind: published; kèm publication vừa lưu | Lưu một bản ghi và trả bản sao |

Quy ước được chọn là now >= deadline: đúng deadline đã đủ điều kiện về thời gian. Mỗi lần publish mới chỉ đọc clock một lần, dùng cùng thời điểm cho kiểm tra và publishedAt. Queue rỗng được công bố khi hết hạn; pending của lab khác không ảnh hưởng.

Với chuyển trạng thái mới, publishedBy phải là ID hợp lệ; sai thì ném TypeError và không ghi state. Clock mặc định là () => new Date(). Clock trả Date không hợp lệ hoặc ném lỗi thì không tạo publication. Clock được inject phải đáng tin cậy, chạy đồng bộ và không gọi ngược vào store/reset. Khi đã có publication, lời gọi lặp trả bản gốc trước khi kiểm tra đầu vào mới hoặc đọc clock.

### Trách nhiệm của T03/T08

Store chưa xác thực caller hoặc thực thi role/membership. T03/T08 phải xác định principal tin cậy, kiểm tra role TA, tra lab rồi kiểm tra isTaAssignedToClass(principal.id, lab.classId) trước khi cho đọc dữ liệu hoặc publish. publishedBy lấy từ principal đã xác thực, không lấy thẳng từ dữ liệu client tự khai. Gọi publish lặp vẫn phải qua authorization.

Phúc quyết định HTTP status/error serialization và cách tránh lộ thông tin khi lab không tồn tại hoặc caller không có quyền. getReviewState chỉ hỗ trợ đọc trạng thái; endpoint không được dùng nó làm bước kiểm tra duy nhất rồi tự ghi publication. publishLab đã gộp kiểm tra deadline/pending và ghi chuyển trạng thái.

## 4. Khởi tạo, reset, validation và guarantees

~~~ts
createInMemoryPublishStore({ initialState?, clock? }): {
  store: PublishStore;
  reset(nextState?: SeedState): void;
}
~~~

Không truyền initialState thì store rỗng. reset() xóa state; reset(seed) thay toàn bộ state. Reset chỉ dùng setup/test, nằm ngoài PublishStore, không được mở qua HTTP hoặc coi là chức năng unpublish. Chưa có hàm unpublish hoặc chỉnh review lúc chạy nghiệp vụ.

Seed được validate trước khi thay state. Các trường hợp bị từ chối: ID/thời gian/mảng sai; ID, membership hoặc cặp review trùng; tham chiếu lab không tồn tại; verdict/decision không hỗ trợ; publication trùng lab, trước deadline, còn pending hoặc summary không khớp queue đã resolved. Publication seed không phụ thuộc clock hiện tại. Seed sai ném TypeError; reset thất bại giữ nguyên toàn bộ state cũ. Helper này nhận object theo SeedState, không phải API tiếp nhận JSON không tin cậy.

Seed đầu vào và object trả về không chia sẻ state mutable bên trong. Sửa seed, lab/review/publication lấy ra hoặc summary lồng bên trong không sửa ngầm store. Mỗi lần gọi fixture builder trả object mới; fixed clock trả Date mới.

Mỗi factory sở hữu Map/Set riêng. Sau khi đọc clock tin cậy, kiểm tra điều kiện và ghi publish chạy đồng bộ, không await hoặc gọi callback bên ngoài. Các lời gọi được lên lịch cùng lúc trong một luồng JavaScript sẽ lần lượt thực thi: một lời gọi tạo publication, các lời gọi sau nhận bản cũ.

Guarantee này chỉ áp dụng cùng instance/một luồng JavaScript; không bảo đảm atomicity giữa worker/process hoặc hệ thống phân tán. Dữ liệu mất khi restart, không chia sẻ giữa các app instance. Store không gửi thông báo hoặc tạo side effect bên ngoài.

## 5. Fixtures và ví dụ kiểm tra

~~~ts
import {
  createFixedClock,
  createInMemoryPublishStore,
  createPublishSeed,
} from './data/index.js';

const fixture = createInMemoryPublishStore({
  initialState: createPublishSeed('pending'),
  clock: createFixedClock(),
});
fixture.store.getLab('lab-1'); // thuộc class-1
fixture.store.isTaAssignedToClass('ta-multi', 'class-1'); // true
fixture.store.isTaAssignedToClass('ta-multi', 'class-2'); // true
fixture.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-one' });
// { kind: 'pending_reviews', pendingCount: 1 }

fixture.reset(createPublishSeed('resolved')); // chỉ dùng setup/test
const first = fixture.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-one' });
// published: tổng 3 mục, TA quyết định 2 pass và 1 violation
const repeat = fixture.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-multi' });
// already_published: giữ nguyên thời điểm, ta-one và summary ban đầu
~~~

| Scenario của createPublishSeed | Trạng thái lab-1 |
| --- | --- |
| resolved (mặc định) | 3 mục đã có quyết định TA: 2 pass, 1 violation |
| pending | 3 mục, trong đó 1 mục chưa có quyết định TA |
| empty | Queue rỗng |
| published | Đã có publication tương ứng queue resolved |

Seed dùng ID giả, có hai lớp/lab, TA một lớp và TA phụ trách cả hai lớp. createFixedClock mặc định ở thời điểm sau FIXTURE_DEADLINE 1 ms; test truyền clock trước hoặc đúng deadline khi cần.

Vỹ phụ trách app composition, manifest/lockfile và runner chung. Mỗi app/test tạo store riêng; chỉ truyền fixture.store cho module của Phúc, giữ reset ở phần setup test. T02 chưa sửa createApp hoặc tạo singleton; Phúc phụ trách authorization và endpoint.

## 6. Cách chạy kiểm thử

Tại thư mục gốc repo, dùng Node 24.22.1 và npm 11.19.1:

~~~powershell
npm.cmd run build
node --test tests/data/publish-store.test.mjs
node --test tests/smoke/app.test.mjs
git diff --check
~~~

Nếu chưa cài dependencies, chạy npm.cmd ci --ignore-scripts trước. Tests import file đã biên dịch trong dist nên phải build trước. Tổng mong đợi là 40 data tests và 7 smoke tests đạt. Chưa có npm test chung trong baseline T01.

Để thử từng hàm, build xong rồi chạy node để vào REPL và dùng dynamic import:

~~~js
const { createInMemoryPublishStore, createPublishSeed, createFixedClock } =
  await import('./dist/data/index.js');
const f = createInMemoryPublishStore({
  initialState: createPublishSeed('pending'),
  clock: createFixedClock()
});
f.store.getReviewState('lab-1');
f.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-one' });
// pending_reviews; chưa có publication
f.reset(createPublishSeed('resolved'));
f.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-one' });
// published
f.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-multi' });
// already_published; vẫn giữ publishedBy là ta-one
~~~

Xem [data tests](../../tests/data/publish-store.test.mjs) và [evidence](../evidence/PA02/T02/README.md). Kết quả data tests không chứng minh HTTP authorization, toàn bộ harness T04, CI hoặc persistence production.
