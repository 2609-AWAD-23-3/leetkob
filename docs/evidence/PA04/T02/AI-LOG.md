# AI log — PA04-T02

## 2026-11-27 — G5: không lấy mức trừ từ model

Tool: Claude Code (desktop app).
Asked for: Vượng giao T02 theo plan PA04 và Issue #55: đọc yêu cầu và hiện trạng code, chốt G2 dùng evidence dạng `{line, text}`, rồi làm từng guardrail theo thứ tự G5, G1, G2, G3; mỗi guardrail dừng lại cho Vượng review rồi mới commit, vì rubric chấm "mỗi guardrail và test trong commit riêng, test không muộn hơn code".
Kept: Theo quyết định G5 trong plan PA04: schema gửi qua `output_config.format` giữ `additionalProperties: false`; chỉ bước kiểm phía nhóm (`parseModelOutput`) đổi từ đòi đúng bộ key (`hasExactKeys`) sang chỉ đòi đủ field bắt buộc (`hasRequiredKeys`), nên field lạ như `deduction` bị bỏ qua và verdict được giữ. Thiếu field hoặc sai kiểu vẫn là `schema_error` (G1).
Changed: Test viết và chạy trước code: 4 test đỏ (3 test G5 và nhánh e2e có `deduction: 0`), sau khi sửa code 74/74 xanh. Ba trường hợp test PA03 đòi field lạ thành `schema_error` được thay bằng test G5, vì yêu cầu đã đổi theo plan, không phải để test xanh. Thêm nhánh e2e: model trả `deduction: 0` và lời dặn chấm điểm, review item vẫn hiện mức trừ TA đặt.
Rejected: Giữ kiểm chặt và chấp nhận `schema_error` (làm bài đúng thành `unsure`, đẩy unsure rate lên ở tiêu chí 2); bỏ `additionalProperties: false` khỏi schema gửi model (structured output cần nó).
By hand: Vượng chốt thứ tự làm và cách review từng guardrail. Claude viết test, sửa `schema.ts`, chạy: lint, format-check, type-check, `git diff --check` exit 0; `npm test` 571 test, 568 pass, 3 skipped.

## 2026-11-27 — G5 sau review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review G5 (chưa commit): comment của `parseModelOutput` trỏ tới bảng quy tắc PA03-T08 đã lỗi thời (dòng 73: field thừa là `schema_error`); chưa có evidence G5 (lý do bỏ 3 test cũ, kết quả thử xoá guardrail); lưu ý G2 phải đọc phần tử evidence bằng `hasRequiredKeys`; lời dặn chấm điểm trong `reason` vẫn hiện cho TA (không bắt buộc).
Kept: Không sửa evidence PA03 (lịch sử). Ghi trong evidence T02 rằng G5 thay dòng 73 của T08. Giữ nguyên chữ `reason`, ghi là giới hạn đã biết.
Changed: Comment của `parseModelOutput` trỏ sang evidence PA03-T08 và PA04-T02. Thêm mục G5 trong README evidence. Chạy lại hai lần thử xoá guardrail đúng như Vượng mô tả: quay về kiểm field chặt thì 4 test đỏ; chép field lạ vào kết quả thô thì không test nào đỏ, vì kết quả đã parse được dựng theo tên field.
Rejected: Thêm test cho trường hợp "chép field lạ vào kết quả thô" (hành vi do cấu trúc code bảo đảm, test sẽ chỉ kiểm lại cách dựng object); lược lời dặn chấm điểm khỏi `reason` trong G5 (ngoài yêu cầu rubric).
By hand: Vượng tìm ra các điểm trên khi review. Claude sửa comment, viết evidence, chạy lại kiểm xoá guardrail và quality checks.

## 2026-11-27 — G1: schema

