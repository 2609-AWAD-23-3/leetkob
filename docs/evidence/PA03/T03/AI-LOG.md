# Đầu vào AI-log — PA03-T03

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 19–20/11/2026 — Giai đoạn 1: kiểu dữ liệu, interface và bản fake

**Công cụ (Tool):** Claude Code (desktop app).

**Yêu cầu (Asked for):** thiết kế và code kiểu dữ liệu, interface `Store`/`Queue`, bản fake in-memory và JSON schema verdict cho T04, T06, T08, T09; lập plan để Vượng review trước khi code.

**Phần giữ lại (Kept):** cấu trúc chia tầng của PA03-T00; store PA02 (`PublishStore`, fixtures, 83 test) giữ nguyên; quy ước ID, thời gian và lỗi `TypeError` cho seed sai của PA02; mô hình review queue một mục cho mỗi cặp bài được tính × constraint.

**Phần điều chỉnh (Changed):**
- Bản nháp đầu đặt toàn bộ kiểu trong một file `domain.ts` và một `types.ts`; Vượng hỏi về chia theo domain, nên tách file theo domain trong `src/shared/domain/` và `src/db/`, vẫn giữ tầng của T00 vì `src/pipeline/` không được import `src/db/`.
- Bản nháp đề xuất chuyển `PublishStore` sang async ngay; Vượng chọn để sang giai đoạn 2, nên giai đoạn 1 không sửa code hay test PA02.
- Sau khi đọc FAQ của product owners: giới hạn chạy thành thuộc tính của lab (FAQ-05), mã kết quả chấm `AC`…`CE` kèm verdict từng test (FAQ-02), bài không Accepted không vào queue (FAQ-04), `unsureCause` theo năm nguyên nhân (FAQ-09), nhật ký mỗi lần TA đổi quyết định (FAQ-10).
- Một test mới ban đầu dùng đồng hồ thật nên bài nộp rơi sau deadline của fixture; sửa test cho dùng clock cố định.

**Phần không chọn (Rejected):** module có domain và store riêng (vertical slice) vì đụng cấu trúc T00 và luật import của pipeline; bảng review queue riêng vì phải đồng bộ khi student nộp lại; thư viện validate JSON Schema vì không thêm dependency, viết `parseModelVerdicts` thuần.

**Phần làm tay (By hand):** Vượng chốt cấu trúc, thời điểm async hóa Publish, hạn 21/11 và cung cấp file FAQ; review plan trước khi code.

## 20/11/2026 — Sửa theo tự review của Vượng

**Công cụ (Tool):** Claude Code.

**Yêu cầu (Asked for):** sửa 7 điểm Vượng tìm ra khi review code giai đoạn 1 trước khi mở PR.

**Phần điều chỉnh (Changed):**
- Worker crash liên tục mà không gọi `fail` thì job bị claim mãi và Publish bị chặn vĩnh viễn: `claim` nhận `maxAttempts`, job hết lượt bị kết thúc và submission thành `failed`.
- `complete` từng lưu nguyên verdict sai dạng (`verdict: 'bogus'`, `evidence` không phải mảng, `source` lạ, `reason` là số, `unsureCause` trên verdict không phải `unsure`) và bỏ qua cặp trùng trong cùng lần gọi: thêm `src/db/validation.ts` dùng chung, từ chối các trường hợp này và bắt bài AC có đủ verdict cho mọi constraint.
- `fail` không kiểm `maxAttempts`, nên `undefined` làm job thử lại vô hạn: thêm kiểm tra.
- `decide`/`confirmPasses` nhận reviewer không tồn tại và evidence sai dạng, nhật ký bỏ sót đổi evidence hoặc người review: kiểm reviewer như khóa ngoại, validate evidence, ghi nhật ký mọi thay đổi.
- Bài AC thiếu verdict làm lab pending mãi: nay `complete` từ chối; tài liệu ghi pipeline phải trả `unsure` thay vì bỏ trống.
- Plan: bỏ tick mục bàn giao cho tới khi merge; evidence ghi đủ lệnh, exit code, SHA base và phiên bản Node.
- Vòng review thứ hai: so sánh evidence bằng `JSON.stringify` làm đổi thứ tự key tạo dòng nhật ký thừa, nay so theo `line` và `text`; evidence, verdict, kết quả chấm và kết quả từng test có field lạ (ví dụ `deduction`) từng được lưu nguyên, nay bị từ chối và store chỉ chép các field đã định nghĩa.
- Assistant chỉ ra `createLab` cũng giữ field lạ; Vượng yêu cầu sửa: kiểm tra lab chuyển sang `src/db/validation.ts`, lab, `limits`, test và constraint phải đúng field, store chỉ chép field đã biết.
- Mốc "mở nhận bài" của FAQ: brief, rubric và plan không yêu cầu giờ mở riêng nên assistant ban đầu chỉ ghi quy ước lab mở khi tạo; Vượng quyết định thêm `opensAt` vì FAQ là mô tả của product owner. `opensAt` tùy chọn khi tạo (mặc định `createdAt`), phải trước `deadline`; thêm `labPhase` và chỉ tính bài nhận trong khoảng mở.
- Thêm test vào bộ conformance chung cho từng lỗi trên; bỏ test "bài AC thiếu verdict vẫn pending" vì trạng thái đó không còn tạo được qua store.

**Phần làm tay (By hand):** Vượng review code, chạy thử các trường hợp lỗi và chỉ ra dòng code cụ thể.
