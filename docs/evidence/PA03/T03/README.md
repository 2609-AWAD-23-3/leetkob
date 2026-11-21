# PA03-T03 — Evidence dữ liệu dùng chung và Postgres

Ngày kiểm chứng: 21/11/2026. Người thực hiện: Vượng; reviewer độc lập: Phúc (chưa xác nhận nghiệm thu).

## Source và môi trường

- Source code đã chạy checks: `c0f7789c645a932bce7ce640dd437469f307f8ec`, nhánh `feat/pa03-t03-shared-data`.
- Node `v24.22.3`, npm `11.19.1`, Windows local; Postgres 17 trong Docker.
- Commit tài liệu sau source SHA này không thay đổi implementation/tests.
- Thiết kế và API: [shared-data-pa03.md](../../../architecture/shared-data-pa03.md); lịch sử hỗ trợ AI và các lần kiểm tra trước: [AI-LOG.md](AI-LOG.md).

## Kết quả local tại source SHA trên

| Lệnh | Kết quả | Exit code |
| --- | --- | --- |
| `npm.cmd run lint` | Pass | 0 |
| `npm.cmd run format-check` | Pass | 0 |
| `npm.cmd run type-check` | Pass | 0 |
| `npm.cmd test` | Build thành công; 153 pass, 1 skip | 0 |
| `npm.cmd run test:db` | Build thành công; 69/69 pass | 0 |
| `git diff --check` | Pass | 0 |

Skip trong `npm test` là suite Postgres khi không đặt `TEST_DATABASE_URL`; suite này đã chạy riêng bằng `test:db`. Các test có database tạo schema riêng và tự dọn sau chạy. Unit/contract và integration không cần hạ tầng vẫn chạy khi không có Postgres. Cài sạch `npm.cmd ci --ignore-scripts` đã pass với Node/npm trên trước khi tạo commit; metadata dependency không liên quan được giữ nguyên, lockfile không đổi sau cài.

## Các trường hợp đã kiểm tra

- Submission và job được ghi nguyên tử; claim đồng thời dùng `FOR UPDATE SKIP LOCKED`.
- Mỗi claim có lease token riêng; token cũ không thể complete/fail/gia hạn lease mới, kể cả cùng worker.
- Lease hết hạn trong lúc chờ connection, khóa job hoặc khóa submission bị từ chối trước khi ghi.
- Complete AC cần đủ một verdict hợp lệ cho mỗi constraint; unique key ngăn bộ verdict trùng.
- Một process riêng claim rồi thoát trước complete; store mới trong process test reclaim sau hết lease và lưu một bộ verdict. Ghép worker sản phẩm thuộc T06.
- Review và Publish được tuần tự hóa bằng khóa lab; pending state đọc cùng một snapshot khi worker hoàn tất đồng thời.
- Nhiều process khởi tạo schema/migration lần đầu; migration chạy lại không lặp; nâng cấp từ `0001_init` hiện tại giữ dữ liệu.
- CHECK và validation từ chối metrics âm/không hữu hạn; seed sai không thay state cũ.
- Submit trước deadline giữ thời điểm nhận ban đầu dù phải chờ database qua hạn; nộp đúng deadline không được tính.

## Phạm vi bàn giao và giới hạn

`Store` async có fake và adapter Postgres, gồm thao tác `PublicationStore`. HTTP Publish và `PublishStore` sync PA02 chưa chuyển adapter; T09 tiếp nhận việc nối route và authorization async, giữ contract HTTP v1. Reviewer cần xác nhận ranh giới này so với checklist T03 trước nghiệm thu. Chưa claim endpoint HTTP đã chạy trên Postgres.

T12 triển khai API/worker/Postgres lên VPS; lượt này không deploy. Không có database của thành viên khác chạy bản nháp trước lease token theo xác nhận của người thực hiện; database local hiện tại đã có cột này. Bộ migrations hướng tới schema đã chốt trong PR, không bổ sung nâng cấp từ bản nháp đó.

Kết quả ở đây là local, không thay thế CI hoặc review độc lập. Xem checks của PR cho `quality-gate` và `postgres-store` trên Linux; không tự tick checklist review hoặc đóng Issue #32.
