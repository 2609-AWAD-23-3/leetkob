# Đầu vào AI-log — PA03-T05

Đầu vào cho PA03-T13 tổng hợp vào `AI-LOG.md` ở root; không thay review độc lập hoặc hồ sơ milestone.

## 2026-11-20 — Sandbox Docker runner, 9 bài tấn công và CI job

**Công cụ (Tool):** Antigravity assistant (Orchestrator), Node 24.22.1, Docker Engine 29.10.0 (Ubuntu 24.04 cgroup v2 qua SSH tunnel tạm thời).

**Yêu cầu (Asked for):** Thiết kế và triển khai runner compile/run C++17 trong container đạt 9 minimums + giới hạn FAQ-05, viết 9 bài tấn công M1–M9 kèm tests, tách khỏi `npm test` và thêm CI job chạy trên PR và tag `pa3`.

**Phần giữ lại (Kept):** Tách hẳn `npm test` (offline, không Docker) với `npm run test:sandbox`; kiến trúc stream source/ELF/stdin qua `stdin`/`stdout` không dùng bind mount `-v`; giữ job `quality-gate` nguyên tên và thêm job `sandbox-attacks` song song trong `.github/workflows/ci.yml`.

**Phần điều chỉnh (Changed):**
- Thay vì đặt `--ulimit nproc=16:16` dễ đụng chạm process theo UID toàn host khi chạy song song, giữ `--pids-limit 16` theo cgroup từng container để đếm chính xác (`spawned=14` + `leetkob-runner` + `solution` = 16).
- Sửa lỗi phân loại `SIGKILL`: phiên bản đầu gán mọi `exitCode === 137` là `MemoryLimitExceeded`, khiến một bài nộp gọi `kill(getpid(), SIGKILL)` bị nhận nhầm thành OOM. Đã cập nhật `docker/leetkob-runner.c` đọc `/sys/fs/cgroup/memory.events` (`oom_kill` / `oom_group_kill`) để trả riêng mã `197` khi đúng cgroup OOM, và thêm test xác nhận `self-SIGKILL` (`137`) trả về `RuntimeError`.
- Đổi `m4-memory-swap.cpp` từ `new (std::nothrow)` (trả `104`) sang `new` chuẩn để cả trường hợp tắt overcommit (`std::bad_alloc` / `134`) lẫn cgroup OOM (`197`) đều được phân loại đúng là `memory_limit_exceeded`.
- Bổ sung kiểm tra thoát `125` trong `src/sandbox/runner.ts` để ném lỗi hạ tầng Docker thay vì nuốt thành `CompileError` hay `RuntimeError`; neo đường dẫn `DEFAULT_DOCKER_DIR` bằng `import.meta.url` và ép kiểu nguyên dương cho các giới hạn truyền `--ulimit`/Docker.
- Siết M7 (`CapEff == 0000000000000000`), M8 (kiểm `ro` trên `/` và `fstype` của `/tmp`, `/dev`, `/proc`, `/sys` trong `/proc/self/mountinfo`), M1 (lưu `errno` ngay sau `connect()`), M3 (`docker inspect` exit `1` + `docker ps -a` rỗng), M9 (tạo file canary trên host để thử `#include` và khẳng định `stderr` không rò nội dung), và dùng `setpgid`/`kill(-pid, SIGKILL)` trong `leetkob-runner.c` khi vượt output.
- Sửa các link tương đối bị gãy (`../../../` ➔ `../../../../`) trong `docs/evidence/PA03/T05/README.md` và hoàn trả ô checklist mục CI trong `docs/plans/PA03.md` về chưa tick `[ ]` cho tới khi PR có CI run thật trên GitHub Actions.

**Phần không chọn (Rejected):**
- Không cài Judge0 cho PA03 theo phạm vi plan đã chốt.
- Không mount thư mục code tạm từ host vào container (`-v`) vì làm tăng bề mặt mount cần bảo vệ; dùng `stdin`/`stdout` binary framing để container chạy với `--read-only` hoàn toàn.
- Không gộp `tests/sandbox/sandbox-attacks.mjs` vào pattern `*.test.mjs` của `npm test` vì container chấm bài của giảng viên tắt network và không có Docker daemon.

**Phần làm tay (By hand):** Phúc yêu cầu triển khai T05 và rà soát lại các lỗ hổng thực tế trước khi cho phép commit/push/tạo PR. Assistant thực hiện code/tests/CI/evidence và chạy lại kiểm chứng qua Docker trên VM Ubuntu 24.04 của nhóm.
