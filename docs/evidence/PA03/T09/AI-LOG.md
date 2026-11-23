# AI log — PA03-T09

## 2026-11-23 — Review queue và chặn Publish

Tool: Claude Code (desktop app).
Asked for: Vượng yêu cầu kiểm tra môi trường, tạo nhánh từ `develop`, đọc FAQ-08/09 và code hiện có, lập plan T09 để duyệt rồi làm theo thứ tự test trước; chưa cho commit/push.
Kept: Thiết kế theo plan đã duyệt: bốn endpoint review queue dùng session của T04; TA lớp khác nhận `404` như contract labs (Vượng chọn); toàn bộ code chỉ trả ở trang chi tiết (Vượng chọn); Publish chạy trên Store async với session nhưng giữ contract v1; test Publish của PA02 không đổi.
Changed: Plan PA03 để việc bắt buộc chỉ dòng khi chọn `violation` sang PA04; Claude trình bày hai phương án và hệ quả, Vượng chọn làm ngay từ PA03 để contract review queue không phải đổi kiểu phá vỡ. Server lấy text của dòng từ code đã nộp thay vì nhận text từ TA. Sau khi cài đặt, hai test đỏ vì lỗi của chính test (tham số mặc định `userId = 'ta-1'` khiến `call(undefined)` vẫn gửi token TA); sửa test thành `call(null)`, không nới assertion. Log đỏ bỏ hai dòng log có tên máy và đường dẫn local.
Rejected: Đổi `authorizePublishAccess` đồng bộ hay resolver token của PA02 (thêm bản async thay vì sửa, để test PA02 giữ nguyên); thêm slug problem mới cho "lab đã publish" (dùng `conflict` sẵn có); trả code trong danh sách queue; nhận `taId` từ body.
By hand: Vượng chọn T09 trước T10, chốt ba điểm thiết kế (404 cho TA lớp khác, code ở trang chi tiết, bắt buộc chỉ dòng từ PA03). Claude viết test, code, contract, evidence và chạy lệnh; lint, format-check, type-check, `git diff --check` exit 0; `npm test` 510 test, 508 pass, 2 skipped. `npm run test:db` lúc này chưa chạy vì Docker Desktop tắt (đã chạy ở mục sau).

## 2026-11-23 — Kiểm chứng trên Postgres và OpenAPI (phase 3)

Tool: Claude Code (desktop app).
Asked for: Vượng yêu cầu làm phase 3 trước khi review một lần: chạy test trên Postgres, thêm phần còn thiếu, vẫn chưa commit/push.
Kept: Khởi động container Postgres local bằng `docker/compose.postgres.yml` (Vượng đã bật Docker Desktop); `npm run test:db` của bản T09 xanh 91/91 trước khi thêm test.
Changed: Harness test nhận `makeStore` để chạy cùng kịch bản trên Postgres (mặc định vẫn in-memory, test contract không đổi); thêm `tests/integration/review-queue-postgres.test.mjs` (3 test: phân quyền, luật bằng chứng và chặn Publish, restart) và đưa vào `scripts/test-db.mjs`; thêm OpenAPI cho review queue và Publish cùng một test. Các test này viết sau khi code đã có, ghi rõ trong evidence.
Rejected: Chuyển toàn bộ contract test sang dạng conformance chạy cả hai store (phải viết lại file test đã chạy đỏ); chạy test trên database dev mà không tách schema.
By hand: Vượng bật Docker Desktop và yêu cầu làm phase 3. Claude viết test, OpenAPI, cập nhật tài liệu và chạy lệnh: lint, format-check, type-check, `git diff --check` exit 0; `npm test` 512 test, 509 pass, 3 skipped; `npm run test:db` 94/94.

## 2026-11-23 — Sửa theo review của Vượng

Tool: Claude Code (desktop app).
Asked for: Vượng review bản local và đưa hai vấn đề kèm cách sửa và test mong muốn: `confirm-passes` trả `200` khi Publish commit giữa chừng; Publish trả `403` cho TA lớp khác nên lộ lab tồn tại, đổi thành `404` như lab không tồn tại và ghi thay đổi contract.
Kept: Cả hai cách sửa theo đề xuất của Vượng. Viết test trước, chạy đỏ (5 in-memory, 1 Postgres) và lưu log, rồi mới sửa code.
Changed: Test Postgres giữ khoá `FOR UPDATE` trên dòng lab bằng kết nối riêng và chờ tới khi `confirm-passes` bị chặn trước khi ghi publication, để kịch bản xảy ra chắc chắn thay vì phụ thuộc thời gian. Claude chỉ ra rằng mục 5 của `publish.md` dành việc đổi status cho version mới; thay đổi được ghi là ngoại lệ có chủ đích với lý do bảo mật, không đổi path. Ba kỳ vọng `403` cho TA lớp khác trong test Publish PA02 đổi thành `404` vì contract đổi rõ ràng.
Rejected: Tạo `/v2/labs/{labId}/publish` chỉ cho một status (không có client ngoài; thêm route trùng lặp).
By hand: Vượng tìm ra hai vấn đề và chốt cách sửa. Claude viết test, sửa code và tài liệu, chạy lệnh: lint, format-check, type-check, `git diff --check` exit 0; `npm test` 515 test, 512 pass, 3 skipped; `npm run test:db` 95/95.

## 2026-11-23 — Chốt phương án B cho status của TA lớp khác

Tool: Claude Code (desktop app).
Asked for: Vượng hỏi nên để Publish trả `403` hay `404` cho TA lớp khác, rồi hỏi thêm phương án cho cả review queue trả `403`.
Kept: Review queue trả `404` như API labs và FAQ-01; bản sửa `confirm-passes` trả `409`.
Changed: Claude đánh giá lại đề xuất `404` đã làm: acceptance T09 yêu cầu giữ contract v1, mục 5 của `publish.md` dành việc đổi status cho version mới, ID lab là UUID nên rủi ro lộ thấp. Claude trình bày ba phương án (A: tất cả `404`; B: review `404`, Publish `403`; C: cả hai `403`) kèm rủi ro; Vượng chốt B. Hoàn lại mapping và hai file test Publish PA02 về đúng bản trên `develop`, bỏ ghi chú ngoại lệ trong `publish.md`, ghi khác biệt là rủi ro đã chấp nhận, viết lại test Publish của TA lớp khác thành `403` không lộ dữ liệu lab.
Rejected: Phương án C (mâu thuẫn với `GET /labs/{labId}` ngay trên cùng một lab); tạo `/v2` cho Publish.
By hand: Vượng ra quyết định cuối cùng. Claude sửa code, test, tài liệu và chạy lệnh (kết quả ở evidence mục 3).
