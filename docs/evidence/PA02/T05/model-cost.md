# T05 — Provider, model, spending cap và chi phí mỗi lab

**Trạng thái:** đã có bản ước tính tham chiếu; chưa chốt provider/model triển khai, chưa có key và chưa xác minh spending cap hoặc chi phí thực tế. Không đánh dấu hoàn thành toàn bộ mục model/cap/cost chỉ từ bảng tính này.

**Người dự kiến quản lý key:** Trần Quốc Vỹ (tranquocvy), theo chỉ định dự kiến của người dùng ngày 11/11/2026. Đây chưa phải xác nhận Vỹ đã có key, quyền tài khoản hoặc đã cấu hình cap.

## 1. Những gì đã xác nhận

- Theo người dùng, nhóm hiện chưa có key; việc tính estimate không tạo key hoặc gọi model.
- Source ở baseline 09245d7: src/server.ts gọi loadConfig(), mặc định đọc process.env và chỉ dùng HOST/PORT. T03 nhận token directory/resolver qua cấu hình trong code; chưa có model/provider client hoặc biến API key trong runtime này.
- Provider/model trong phần ước tính dưới đây chỉ là mốc tính tiền tham chiếu, chưa phải lựa chọn được nhóm chốt và chưa được kiểm chứng trên eval LeeTKOB.
- Chi phí model bên trong sản phẩm và chi phí dùng assistant phát triển là hai khoản khác nhau. Chưa có usage/billing của sản phẩm để đưa vào mục measured.

## 2. Nguồn giá dùng cho estimate

**Ngày tra cứu:** 11/11/2026. **Đơn vị:** USD, mỗi 1.000.000 token.

| Hạng mục             | Giá trị tham chiếu                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Provider             | OpenAI API trực tiếp, chỉ để lập estimate                                                            |
| Model                | GPT-5.4 Mini; snapshot tham chiếu gpt-5.4-mini-2026-03-17                                            |
| Input không cache    | 0,75 USD / 1 triệu token                                                                             |
| Output               | 4,50 USD / 1 triệu token                                                                             |
| Phương thức giả định | Text tiêu chuẩn; không Batch/Flex, không cache, không tool tính phí hoặc phụ phí regional processing |

