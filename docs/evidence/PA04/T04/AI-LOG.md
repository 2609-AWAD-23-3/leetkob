# AI log — PA04-T04

## 2026-11-26 — Thiết kế và viết case riêng (chưa commit)

Tool: Claude Code (desktop app).
Asked for: Vượng giao T04 theo plan PA04 và Issue #57: nâng case riêng lên ≥ 10 lời giải, phủ `trap`, `injection`, `disguised`; làm theo hướng đúng nhất, không vì hạn; không commit để Vượng review trước.
Kept: Nguyên tắc case viết độc lập với checker: label ghi theo đề và constraint, kèm lý do, trước khi chạy checker. Thêm bài mới `mod-power` thay vì nhồi thêm vào `digit-sum`. Giới hạn `b ≤ 10^6` để lời giải nhân `b` lần vẫn Accepted, nên C2 là ràng buộc test không bắt được. Sửa test trước (đỏ `only 6 solutions`) rồi mới thêm case.
Changed: Câu C2 ban đầu dự định nêu đích danh kiểu "tính nửa lũy thừa hai lần"; đổi thành câu tổng quát ("Code that still performs about `b` multiplications, however it is structured, does not satisfy this constraint") để label của `s05` vẫn rõ mà constraint không mớm sẵn cách nhận ra case `disguised`. Đáp án `.out` tính bằng Python `pow(a, b, m)` thay vì chạy một lời giải C++, để không có lời giải nào vừa là đáp án vừa là case. Đường dẫn local trong báo cáo `eval.mjs` được thay bằng `<repo>`.
Rejected: Chọn case dựa vào việc hard rules hay model có bắt được hay không. Thêm khối `#if 0` chứa `std::pow` làm trap ban-list, vì "dead code có tính là use không" làm label gây tranh cãi. Dùng `std::pow(2.0, k)` thật cho case disguised (dễ đọc ra ngay, không còn là disguised). Chạy model thật trước khi case được commit.
By hand: Vượng chốt cách làm và review trước khi commit. Claude viết test, đề, constraint, 6 lời giải, label, lý do label, evidence, và chạy lệnh: lint, format-check, type-check exit 0; `npm test` 570 test, 567 pass, 3 skipped; `verify-eval-cases.mjs` 12/12 Accepted; checker `MODEL_OFF=1` rồi `eval.mjs`: 0 khấu trừ sai, recall 33.3%, unsure 50.0%.

## 2026-11-27 — Sửa câu C2 theo review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review bản local và chỉ ra câu C2 không khớp label của `mod-power/s03`: C2 viết "each step squares the base … and halves the exponent", còn `s03` bình phương `result` và duyệt bit của `b` từ cao xuống; label `pass` đúng về bản chất.
Kept: Label `s03` C2 vẫn là `pass`. Tiêu chí thật của C2 là số phép nhân tăng theo số bit của `b`.
Changed: Câu C2 lấy số phép nhân làm tiêu chí chính và liệt kê ba thứ tự hợp lệ (bình phương base và chia đôi số mũ; bình phương kết quả và đọc bit từ cao xuống; bình phương nửa lũy thừa tính một lần). Đối chiếu lại cả 6 lời giải với câu mới: không label nào đổi. Lỗi nằm ở câu chữ do Claude viết: bản đầu tả một cách cài đặt thay vì tiêu chí, và Claude không đối chiếu lại câu chữ với từng lời giải sau khi viết xong `s03`.
Rejected: Đổi label `s03` C2 thành `violation` cho khớp chữ (sai bản chất, sẽ thành khấu trừ oan một lời giải đúng); sửa `s03` cho giống câu C2 cũ (làm mất thứ tự cài đặt thứ hai khỏi bộ case).
By hand: Vượng tìm ra lỗi. Claude sửa `constraints.json` và evidence, chạy lại: lint, format-check, type-check, `git diff --check` exit 0; `npm test` 570 test, 567 pass, 3 skipped; checker `MODEL_OFF=1` rồi `eval.mjs` cho kết quả giống lần trước.

## 2026-11-27 — Chạy checker với model thật trên case riêng

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi có nên chạy model thật để cập nhật evidence không và chạy test với model thật.
Kept: Chạy một lần, sau khi case và label đã commit (`ef753a2`), để evidence có source SHA và lịch sử cho thấy case có trước kết quả. Kết quả chỉ ghi vào evidence, không dùng để đổi case hay label.
Changed: Khi kiểm call log, Claude thấy mọi prompt đều đã bỏ comment, nên injection và trap nằm trong comment không tới được model. Evidence ghi rõ phần này do sanitizer chặn, chỉ chuỗi injection của `mod-power/s04` thật sự thử model, để không báo "model chống được injection" quá mức.
Rejected: Chạy nhiều lần để lấy số đẹp nhất; ba lần chạy lặp để đo độ ổn định là việc của T05.
By hand: Vượng quyết định chạy. Claude chạy `npm run build`, checker với `node --env-file=.env` (không in key), `eval.mjs`, và script kiểm call log: 12 call `ok`, 12 request id `req_…` khác nhau, `eval.mjs` exit 0 (`PASS`), 0 khấu trừ sai, recall 100%, unsure 0%, chi phí $0.002991.