Tool: Claude Code (desktop app).
Asked for: Vượng bảo làm G1 sau khi commit G5, dừng lại cho review trước khi commit.
Kept: Không sửa code G1: `parseModelOutput` từ PA03-T08 đã bắt JSON hỏng, code fence, văn xuôi, verdict lạ, constraint thiếu và trùng. Commit G1 chỉ thêm test cho các trường hợp rubric nêu mà test PA03 chưa có.
Changed: Vì test thêm vào xanh ngay, thêm một test đối chứng (cùng JSON không bọc thì được nhận) và thử xoá từng phần của guardrail: cắt JSON theo ngoặc ngoài cùng (6 fail), bỏ kiểm verdict (3), coi constraint thiếu là `pass` (4), cho phép constraint trùng (2); mỗi lần đúng test G1 tương ứng đỏ.
Rejected: Gộp các trường hợp verdict lạ, thiếu, trùng vào một test (khi đỏ không biết phần nào hỏng); sửa code G1 chỉ để commit có code (không có gì cần sửa).
By hand: Vượng sẽ review trước khi commit. Claude viết test, chạy kiểm xoá guardrail và quality checks.

## 2026-11-27 — G1 sau review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review G1 (chưa commit): log thử xoá guardrail còn đường dẫn local trong stack trace, kể cả `g5-exact-keys.log` đã commit ở G5; log không ghi patch tạm nên không chạy lại được; commit G1 chỉ có test nên README cần ghi nguồn gốc code và thứ tự commit test/code ở PA03 (Vượng đã kiểm `bc2b7d1` là tổ tiên của `d4e93e7`).
Kept: Không gộp sửa log G5 vào commit G1: sửa ở một commit docs riêng ngay sau G5, để commit G1 chỉ chạm G1. Kết quả các lần thử không đổi (G5: 4 và 0 test đỏ; G1: 6, 3, 4, 2).
Changed: Viết script chạy thử xoá guardrail: áp patch tạm, build, chạy test, ghi đầu log gồm việc thử, commit nguồn, lệnh, exit code, test đỏ và patch (`git diff`), thay đường dẫn local bằng `<repo>`, rồi khôi phục file và kiểm nội dung. Tạo lại 2 log G5 (commit docs riêng) và 4 log G1. README ghi định dạng log và, ở mục G1, hai hash PA03 cùng thứ tự test trước code. Trước đó Claude đã nói nhầm với Vượng rằng test PA03 vào sau code; kiểm bằng `git merge-base` cho thấy ngược lại. Commit docs của log G5 lần đầu lọt khoảng trắng cuối dòng vì lệnh commit chạy tiếp dù `git diff --check` báo lỗi; đã sửa script và gộp vào chính commit docs đó (chưa push).
Rejected: Sửa log G5 trong commit G1 (trộn guardrail); viết lại commit G5.
By hand: Vượng tìm ra ba điểm khi review và kiểm thứ tự commit PA03. Claude viết script, tạo lại log, sửa README và chạy kiểm tra.

## 2026-11-27 — G2: evidence

Tool: Claude Code (desktop app).
Asked for: Vượng bảo làm G2 sau khi commit G1, theo quyết định đã chốt: evidence dạng `{line, text}`; lưu ý từ review G5: phần tử evidence phải đọc bằng `hasRequiredKeys` và có test cho `deduction` nằm trong một phần tử evidence.
Kept: So `text` với dòng đã làm sạch (thứ model thấy), chỉ bỏ khoảng trắng hai đầu; một dòng lệch là cả verdict `unsure`/`evidence_mismatch`, với mọi verdict; text TA thấy lấy từ code gốc cùng số dòng. Phần tử evidence đọc bằng `hasRequiredKeys`.
Changed: Test viết trước và chạy đỏ (47 test trên toàn bộ, vì worker, checker và e2e dùng chung model giả). Để các test có sẵn không phải biết text từng dòng, helper `result()` hiểu số `n` là "model trích đúng dòng `n`": ghi chỗ giữ `@@quote:n@@`, model giả thay bằng dòng `n` lấy từ prompt. Bỏ phép kiểm dòng trống trong `toVerdict` vì parser đã kiểm cho mọi verdict. Thêm hai lần thử xoá guardrail ngoài so text và dòng trống: chỉ kiểm phần tử đầu tiên, và kiểm chặt key của phần tử evidence (G5 thủng ở tầng dưới); cả hai đều làm test tương ứng đỏ.
Rejected: So text theo chuỗi con hoặc gộp khoảng trắng bên trong dòng (lỏng hơn chữ "exactly" của rubric); so với dòng gốc (model không thấy comment và tên thật, sẽ trừ oan câu trả lời đúng); sửa từng test có sẵn để ghi text của dòng (nhiều chỗ, dễ sai, và test phải biết chi tiết làm sạch code); chạy model thật ngay ở G2 (để cuối T02, gắn với SHA cuối).
By hand: Vượng chốt dạng evidence và nêu lưu ý về `hasRequiredKeys`; sẽ review trước khi commit. Claude viết test, helper, code, evidence và chạy: lint, format-check, type-check exit 0; `npm test` 599 test, 596 pass, 3 skipped; 4 lần thử xoá guardrail.

