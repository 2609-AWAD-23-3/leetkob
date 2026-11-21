# PA03-T03 — Evidence dữ liệu dùng chung và Postgres

Ngày kiểm chứng: 21/11/2026. Người thực hiện: Vượng; reviewer độc lập chính: Phúc, đã xác nhận nghiệm thu trong [review APPROVED](https://github.com/2609-AWAD-23-3/leetkob/pull/47#pullrequestreview-5996962126). Vỹ xác nhận interface T08 và cũng APPROVED head `aaf2e95`.

## Source và môi trường

- Source code đã chạy checks: `c0f7789c645a932bce7ce640dd437469f307f8ec`, nhánh `feat/pa03-t03-shared-data`.
- Head đã review: `aaf2e9522959f2447e8049643a14aaa36301d7d8`; PR #47 merge vào `develop` ngày 21/11/2026 tại `b5a6619313ee00805cd8f005d43dc699301575b6`.
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

`Store` async có fake và adapter Postgres, gồm thao tác `PublicationStore`. HTTP Publish và `PublishStore` sync PA02 chưa chuyển adapter; T09 tiếp nhận việc nối route và authorization async, giữ contract HTTP v1. Phúc đã xác nhận ranh giới này trong review APPROVED của PR #47 và chấp thuận job CI Postgres với vai trò owner workflow. Không claim endpoint HTTP đã chạy trên Postgres.

T12 triển khai API/worker/Postgres lên VPS; lượt này không deploy. Không có database của thành viên khác chạy bản nháp trước lease token theo xác nhận của người thực hiện; database local hiện tại đã có cột này. Bộ migrations hướng tới schema đã chốt trong PR, không bổ sung nâng cấp từ bản nháp đó.

## CI và nghiệm thu độc lập

[CI run 44782158186](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/44782158186), head `aaf2e95`, có cả `quality-gate` (25s) và `postgres-store` (33s) SUCCESS trên Linux. Phúc chạy kiểm chứng riêng trên Node `v24.22.1`/npm `11.19.1` với container `postgres:17-alpine`: cài sạch, quality checks, `npm test` 153 pass/1 skip, migration hai lần và `test:db` 69/69 đều exit 0. Đây là kết quả do reviewer công bố trong review được dẫn ở đầu tài liệu, phân biệt với các lệnh local do Codex chạy.

[Vỹ xác nhận T08](https://github.com/2609-AWAD-23-3/leetkob/pull/47#issuecomment-7055608424): schema/parser, unsure causes và call log đủ; các lưu ý lease/timeout, cộng chi phí mọi lần gọi khi retry và tương thích structured output sẽ được T06/T08 xử lý lúc tích hợp.

Code T03 đã merge và nghiệm thu; PR docs đồng bộ hồ sơ/checklist riêng. Issue #32 giữ mở đến khi PR docs được review/merge. Không tự approve hoặc tick ô reviewer thay Phúc.
