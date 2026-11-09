# T02 — Bằng chứng kiểm chứng nền dữ liệu publish

**Thực hiện:** Vượng / @vinny2707. **Reviewer độc lập:** Vỹ / @tranquocvy.
**Task:** [Issue #2](https://github.com/2609-AWAD-23-3/leetkob/issues/2), [tiêu chí PA02](../../../plans/PA02.md#t02--data-foundation).

**PR review:** [#18 vào develop](https://github.com/2609-AWAD-23-3/leetkob/pull/18), đã yêu cầu @tranquocvy review. Yêu cầu review chưa phải approval; vẫn còn xác nhận bàn giao, review và tích hợp.

**Source đã kiểm thử:** [94d9e22057a2d5d5f0db21fa61147bc7c00e4f6f](https://github.com/2609-AWAD-23-3/leetkob/commit/94d9e22057a2d5d5f0db21fa61147bc7c00e4f6f), nhánh feat/t02-publish-state, phát triển từ develop tại 9ac6bf5. Các lệnh kiểm tra chạy trên source ngay trước commit implementation này; không sửa source/tests giữa lần kiểm chứng thành công trên runtime baseline và commit. Các chỉnh sửa evidence/plan sau đó chỉ thay tài liệu.

[verification.json](verification.json) lưu kết quả quan sát và SHA-256 của file source tại lần kiểm chứng. Không tự gán timestamp từng lệnh hoặc nhận đã kiểm thử trên bản clone sạch. Giữ nguyên tên trường, giá trị và dữ liệu lịch sử trong JSON khi dịch tài liệu sang tiếng Việt.

## 1. Kết quả kiểm chứng

Ngày kiểm chứng local: 09/11/2026, múi giờ Asia/Bangkok; tương ứng ngày UTC 08/11/2026. Môi trường Windows x64.

| Lệnh/kiểm tra | Kết quả thực tế |
| --- | --- |
| npm.cmd ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 | Exit 0, cài 55 packages theo lockfile có sẵn; lúc cài dùng Node 24.14.0/npm 11.9.0 nên có cảnh báo engine của repo |
| npm run build với Node 24.22.1/npm 11.19.1 | Exit 0 |
| node --test tests/data/publish-store.test.mjs tests/smoke/app.test.mjs với Node 24.22.1 | Exit 0; 47 đạt, 0 lỗi/bỏ qua/hủy: 40 data tests và 7 smoke tests T01 |
| git diff --check trước commit implementation | Exit 0 |

Build và các lượt chạy riêng data/smoke ban đầu cũng đạt trên Node hệ thống 24.14.0. Do phiên bản này thấp hơn mức repo yêu cầu, đã chạy lại build và bộ tests kết hợp bằng Node 24.22.1/npm 11.19.1 cài trong thư mục tạm; không thay runtime hệ thống. Dependencies và lockfile không bị đổi cho lượt chạy lại.

Lần tải ZIP portable từ nodejs.org không hoàn tất và đã dừng; sau đó cài đúng phiên bản node-win-x64 và npm qua npm registry thành công. Lần cài dependencies trong sandbox ban đầu cũng bị dừng do không có tiến triển; lần chạy được cấp quyền tiếp theo thành công. Đây là các vấn đề setup đã gặp; không sửa assertion để che lỗi tests.

## 2. Đối chiếu yêu cầu với tests

| Yêu cầu | Bằng chứng trong tests |
| --- | --- |
| Lookup lab–class và TA nhiều lớp | Lookup đúng lớp, lab thiếu, membership khác lớp trả false |
| Mọi mục queue cần quyết định TA | Pending với verdict pass, violation và unsure; bỏ qua pending thuộc lab khác |
| Deadline và từ chối không ghi state | Trước hạn 1 ms / đúng hạn / sau hạn 1 ms; ưu tiên lỗi chưa đến hạn trước pending |
| Công bố cả lab và lưu summary | Đếm quyết định TA, bao gồm override verdict và unsure đã được quyết định; queue rỗng |
| Gọi lặp an toàn | Đổi người publish; không đọc lại clock kể cả clock ném lỗi; publication seed vẫn giữ nguyên khi clock lùi trước hạn |
| Hai lời gọi cạnh tranh trong cùng instance | Hai lời gọi đồng bộ được lên lịch bằng Promise: một published, một already_published, cùng giá trị publication |
| Lifecycle độc lập | Hai factory; reset bằng seed/reset về rỗng; fixed clock trả Date mới |
| Bản sao bảo vệ state | Sửa seed, lab/review/publication lấy ra hoặc summary không ảnh hưởng dữ liệu bên trong |
| Fixture sai | Các ca trùng, tham chiếu, enum, ID, timestamp, publication, summary; reset lỗi giữ publication/membership cũ |
| Lỗi lập trình/clock | Publisher sai, Date sai, giá trị không phải Date hoặc clock ném lỗi đều không tạo publication |

## 3. Cách chạy lại

Từ thư mục gốc repo, khi Node 24.22.1 và npm 11.19.1 đã có trên PATH:

~~~powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run build
node --test tests/data/publish-store.test.mjs tests/smoke/app.test.mjs
git diff --check
~~~

npm.cmd dùng được khi PowerShell chặn npm.ps1. Tests import file đã biên dịch trong dist nên phải build trước. Clock/ID của tests cố định; không cần model thật, database hoặc dữ liệu người dùng thật.

Nếu máy vẫn dùng Node hệ thống 24.14.0, có thể dùng runtime tạm đã cài, khi thư mục này còn tồn tại. Các lệnh chỉ thay PATH của cửa sổ PowerShell hiện tại:

~~~powershell
$t02Tools = "$env:TEMP\leetkob-t02-runtime-24.22.1\npm-tools\node_modules"
$env:PATH = "$t02Tools\node-win-x64\bin;$env:PATH"
node --version
node "$t02Tools\npm\bin\npm-cli.js" --version
node "$t02Tools\npm\bin\npm-cli.js" run build
node --test tests/data/publish-store.test.mjs tests/smoke/app.test.mjs
~~~

Kết quả phiên bản mong đợi: Node v24.22.1, npm 11.19.1. Tests mong đợi: tổng 47, pass 47, fail 0. Thư mục tạm không phải dependency bắt buộc của repo; reviewer có thể tự cài runtime đúng phiên bản.

## 4. Bàn giao và các điều kiện còn thiếu

- **Phúc/T03/T08:** [model, interface và ví dụ](../../../architecture/data-model.md), [exports](../../../../src/data/index.ts), [fixtures](../../../../src/data/fixtures.ts). Xác thực và phân quyền TA trước khi gọi store. PublishResult là kết quả nội bộ; T03/T08 ánh xạ sang HTTP. Summary chỉ thống kê review. Ví dụ pending → resolved dùng reset fixture, chưa tạo endpoint duyệt bài.
- **Vỹ/T01/T04:** tạo store riêng cho mỗi app/test; chỉ inject PublishStore vào module publish; giữ reset ở setup; tích hợp lệnh data tests vào harness chung. T02 không sửa manifest, lockfile, app composition, README setup hoặc runner chung.
- **Giới hạn storage:** không có lưu trữ bền vững, khôi phục sau restart, chia sẻ giữa process hoặc bảo đảm concurrency phân tán. Clock phải tin cậy và không gọi ngược vào store. Không có side effect bên ngoài hoặc chức năng unpublish.
- Đã có tài liệu bàn giao; chưa xác nhận consumer tiếp nhận/wiring hoặc reviewer đã chạy độc lập. Mục thực hiện thứ năm và cả hai mục review vẫn chưa đánh dấu.
- Các kết quả trên chưa chứng minh HTTP contract/auth, toàn bộ lint/format/harness T04, CI, Linux/clone sạch, approval, merge hoặc đóng task. T02 vẫn mở để hoàn tất bàn giao/review/tích hợp.

[Đầu vào AI-log](AI-LOG.md) dành cho T11 tổng hợp, không thay các báo cáo milestone bắt buộc ở root.