## 2026-11-27 — Chạy thử G2 với model thật trước khi commit

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi code G2 chưa đo với model thật thì có sao không; Claude nêu hai rủi ro test giả không bắt được (provider từ chối schema `{line, text}`, và `evidence_mismatch` đẩy unsure lên). Vượng cho chạy thử và thêm evidence.
Kept: Chạy một lần trên `eval-cases` từ working tree G2 (nền `3bc2c16`), lưu ở `g2-precommit-run/`, ghi rõ là kiểm tra trước commit; lần chạy chính thức trên case riêng và dev set vẫn để cuối T02.
Changed: So với lần chạy trước G2 (T04, `4f2c158`) bằng script: verdict giống 49/49, không cặp nào `evidence_mismatch`, chi phí +7.6%, evidence của model hẹp hơn (cặp `pass` có dòng từ 12 xuống 1). Bản nháp evidence đầu ghi sai hai số (0 cặp `pass` có dòng, 12 quyết định ban-list); Claude đếm lại bằng script trước khi ghi vào README (1 và 22).
Rejected: Quy việc evidence hẹp hơn cho riêng G2 (rule 3 của prompt đổi cùng lúc, và chỉ có một lần chạy).
By hand: Vượng quyết định chạy thử. Claude chạy checker với `node --env-file=.env` (không in key), `eval.mjs`, script kiểm call log và so sánh: 22 call `ok`, 22 request id `req_…`, `PASS`, $0.005938.

## 2026-11-27 — G3: timeout

Tool: Claude Code (desktop app).
Asked for: Vượng bảo commit G2 rồi làm G3, dừng lại cho review trước khi commit.
Kept: Không sửa code G3: `callWithDeadline` từ PA03-T08 đã giữ hạn cứng phía evaluator và đổi timeout thành `unsure`/`timeout`. Commit G3 chỉ sửa và thêm test.
Changed: Thêm giới hạn 2 s cho mỗi test G3, vì khi bỏ hạn cứng thì test "model không bao giờ trả lời" sẽ treo thay vì đỏ. Đổi tên bốn test timeout PA03 thêm tiền tố `G3`, giữ nguyên nội dung kiểm. Thêm test một `violation` hợp lệ đến sau hạn không được dùng. Hai lần thử xoá guardrail: bỏ hạn (4/5 đỏ; tiến trình phải dừng bằng giới hạn 120 s của script vì bộ hẹn giờ của bản sửa tạm) và không đổi timeout thành `unsure` (5/5 đỏ).
Rejected: Sửa code G3 chỉ để commit có code (không có gì cần sửa); dùng giới hạn thời gian toàn cục cho cả file test (ảnh hưởng test khác, che mất test nào treo).
By hand: Vượng sẽ review trước khi commit. Claude viết test, chạy kiểm xoá guardrail và quality checks.

## 2026-11-28 — Chạy model thật tại commit cuối và tổng kết T02

