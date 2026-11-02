# PA#2 - Harness và quality gate · Rubric

> Bản dịch từ `PA#2 rubric — Harness and quality gate.pdf` (4 trang). Giữ nguyên thuật ngữ chuyên ngành, tên file, đường dẫn, lệnh và identifier kỹ thuật.

CSC13114 · Mốc dự án, nhóm tối đa 3 thành viên · Chiếm 4% điểm môn học · 100 điểm

Sản phẩm là **LeeTKOB**: đọc class brief trước khi bắt đầu. Checkpoint này đánh giá nền tảng của nhóm trước khi tính năng LLM được triển khai ở PA#3: các quy tắc assistant phải tuân theo, những check chạy trên mỗi thay đổi, CI thực sự từ chối một merge không đạt yêu cầu, và contract của một endpoint kèm tests buộc code tuân thủ contract đó.

Hãy dùng assistant cho toàn bộ các công việc này. Việc chấm điểm dựa trên những gì repository thể hiện: quality gate có thực sự chặn lỗi không, và contract có đủ cụ thể để một người không thuộc nhóm xây dựng client từ đó không.

**Hạn nộp: thứ Tư, ngày 11/11/2026, lúc 22:00. Mỗi nhóm nộp một bài.**

## Các tiêu chí chấm điểm

| # | Tiêu chí | Điểm |
| --- | --- | ---: |
| 1 | Rules file | 15 |
| 2 | Permissions và secrets | 10 |
| 3 | Một lệnh cho mỗi check | 10 |
| 4 | CI chặn được merge | 20 |
| 5 | Contract của một endpoint LeeTKOB | 25 |
| 6 | Contract tests thực sự phát hiện lỗi | 15 |
| 7 | `AI-LOG.md` | 5 |

## 1. Rules file - 15 điểm

`CLAUDE.md`, `AGENTS.md`, `.cursor/rules` hoặc `.github/copilot-instructions.md`: chọn file mà công cụ của nhóm thực sự đọc (session 3, slides 4-6).

| Điểm | Mô tả |
| --- | --- |
| 13-15 | Ngắn gọn, có đủ bốn phần: `stack`, `commands`, `conventions`, `never`. Danh sách `never` gắn với sản phẩm này: không có secret trong sandbox; không gọi model thật trong unit tests; không bao giờ sửa test, eval data hoặc label chỉ để check pass. Ít nhất hai dòng quy tắc truy vết được tới sự cố đã thực sự xảy ra, qua commit hoặc entry trong `AI-LOG.md`. |
| 8-12 | Có đủ bốn phần, nhưng nội dung chung chung (như “viết code sạch”) hoặc không có dòng nào gắn với sự cố thực tế. |
| 3-7 | File dài được copy từ template, hoặc do assistant viết mà không ai chỉnh sửa. |
| 0-2 | Không có. |

## 2. Permissions và secrets - 10 điểm

| Điểm | Mô tả |
| --- | --- |
| 9-10 | Quyền hạn của assistant được ghi rõ theo ba mức: `allowed`, `ask first`, `never`. `.env.example` liệt kê mọi biến nhưng không chứa giá trị. Không có secret ở bất kỳ đâu trong lịch sử Git. Model API key có spending cap, và README nêu rõ điều đó. |
| 5-8 | `.env` được ignore và có file example, nhưng quyền hạn chưa được ghi rõ. |
| 1-4 | Có key hoặc password trong lịch sử Git, kể cả khi đã xóa sau đó. Rotate secret đó rồi ghi vào `AI-LOG.md` để có thể trở lại dải điểm phía trên. |
| 0 | Có secret còn hiệu lực trong cây thư mục nộp bài. |

## 3. Một lệnh cho mỗi check - 10 điểm

| Điểm | Mô tả |
| --- | --- |
| 9-10 | Lint, format check, type check (nếu ngôn ngữ có) và tests, mỗi loại chạy bằng một lệnh được ghi trong tài liệu. Local và CI dùng cùng các lệnh. Một fresh clone làm theo README sẽ chạy xanh các check. |
| 5-8 | Có các check, nhưng CI chạy khác với những gì README hướng dẫn. |
| 1-4 | Chỉ có tests hoặc chỉ có lint. |
| 0 | Không có check. |

## 4. CI chặn được merge - 20 điểm

| Điểm | Mô tả |
| --- | --- |
| 17-20 | `main` được bảo vệ, các check ở tiêu chí 3 là required checks. Có liên kết tới pull request bị check đỏ chặn merge và commit khiến check chuyển xanh. Không có lần push thẳng nào vào `main` kể từ khi bật branch protection. |
| 11-16 | CI chạy trên mọi pull request và có thể chuyển đỏ, nhưng không phải required check, nên PR đỏ vẫn có thể được merge. |
| 4-10 | Có CI nhưng chỉ chạy trên `main`, sau khi merge. |
| 0-3 | Không có CI, hoặc CI không thể fail. |

## 5. Contract của một endpoint LeeTKOB - 25 điểm

Đặt tại `docs/contract/<endpoint>.md`, có cùng các phần như `CONTRACT.md` trong IA#3. Chọn endpoint mà bạn ít muốn một người ngoài nhóm gặp lỗi nhất. Một số lựa chọn phù hợp:

