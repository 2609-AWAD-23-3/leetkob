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