Tool: Claude Code (desktop app).
Asked for: Vượng bảo commit G3 rồi chạy model thật chính thức và viết tổng kết evidence T02.
Kept: Chạy một lần mỗi dataset (`eval-cases`, dev set) tại `4877b86`, working tree sạch, lưu ở `model-run/`. Ghi kết quả như đo được, kể cả khi xấu hơn lần trước.
Changed: Lần này `eval-cases` có 1 cặp `unsure`: `digit-sum/s06` C2, một vi phạm thật, bị G2 hạ thành `evidence_mismatch` (recall 93.3%, vẫn `PASS`). Claude so với ba lần chạy trước (đều trích đúng dòng 9 và 10) và nhận ra call log của checker không lưu câu trả lời hay `reason` của model, nên không biết dòng nào lệch; ghi giả thuyết escape `\n` là chưa kiểm chứng, và ghi việc thiếu `reason` trong call log là giới hạn, ngoài scope G2. Dev set khác PA03 đúng một cặp (`reverse-words/s04` C2, khấu trừ sai duy nhất của PA03, nay đúng label); không quy cho guardrail vì một lần chạy và prompt đã đổi. Bản nháp tổng kết ghi tổng số cặp sai ("151"); sửa thành 200 cặp của ba lần chạy sau G2 trước khi ghi vào README.
Rejected: Chạy lại để có lần không bị `evidence_mismatch` (chọn số đẹp); sửa G2 cho lỏng hơn khi chưa biết nguyên nhân; thêm `reason` vào call log của checker trong commit tổng kết (đổi code ngoài G2, cần Vượng quyết).
By hand: Vượng quyết định chạy. Claude chạy `npm run build`, checker với `node --env-file=.env` (không in key), `eval.mjs`, script kiểm call log và so sánh: `eval-cases` 22 call, dev set 39 call, đều `ok`, mỗi call một request id `req_…`, cả hai `PASS`, tổng $0.016379.

## 2026-11-28 — Quyết định về `evidence_mismatch` và mở PR

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi có nên sửa điểm `evidence_mismatch` của `digit-sum/s06` không, rồi bảo cập nhật trạng thái commit và PR và mở PR.
Kept: Không nới G2 khi chưa biết nguyên nhân (G2 hạ về `unsure`, không trừ oan, TA vẫn review); 1 cặp trên 200 cặp chưa đủ lý do đổi quy tắc.
Changed: Việc ghi `reason` của verdict `unsure` vào call log của checker chuyển sang T08, vì thay đổi nằm ở `src/cli/run.ts` chứ không ở guardrail, và T08 là việc chuẩn bị cho lần chạy held-out. README cập nhật trạng thái (đã push, mở PR) và việc chuyển tiếp này.
Rejected: Sửa trong PR T02 (trộn phần checker vào PR guardrail); nới G2 ngay (đi ngược "exactly" của rubric và có thể mở lỗ cho dòng bịa).
By hand: Vượng quyết định hướng xử lý và cho mở PR. Claude cập nhật evidence, commit, push và mở PR.

## 2026-11-28 — Sửa evidence theo review của Vỹ trên PR #92

Tool: Claude Code (desktop app).
Asked for: Vượng bảo kiểm review của Vỹ. Vỹ (comment, không chặn merge) nêu hai nit: PR ghi `npm test` tại `442b4e8` là 600/597/3 nhưng không có log, còn README ghi 599 ở G2; README nói test G5 đỏ 4 khi chưa có code nhưng không có log như G2.
Kept: Không sửa code hay test. Số liệu đã ghi đều đúng; chỉ thiếu log làm bằng chứng.
Changed: Chạy lại `npm test` tại `442b4e8` và lưu log (600 test, 597 pass, 3 skipped vì không có `TEST_DATABASE_URL`); README ghi số test sau từng commit (571, 582, 599, 600) để thấy 599 là sau G2 và 600 là sau G3. Tái hiện lần chạy đỏ của G5 trong một git worktree tạm: test ở `d8c8423`, `schema.ts` lấy từ `977c2bc` (trước G5); kết quả 4 fail đúng như README, lưu ở `red/g5-tests-before-code.txt` và ghi rõ là tái hiện ngày 28/11, lần chạy đỏ ngày 27/11 không được lưu. Worktree tạm dùng liên kết tới `node_modules` của repo; gỡ liên kết trước rồi mới xoá worktree để không đụng thư mục thật.
Rejected: Ghi log G5 như thể chụp từ lần chạy ngày 27/11; sửa số trong README cho khớp mà không chạy lại.
By hand: Vỹ tìm ra hai điểm khi review. Claude chạy lại, tái hiện, viết log và sửa README; Vượng sẽ duyệt trước khi commit.

