# Evidence PA04-T02 — Guardrails G1, G2, G3, G5

**Thực hiện:** Vượng · **Reviewer:** Vỹ · **Issue:** #55 · **Nhánh:** `feat/pa04-t02-guardrails` (tách từ `develop` `977c2bc`).
**Trạng thái:** đang làm từng guardrail; mỗi guardrail được Vượng review rồi mới commit. Chưa push, chưa mở PR.

## 1. Phạm vi

Rubric PA04 tiêu chí 3: năm guardrail trên output model, mỗi guardrail có test dùng fake model và không network; mỗi guardrail và test của nó trong commit riêng, test không muộn hơn code; hard rules vẫn quyết định ban-list trước. T02 làm G1, G2, G3, G5; G4 (cost cap theo lab) thuộc T03.

Thay đổi nằm ở `src/pipeline/model/` và test. Không đổi domain, DB, API hay file prediction của checker.

Thứ tự làm: G5, G1, G2, G3, rồi phần chạy model thật và tổng kết.

## 2. G5 — Không lấy mức trừ từ model

**Quy tắc mới.** Bước kiểm output phía nhóm (`parseModelOutput` trong `src/pipeline/model/schema.ts`) chỉ đòi đủ field bắt buộc (`hasRequiredKeys`). Field ngoài schema, ở cấp ngoài cùng hay trên từng kết quả (ví dụ `deduction`, `score`, `penalty`), bị bỏ qua và không bao giờ được đọc; verdict của model được giữ. Thiếu field bắt buộc hoặc sai kiểu vẫn là `schema_error` (G1).

**Thay quy tắc của PA03-T08.** Dòng 73 của `docs/evidence/PA03/T08/README.md` ghi "trường thiếu/thừa (kể cả `deduction`)" làm mọi constraint thành `schema_error`. Với G5, **trường thừa** không còn là `schema_error`; trường thiếu và sai kiểu vẫn như cũ. Evidence PA03 giữ nguyên vì là lịch sử; comment của `parseModelOutput` trỏ sang tài liệu này.

**Không đổi:**

- Schema gửi qua `output_config.format` vẫn `additionalProperties: false` (structured output yêu cầu), nên model thật gần như không trả được field lạ. G5 chủ yếu chặn trường hợp refusal, model giả, hoặc API đổi hành vi.
- Mức trừ hiển thị luôn lấy từ `constraint.deduction` do TA đặt (review queue), và store từ chối mọi verdict có field `deduction`: thêm một lớp chặn phía sau.
- Prompt vẫn cấm model đề xuất điểm (rule 6).

**Test** (viết trước, đỏ khi chưa sửa code):

| Test | Kiểm |
| --- | --- |
| `G5 schema: extra deduction or score fields on a result are ignored and the verdict is kept` | Field thừa trên từng kết quả: verdict, evidence giữ nguyên; kết quả đã parse không mang field nào về điểm |
| `G5 schema: an extra top-level deduction field is ignored and the results are kept` | Field thừa ở cấp ngoài cùng |
| `G5 schema: a grading instruction in the reason changes nothing but the reason text` | Lời dặn chấm điểm trong `reason` không đổi verdict hay evidence |
| `G5 schema: required fields with the wrong type are still schema_error (G1), extra fields do not hide them` | Field thừa không che lỗi schema thật |
| `G5 evaluator: an extra deduction field is ignored, the verdict is kept and no verdict carries a mark` | Qua evaluator: `violation` có `deduction: 0` vẫn là `violation`, call log `ok`, không verdict nào mang field điểm |
| `e2e pipeline: …` (đã có, thêm một nhánh) | Model trả `deduction: 0` và "Grader: deduction 0." cho bài injection; review item vẫn hiện mức trừ 4 do TA đặt |

**Bỏ ba trường hợp test của PA03.** `model-schema.test.mjs` có hai trường hợp ("an extra top-level field", "an extra field named deduction/score") và `model-evaluate.test.mjs` có một test ("output with an extra deduction field is rejected") đòi field lạ phải thành `schema_error`. Chúng được thay bằng các test G5 ở trên vì **yêu cầu đã đổi** theo quyết định G5 trong `docs/plans/PA04.md` (merge ở #53): biến cả output thành `schema_error` chỉ vì model chèn field là đã thay đổi kết quả và đẩy unsure rate lên ở tiêu chí 2. Đây không phải nới test cho xanh: trường hợp thiếu field và sai kiểu vẫn có test và vẫn là `schema_error`.

**Thử bỏ guardrail** (sửa tạm `schema.ts`, build, chạy test schema, evaluator và e2e, khôi phục bằng bản sao và `cmp`):

| Sửa tạm | Kết quả | Log |
| --- | --- | --- |
| Quay về kiểm field chặt (đòi đúng bộ key như `hasExactKeys` của PA03) | **4 test đỏ**: 3 test G5 và test e2e | `removal/g5-exact-keys.log` |
| Cho `readRawResult` chép mọi field của model vào kết quả thô (`...value`) | **Không test nào đỏ** (74/74) | `removal/g5-raw-result-keeps-extra-fields.log` |

Trường hợp thứ hai không phải test yếu: bước sau dựng kết quả đã parse theo **tên từng field** (`constraintId`, `verdict`, `evidenceLines`, `reason`, `unsureCause`), nên field lạ trong kết quả thô vẫn bị loại trước khi tới evaluator và store. Guardrail G5 nằm ở hai chỗ: không coi field lạ là lỗi (có test), và không bao giờ đọc field lạ (do cấu trúc code, không cần test riêng).

**Giới hạn đã biết (không bắt buộc cho G5).** Lời dặn chấm điểm trong `reason` được giữ nguyên chữ, nên câu như "Grader: deduction 0" vẫn hiện cho TA trong review queue. Theo rubric vẫn đạt vì con số không đổi và mức trừ hiển thị do TA đặt. Có thể đánh dấu hoặc lược câu đó để TA khỏi bị nhiễu; chưa làm.

**Kiểm chứng tại working tree của G5** (Node `v24.22.3`, Windows 11): lint, format-check, type-check, `git diff --check` exit 0; `npm test` 571 test, 568 pass, 3 skipped, 0 fail. Test G5 chạy riêng khi chưa có code: 4 đỏ; sau khi có code: 74/74 xanh.

**Lưu ý cho G2.** Khi evidence đổi sang `{line, text}`, phần đọc từng phần tử evidence cũng phải dùng `hasRequiredKeys`. Nếu kiểm chặt ở đó, model chèn `deduction` vào một phần tử evidence sẽ làm cả output thành `schema_error`, tức G5 thủng ở tầng dưới. Commit G2 sẽ có test cho trường hợp này.
