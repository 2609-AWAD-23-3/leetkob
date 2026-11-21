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

## 2026-11-22 — Xử lý 3 findings review của `@vinny2707` và sync `origin/develop` (`c660d7e`)

**Công cụ (Tool):** Antigravity assistant (Planner + Execution), Node 24.22.1, Docker Engine 29.10.0 (Ubuntu 24.04 cgroup v2 qua SSH tunnel tạm thời).

**Yêu cầu (Asked for):** Merge `origin/develop` giải quyết conflict của PR #46 và xử lý toàn bộ 3 điểm review (`[P1]` giới hạn CPU toàn cây process, `[P2]` tách nhận diện lỗi Docker khỏi exit code `125` của solution, `[P2]` lên lịch fallback kill độc lập và chặn thời gian cleanup).

**Phần điều chỉnh (Changed):**
- Giám sát tổng CPU container/cây process trong `docker/leetkob-runner.c` qua `/sys/fs/cgroup/cpu.stat` (`usage_usec`, có fallback cgroup v1 `cpuacct.usage` và `getrusage(RUSAGE_CHILDREN)`), dừng toàn cây tiến trình (`kill(-1, SIGKILL)` khi runner là PID 1) ngay khi đạt `cpu_limit_sec`, không để các process con `fork()` thoát `waitpid` vượt tổng budget `1s`.
- Triển khai status frame có nonce theo từng lượt chạy (`__LEETKOB_STATUS__:<token>:<outcome>:<exitCode>:<signal>:<cpuUsec>`) giữa `docker/leetkob-runner.c` (xóa trắng token khỏi `argv[4]` trước `fork()`) và `src/sandbox/runner.ts` (`parseHelperStatusFrame` khớp neo cuối `stderr`), để bài nộp `return 125` trả `RuntimeError` (`exitCode: 125`), còn trường hợp Docker/CLI lỗi thật thiếu frame mới ném `Docker sandbox infrastructure error`.
- Lên lịch `fallbackKillTimer` (`proc.kill('SIGKILL')`) ngay trong `triggerContainerKill()` độc lập với `killContainer`, bổ sung `cleanupTimeoutMs` và grace timeout đóng process cho cả `defaultKillContainer` lẫn `executeContainer` để runner không treo vô hạn hoặc rơi unhandled rejection khi `docker rm -f` treo hoặc reject.
- Khi chạy thực nghiệm stress M4 sau sửa, phát hiện `fopen` trong vòng `poll()` cấp phát bộ nhớ động lúc cgroup chạm sát `256 MB` làm phát sinh sự kiện OOM thứ cấp vào PID 1 (`exit 137`); đã đổi sang mở sẵn file descriptor `/sys/fs/cgroup/cpu.stat` và `/sys/fs/cgroup/memory.events` từ trước `fork()` cùng `pread()` vào buffer tĩnh đã chạm trang (`0 malloc` sau `fork()`), xác nhận 25/25 lần M4 đều trả đúng `197` (`memory_limit_exceeded`).
- Đồng bộ `origin/develop` (`c660d7e`), giữ cả scripts/dependencies T03 (`pg`, `@types/pg`, `db:migrate`, `test:db`) và CI jobs `quality-gate`, `postgres-store`, `sandbox-attacks`.

**Phần không chọn (Rejected):**
- Không truyền status token qua biến môi trường để giữ đúng quy tắc sạch môi trường container; truyền qua `argv` và xóa in-place trước `fork()`.
- Không ép mọi `exit 137` thiếu frame thành `MemoryLimitExceeded` để tránh che lấp lỗi hạ tầng thật (ví dụ `docker kill` từ bên ngoài).

**Phần làm tay (By hand):** Phúc yêu cầu rà soát review PR #46, phê duyệt kế hoạch sửa 3 điểm và yêu cầu giải thích rõ những gì T05 giải quyết trước khi cho phép commit/push. Assistant thực hiện code, merge local, chạy offline quality gate và Docker thật (`14/14`), và dừng lại trước khi commit/push.