## 2026-11-27 — Thêm hai bài `above-mean` và `rotate-array`

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi có nên thêm vài bài khác không, rồi giao thêm hai bài và giữ lại để tự review trước khi commit.
Kept: Chọn bài theo loại constraint case riêng còn thiếu so với dev set (cấm từ khoá vòng lặp, cấm container, làm tại chỗ với bộ nhớ phụ hằng số, giải phóng bộ nhớ, bài 3 constraint), đề tài khác 6 bài dev set, không chép câu chữ hay code. Thêm injection qua tên biến và string literal, chỗ sanitizer không xoá, vì lần chạy model thật trước cho thấy injection trong comment không tới được model. Giới hạn `n ≤ 2000` (`above-mean`) để lời giải vi phạm C2 vẫn Accepted. Label và lý do ghi trước khi chạy checker.
Changed: Thêm câu cuối cho `above-mean` C2 ("loops are covered by C1") và `rotate-array` C3 ("Whether a second buffer is allowed at all is decided by C2") trước khi gán label, để một lỗi không bị hai constraint cùng trừ và label của `above-mean/s03` C2, `rotate-array/s03` C3, `rotate-array/s05` C3 không mơ hồ. Đây là bài học từ lần sửa câu C2 của `mod-power`.
Rejected: Thêm bài có đề giống dev set rồi đổi số liệu; dùng `delete` thay `delete[]` làm vi phạm C3 (hành vi không xác định, label dễ cãi); để injection chỉ trong comment.
By hand: Vượng duyệt hướng làm và sẽ review trước khi commit. Claude viết đề, constraint, test (Python, seed `20261127`), 10 lời giải, 25 label, lý do, evidence, và chạy: lint, format-check, type-check exit 0; `npm test` 570 test, 567 pass, 3 skipped; `verify-eval-cases.mjs` 22/22 Accepted; checker `MODEL_OFF=1` rồi `eval.mjs`: 0 khấu trừ sai, recall 26.7% (4/15), unsure 55.1% (27/49). Chưa chạy model thật trên hai bài mới.

## 2026-11-27 — Sửa câu C2 của `rotate-array` theo review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng chỉ ra `rotate-array/s01` có label C2 `pass` nhưng `gcd_of` đệ quy dùng stack O(log n); C2 viết "constant amount of extra memory", nên một model đọc sát chữ có thể chấm vi phạm, thành trừ oan.
Kept: Label `s01` C2 vẫn `pass`: `gcd_of` chỉ đệ quy trên số đếm, không giữ giá trị nào của mảng, đúng ý của C2 (xoay tại chỗ). Không sửa `s01` thành `gcd` lặp, vì như vậy chỉ né câu hỏi chứ không làm constraint rõ hơn.
Changed: Câu C2 định nghĩa "bộ nhớ phụ" là bộ nhớ giữ giá trị của mảng: biến vô hướng và call stack của hàm phụ không giữ giá trị thì được; giữ nhiều hơn một số hằng giá trị ngoài khối thì vi phạm, kể cả khi rải qua các lần gọi đệ quy (để đệ quy giữ mỗi tầng một giá trị không lọt). Đối chiếu lại 5 lời giải: không label nào đổi. Thêm tag `trap` cho `s01` C2 vì đây đúng là code hợp lệ mà một kiểm tra đọc theo nghĩa đen sẽ trừ oan. Lỗi nằm ở câu chữ do Claude viết; đây là lần thứ hai một câu constraint tả hình thức thay vì ý định (lần đầu là C2 của `mod-power`).
Rejected: Đổi label `s01` C2 thành `violation` (trừ oan một lời giải đúng); viết lại `gcd_of` thành vòng lặp.
By hand: Vượng tìm ra lỗi. Claude sửa `constraints.json`, tag trong `labels.jsonl`, evidence, rồi chạy lại các kiểm tra (kết quả ở mục 5 của README).

## 2026-11-27 — Commit hai bài mới và chạy model thật trên cả 49 cặp

Tool: Claude Code (desktop app).
Asked for: Vượng review xong hai bài mới, cho commit rồi chạy model thật.
Kept: Commit mỗi bài thành hai commit (đề; lời giải và label) rồi một commit evidence, trước khi chạy model, để case có trước kết quả. `labels.jsonl` được tách theo bài khi commit để mỗi commit lời giải chỉ thêm label của bài đó. Chạy một lần trên cả 49 cặp, lưu ở thư mục mới `model-run-full/`, giữ nguyên `model-run/` của lần trước.
Changed: Trước khi commit, Claude thấy commit docs trước đã được làm lại thành `19c1a92` (Vượng sửa câu "Asked for" trong AI-LOG), nên sửa SHA trong mục 6 của README thay vì dẫn tới `c60522e` không còn trên nhánh. Khi kiểm call log, ghi thêm so sánh verdict giữa hai lần chạy trên 24 cặp chung và các chỗ evidence của model rộng hơn label.
Rejected: Gộp hai bài vào một commit; ghi đè `model-run/` bằng lần chạy mới; coi hai lần chạy là bằng chứng ổn định thay cho ba lần chạy lặp của T05.
By hand: Vượng review và quyết định chạy. Claude commit, chạy `npm run build`, checker với `node --env-file=.env` (không in key), `eval.mjs`, script kiểm call log: 22 call `ok`, 22 request id `req_…` khác nhau, `eval.mjs` exit 0 (`PASS`), 0 khấu trừ sai, recall 100% (15/15), unsure 0% (0/49), chi phí $0.005519.