Giá và model được tra từ [trang model chính thức](https://developers.openai.com/api/docs/models/gpt-5.4-mini); đối chiếu [bảng giá API](https://developers.openai.com/api/docs/pricing). Khi nhóm chọn model khác hoặc giá thay đổi phải tính lại, không giữ số dưới đây như giá của model thực tế.

Output trong estimate tính tổng token bị tính phí, bao gồm reasoning nếu có, không chỉ số token nhìn thấy trong JSON. Nguồn: [tài liệu reasoning chính thức](https://developers.openai.com/api/docs/guides/reasoning). Các giả định token cần đo lại bằng usage khi có lượt chạy được phép.

## 3. Giả định khối lượng

[Brief, mục 2 và 4](../../../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief_vn.md) nêu quy mô khoảng 80 sinh viên/submissions. Dùng 80 bài được tính đủ điều kiện soát làm kịch bản lập ngân sách; không khẳng định đã đo được 80 bài thực tế.

- Chỉ xét bài được tính, không tính mọi lần nộp lại của sinh viên.
- Hard rules chạy trước; giả sử các semantic constraints trong bảng vẫn cần model cho toàn bộ 80 bài.
- Giả sử một lượt gọi cho một cặp bài–constraint. Đây là giả định tính toán, chưa chốt cách batch/group trong pipeline.
- Input mỗi lượt gồm system instructions, đề, constraint và code đã loại thông tin định danh. Code/prompt được tính lại ở mỗi lượt, chưa áp dụng cache.
- Output là tổng token được tính phí, bao gồm reasoning nếu có. Không xem ngân sách token giả định là đủ để bảo đảm chất lượng đánh giá.
- Mỗi cặp tối đa một retry trong mô hình ước tính. Kịch bản dự trù thông thường: 20% cặp cần retry, mỗi retry tính nguyên ngân sách input/output của một lượt. Cột toàn bộ retry một lần là kịch bản tính thêm, không phải cap đang enforce.

## 4. Công thức và kết quả

```text
calls = countedSubmissions × semanticConstraints
inputCost = calls × inputTokensPerCall / 1_000_000 × 0.75
outputCost = calls × outputTokensPerCall / 1_000_000 × 4.50
baseCost = inputCost + outputCost
estimateWith20PercentRetry = baseCost × 1.20
allPairsRetriedOnce = baseCost × 2
```

| Giả định/kết quả                       |               Kịch bản chuẩn |    Kịch bản nặng |
| -------------------------------------- | ---------------------------: | ---------------: |
| Bài được tính đủ điều kiện             |                           80 |               80 |
| Semantic constraints cần model mỗi bài |                            3 |                5 |
| Lượt gọi ban đầu                       |                          240 |              400 |
| Input tokens mỗi lượt                  |                        2.000 |            4.000 |
| Output tokens bị tính phí mỗi lượt     |                        1.000 |            2.000 |
| Tổng input tokens ban đầu              |                      480.000 |        1.600.000 |
| Tổng output tokens ban đầu             |                      240.000 |          800.000 |
| Chi phí input                          |                     0,36 USD |         1,20 USD |
| Chi phí output                         |                     1,08 USD |         3,60 USD |
| Chi phí ban đầu                        |                     1,44 USD |         4,80 USD |
| Với 20% cặp retry một lần              | 1,728 USD ≈ **1,73 USD/lab** | **5,76 USD/lab** |
| Nếu mọi cặp đều retry một lần          |             **2,88 USD/lab** | **9,60 USD/lab** |

Ví dụ kịch bản chuẩn:

```text
240 × (2.000 × 0,75 + 1.000 × 4,50) / 1.000.000 = 1,44 USD
1,44 × 1,20 = 1,728 USD ≈ 1,73 USD/lab
```

Đây là estimate theo giả định, không phải báo giá bảo đảm hoặc kết quả chạy thật. Số cặp cần model ít hơn thì chi phí giảm; code dài hơn, nhiều reasoning hơn hoặc số lượt chạy lại ngoài giả định thì tăng. Chưa bao gồm thuế, quy đổi ngoại tệ, sandbox/judging, hosting, lưu trữ, tool tính phí hoặc các lần gọi khác trong cùng tài khoản. Không suy ra khả năng truy cập model từ việc có bảng giá.

## 5. Spending cap và measured — chưa xác minh

| Hạng mục                 | Trạng thái             | Cần bổ sung                                                                    |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------ |
| Provider/model dùng thật | Chưa chốt              | Nhóm/Vỹ xác nhận lựa chọn, model version và cấu hình                           |
| Người giữ key            | Dự kiến Vỹ             | Vỹ xác nhận tiếp nhận và quyền quản lý tài khoản/project                       |
| Spending cap ở provider  | Chưa cấu hình/xác minh | Bằng chứng đã che: mức tiền, kỳ giới hạn, phạm vi và hành vi khi chạm giới hạn |
| Cost/lab — estimate      | Có bản tham chiếu      | Thay giả định bằng token/khối lượng thật và giá model được nhóm chốt           |
| Cost/lab — measured      | Chưa đo                | Usage/billing của lượt chạy được cho phép; không ghi là 0 USD đã đo            |

1,73 USD/lab hoặc 5,76 USD/lab không phải spending cap. Budget alert chỉ cảnh báo chưa chắc chặn chi tiêu; giới hạn số lượt gọi/concurrency cũng không tự chứng minh cap tiền của provider đã hoạt động. Tài liệu này không cấu hình một giới hạn nào trong app hoặc tài khoản.

Không ghi API key, cookie, thông tin thanh toán hoặc credential vào evidence/prompt. Vỹ cần cung cấp bằng chứng cấu hình đã che khi nhóm có key; không gọi provider trong unit tests để tạo số đo. T11 dùng đúng nhãn estimate/measured. Theo review đã sửa của PR #21, T05 chuẩn bị hồ sơ cap bên dưới để T11 tổng hợp; không yêu cầu gọi model thật, chốt production model hoặc sửa báo cáo root chỉ để tạo evidence cho PR này. Bằng chứng cap chưa có vẫn được ghi rõ là chưa cung cấp.

### 5.1. Phiếu bổ sung bằng chứng spending cap theo review PR #21

**Người dự kiến cung cấp:** Vỹ. **Trạng thái hiện tại:** chưa nhận bằng chứng cấu hình; không nhận đã hoàn tất mục spending cap. Không cần gửi key để điền phiếu này.

| Thông tin cần xác nhận                            | Giá trị hiện có                                              |
| ------------------------------------------------- | ------------------------------------------------------------ |
| Provider và phạm vi account/project áp dụng       | Chưa xác nhận                                                |
| Mức giới hạn và đơn vị tiền                       | Chưa xác nhận; không lấy estimate làm cap                    |
| Kỳ giới hạn và thời điểm reset                    | Chưa xác nhận                                                |
| Loại giới hạn: chặn chi tiêu hay chỉ cảnh báo     | Chưa xác nhận                                                |
| Hành vi khi chạm giới hạn, độ trễ/ngoại lệ nếu có | Chưa xác nhận; cần đối chiếu tài liệu của provider được chọn |
| Người cấu hình và ngày kiểm tra                   | Chưa xác nhận                                                |
| Đường dẫn ảnh/cấu hình/tài liệu chứng minh đã che | Chưa cung cấp                                                |

Vỹ bổ sung ảnh hoặc bản xuất cấu hình đã che, giữ các trường mức tiền, kỳ, phạm vi và loại giới hạn cần review. Che API key, định danh tài khoản riêng tư, thông tin thanh toán và credential. Nếu chỉ có budget alert, ghi đúng là cảnh báo và giữ mục cap chưa đạt; không dùng ảnh cảnh báo để nhận đã có chặn chi tiêu. Không tạo usage tính phí chỉ để chứng minh cap, không tự cấp quyền hoặc thay cấu hình tài khoản trong T05.

Phiếu này giúp thu đủ evidence, **chưa phải evidence cap đã được thiết lập**. Sau khi người có quyền cung cấp thông tin, cập nhật cùng nguồn và ngày xác minh; đến lúc đó mới đánh giá acceptance.