- `POST /labs/{labId}/submissions`: student nộp bài. Retry upload không được tạo hai submissions.
- `GET /labs/{labId}/review-queue`: chỉ TA được gọi, và chỉ cho các lớp của chính TA đó. Đây là danh sách nên phải có paging.
- `POST /labs/{labId}/publish`: bước khó đảo ngược. Phải an toàn khi gọi lặp lại và phải từ chối khi vẫn còn review đang chờ xử lý.
- `POST /submissions/{id}/appeals`: student gửi appeal cho submission của chính mình, chỉ sau khi publish.

| Điểm | Mô tả |
| --- | --- |
| 21-25 | Nêu rõ ai được gọi: role và ownership rule (dữ liệu của ai). Có request/response shape cùng quy tắc cho từng field. Mọi error dùng problem details (RFC 9457), liệt kê từng `type` và status đi kèm. Có paging nếu trả danh sách, idempotency nếu tạo mới hoặc publish. Nêu rõ cách xử lý khi contract thay đổi. Một người ngoài nhóm có thể viết client chỉ từ file này. |
| 13-20 | Shape và errors rõ ràng, nhưng quyền gọi chỉ ghi “authenticated”, hoặc thiếu paging/idempotency tại nơi cần áp dụng. |
| 5-12 | Chỉ liệt kê endpoint và example bodies: không có error model, không có quy tắc. |
| 0-4 | Không có, hoặc không phải endpoint LeeTKOB. |

## 6. Contract tests thực sự phát hiện lỗi - 15 điểm

| Điểm | Mô tả |
| --- | --- |
| 13-15 | Tests bám theo contract: từng error type, ownership rule (dữ liệu của user khác phải trả status mà contract quy định), và paging hoặc idempotency khi áp dụng. Tests chạy trong required CI. Có bằng chứng cho một deliberate break: commit hoặc PR trong đó code vi phạm contract khiến CI đỏ. |
| 8-12 | Tests chạy trong CI, bao phủ success path và một số errors, nhưng chưa từng chứng minh tests fail. |
| 3-7 | Có tests nhưng chỉ kiểm tra status codes, hoặc không chạy trong CI. |
| 0-2 | Không có, hoặc tests được sửa cùng commit với code chỉ để pass mà không có thay đổi contract. |

## 7. AI-LOG.md - 5 điểm

| Điểm | Mô tả |
| --- | --- |
| 5 | Nêu công cụ nào được dùng cho phần nào, có các entry `Changed` / `Rejected` thực tế. Ví dụ: CI step do assistant viết không bao giờ có thể fail, và cách nhóm phát hiện điều đó. |
| 2-4 | Có liệt kê công cụ; `Changed` / `Rejected` trống hoặc chung chung. |
| 0-1 | Không có. |

`Tool: none` là entry hợp lệ nếu nhóm chọn không dùng công cụ nào.

## Những gì phải bàn giao

1. Gắn tag `pa2` cho commit nộp bài và push tag. Giảng viên sẽ checkout tag đó và chạy lại các check.
2. Repository phải public. Red team của nhóm ở PA#4 cũng sẽ đọc repository.
3. Đặt `PA2.md` ở root, chứa các liên kết tới: repository, protected-branch settings (có thể dùng screenshot), PR bị chặn, PR đã chuyển xanh, CI run cho tag và deliberate contract break.

## Cách nộp bài

Một file zip chứa repository, **bao gồm cả `.git`**, đặt tên theo StudentID tăng dần, nối bằng `-`, và tổng điểm nhóm tự chấm:

```text
<StudentID1>-<StudentID2>-<StudentID3>_<total>.zip
```

Ví dụ: `23120001-23120002-23120003_84.zip`. Một thành viên nộp từ tài khoản Google `<StudentID>@student.hcmus.edu.vn`.

Zip phải có `SELF_ASSESSMENT_REPORT.md`: mỗi tiêu chí trong rubric là một dòng, gồm điểm tự chấm và evidence trỏ tới file, commit, PR hoặc CI run. Thêm một đoạn ngắn về **những gì nhóm chưa làm được**. Tổng trong bảng chính là số ghi trong tên file. Template có trên Classroom.

Tên file sai không bị trừ điểm nhưng làm chậm việc trả kết quả: grading script dùng tên đó để đối chiếu bài nộp với danh sách lớp.

## Honesty adjustment

Điểm tự chấm được so sánh với điểm thực tế. Chênh lệch là **tổng điểm tự chấm - điểm thực tế**, trên cùng thang 100 điểm.

| Chênh lệch | Điều chỉnh |
| --- | --- |
| Trong khoảng ±10 | Không điều chỉnh - đây là mức hiệu chỉnh bình thường. |
| +11 đến +20 | -3 điểm. |
| +21 đến +30 | -6 điểm. |
| Lớn hơn +30 | -10 điểm. |
| -21 hoặc thấp hơn | -3 điểm - đọc rubric trước khi tự hạ điểm. |
| Không có `SELF_ASSESSMENT_REPORT.md` | -10 điểm; bỏ qua tổng điểm ghi trong tên file. |

Một tiêu chí được tự nhận điểm nhưng không có dòng evidence sẽ được tính là **đã nhận là làm nhưng chưa làm** khi so sánh này.

Điều chỉnh không bao giờ khiến điểm bài nộp thấp hơn 0.

> Lưu ý đối chiếu nguồn: rubric gốc không nêu mức điều chỉnh cho chênh lệch -11 đến -20; bản dịch không tự bổ sung quy định.

## Quy đổi 100 điểm sang điểm môn học

PA#2 chiếm 4% điểm môn học: 100 điểm ở bài này tương ứng 4% điểm môn học; 75 điểm tương ứng 3% (0,3 điểm trên thang 10).