## 2026-11-28 — Test khoá nhánh kiểm phạm vi dòng của G2

Tool: Claude Code (desktop app).
Asked for: Vỹ approve PR #92 và nêu một nit không chặn merge: bỏ kiểm dòng nằm trong file ở `findEvidenceMismatch` thì không test nào đỏ. Vượng hỏi nên merge luôn hay thêm test, rồi chọn thêm test, nhờ Vỹ review lại và merge nếu đạt.
Kept: Không sửa code G2; hành vi dòng ngoài file vẫn là `unsure`/`evidence_mismatch`.
Changed: Thêm test G2 kiểm lý do `line N is outside the file (1..10)` cho dòng 0, 11, -1 với cả ba verdict và cho dòng 99 lẫn giữa dòng đúng. Thử bỏ nhánh kiểm phạm vi: đúng test này đỏ, log có patch ở `removal/g2-no-range-check.log`. README mục G2 thêm dòng vào bảng thử xoá guardrail và đoạn giải thích.
Rejected: Merge mà không thêm test (rubric trừ điểm khi có test không thể fail, và người chấm có thể xoá đúng nhánh này); sửa test PA03 về dòng ngoài file thay vì thêm test G2 riêng (giữ test PA03 nguyên như lịch sử).
By hand: Vỹ tìm ra điểm này khi review. Claude viết test, chạy kiểm xoá guardrail, cập nhật evidence, commit và nhờ Vỹ review lại.

## 2026-11-28 — G2 chấp nhận bản trích chỉ mất escape JSON

Tool: Claude Code (desktop app).
Asked for: Sau chẩn đoán ở T08 bước 5, Vượng hỏi việc sửa G2 có mất điểm ở tiêu chí nào không, rồi bảo sửa theo hướng G2 chấp nhận đúng một biến đổi: dòng code sau khi giải escape JSON.
Kept: Làm ở nhánh riêng từ `develop` (`fix/pa04-t02-g2-json-escape`), commit chỉ chạm G2, test trước. Giữ nguyên các test G2 cũ và bốn log thử xoá đã được review.
Changed: Viết 4 test (2 đỏ trước khi sửa, 2 canh các trường hợp vẫn phải lệch), thêm `decodeJsonEscapes`, so text với dòng gốc rồi với dòng đã giải escape. Thử xoá hai chiều. Lần đầu dòng sửa tạm "nới lỏng" mất dấu `\` qua shell (`/\s+/g` thành `/s+/g`) nên kết quả vô nghĩa; viết spec ra file rồi chạy lại. Cũng phát hiện script thử xoá in patch so với HEAD, nên khi code chưa commit patch có cả thay đổi thật; sửa script so với file đang có trên đĩa và ghi chú bốn log G2 cũ bị ảnh hưởng. Trong lúc chạy kiểm, lệnh `git add -N .` đụng tới `marking.env` vì nhánh tách từ `develop` chưa có quy tắc ignore của T08; đã kiểm file chưa vào index hay commit nào, thêm `marking.env` vào `.git/info/exclude` của máy, và từ đó chỉ thêm file theo đường dẫn cụ thể. Chạy lại model thật: `eval-cases` và dev set đều `PASS`; 10 call trên dòng 9 có 5 phần tử mất escape, cả 10 giữ `violation` qua G2 mới.
Rejected: So lỏng (bỏ khoảng trắng, chuỗi con) vì đi ngược "exactly" và mở đường cho dòng bịa; sửa bốn log G2 cũ bằng tay; dặn trong prompt thay cho sửa G2 (thuộc T06, không chắc model làm theo).
By hand: Vượng quyết hướng sửa và sẽ review trước khi commit. Claude viết test, code, chạy kiểm tra, thử xoá, chạy model thật ($0.018692) và viết evidence.
