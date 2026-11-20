# PA03-T05 — Kiểm tra Sandbox và 9 bài tấn công

Nhánh `feat/pa03-t05-sandbox` (Refs #34), người thực hiện `@BHVPhuc`, reviewer độc lập `@vinny2707`.

## Môi trường kiểm chứng thực tế

- Kiểm thử unit/quality gate chạy trên Windows PowerShell với Node `v24.22.1`, npm `11.19.1` (`npm.cmd`).
- Kiểm thử Docker thật (`npm run test:sandbox`) chạy từ checkout local tới Docker Engine trên host Linux của nhóm (`Ubuntu 24.04.5 LTS`, Docker `29.10.0`, `CgroupVersion=2/systemd`, cùng cgroup v2 với `ubuntu-latest` của GitHub Actions) qua tunnel SSH tạm thời (`DOCKER_HOST=tcp://127.0.0.1:23759`, đã đóng ngay sau khi chạy xong).
- Chưa có CI run trên GitHub Actions cho tới khi mở PR và push lên remote.

## Thành phần triển khai

- Image sandbox: [docker/sandbox.Dockerfile](../../../../docker/sandbox.Dockerfile) (`debian:bookworm-slim`, `g++`, `libc6-dev`, non-root user `10001:10001`) và helper [docker/leetkob-runner.c](../../../../docker/leetkob-runner.c) biên dịch thành `/usr/local/bin/leetkob-runner`.
- Runner TypeScript: [src/sandbox/types.ts](../../../../src/sandbox/types.ts), [src/sandbox/runner.ts](../../../../src/sandbox/runner.ts), [src/sandbox/index.ts](../../../../src/sandbox/index.ts). Truyền source/binary/stdin qua `stdin`/`stdout`, không mount thư mục host (`-v`), phân biệt cgroup OOM (`197`) với `SIGKILL` thường (`137`), và ném lỗi hạ tầng rõ ràng khi Docker trả exit `125`.
- 9 bài tấn công C++17: [sandbox/attacks/](../../../../sandbox/attacks/).
- Unit tests offline (không cần Docker): [tests/unit/sandbox-runner.test.mjs](../../../../tests/unit/sandbox-runner.test.mjs).
- Suite Docker thật (tách khỏi `npm test`): [tests/sandbox/sandbox-attacks.mjs](../../../../tests/sandbox/sandbox-attacks.mjs) chạy qua [scripts/test-sandbox.mjs](../../../../scripts/test-sandbox.mjs) (`npm run test:sandbox`).
- CI workflow: [ci.yml](../../../../.github/workflows/ci.yml) thêm tag `'pa3'`, `'pa03*'` và job `sandbox-attacks` song song với job `quality-gate` bắt buộc.

## Kết quả 9 minimums (M1–M9) và kiểm tra phân loại lỗi

| Ca kiểm thử | Bài nộp / Probe | Kết quả khi bật sandbox | Kết quả khi tắt/nới giới hạn tương ứng |
| --- | --- | --- | --- |
| Baseline | C++17 `a + b` hợp lệ (2 test) | `Accepted`, compile + run trong sandbox đều exit `0` | — |
| Phân biệt OOM vs `SIGKILL` | `kill(getpid(), SIGKILL)` | `RuntimeError`, exit `137`, không bị nhận nhầm là `MemoryLimitExceeded` | — |
| Lỗi hạ tầng Docker | Image không tồn tại (`exit 125`) | Ném `Error: Docker sandbox infrastructure error (exit 125)` | — |
| M1 — No network | `m1-network.cpp` | `runtime_error`, exit `101`, `NETWORK_BLOCKED udp_errno=101 ... tcp_errno=101 ...` | Với `--network bridge`: exit `0`, `NETWORK_ACCESS_SUCCEEDED` |
| M2 — CPU time (1s) | `m2-cpu-time.cpp` | `time_limit_exceeded` (`cpu_time_limit`), exit `152` (`SIGXCPU`) | Với `cpuTimeLimitSeconds: 5`: exit `0`, `CPU_ATTACK_FINISHED` |
| M3 — Wall-clock kill container (3s) | `m3-wall-clock.cpp` | `time_limit_exceeded` (`wall_clock_timeout`), `containerKilled: true`, `docker inspect` exit `1` và `docker ps -a` rỗng | Với `wallTimeLimitSeconds: 15`: exit `0`, `WALL_CLOCK_SURVIVED` |
| M4 — Memory 256 MB gồm swap (đọc lại vùng nhớ) | `m4-memory-swap.cpp` | `memory_limit_exceeded` (`memory_limit`), exit `197` (xác nhận `oom_kill` trên `/sys/fs/cgroup/memory.events`) | Với `memoryLimitMb: 512`: exit `0`, `MEMORY_ATTACK_SUCCEEDED checksum=12536684` |
| M5 — Process limit (16) | `m5-process-limit.cpp` | `runtime_error`, exit `105`, `PROCESS_LIMIT_ENFORCED spawned=14 errno=11 (Resource temporarily unavailable)` | Với `maxProcesses: 64`: exit `0`, `PROCESS_ATTACK_SUCCEEDED children=32` |
| M6 — Output size (1 MB) | `m6-output-size.cpp` | `output_limit_exceeded` (`output_size_limit`), exit `153`, `outputTruncated: true`, `stdout <= 1048576` bytes | Với `outputLimitBytes: 8388608`: exit `0`, `OUTPUT_ATTACK_FINISHED` |
| M7 — Non-root user & zero capabilities | `m7-non-root.cpp` | `runtime_error`, exit `107`, `NON_ROOT_ENFORCED uid=10001 euid=10001 cap_eff=0000000000000000` | Với `--user 0:0`: exit `0`, `ROOT_ACCESS_SUCCEEDED uid=0 euid=0` |
| M8 — No host mounts, read-only rootfs, no Docker socket | `m8-host-mounts-docker-socket.cpp` | `runtime_error`, exit `108`, `NO_HOST_MOUNTS_OR_DOCKER_SOCKET` | Bỏ `--read-only`: exit `0` (`root_not_readonly`); `-v /tmp:/tmp`: exit `0` (`tmp_not_tmpfs:ext4`); `-v /var/run/docker.sock:/var/run/docker.sock`: exit `0` (`docker_socket`) |
| M9 — No secrets (env, file, `#include`) | `m9-no-secrets.cpp` + probe `#include` file canary host, `/etc/shadow`, `/run/secrets/model_api_key` | `runtime_error`, exit `109`, `NO_SECRETS_FOUND`; 3 probe `#include` đều `CompileError` và `stderr` không rò nội dung | Với `-e MODEL_API_KEY=probe-only`: exit `0`, `SECRET_LEAKED reason=file` |

## Quality commands

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm run lint` | exit `0` | `oxlint --deny-warnings src tests scripts` (0 warnings, 0 errors) |
| `npm run format-check` | exit `0` | `prettier --check .` |
| `npm run type-check` | exit `0` | `tsc -p tsconfig.check.json` |
| `npm test` | exit `0` | `95/95` tests pass (83 baseline + 12 unit tests sandbox), không cần Docker hay network |
| `npm run test:sandbox` | exit `0` | `11/11` tests pass trên Docker Linux Ubuntu 24.04 (`baseline` + `self-SIGKILL` + `M1`–`M9`) |
| `git diff --check` | exit `0` | Không lỗi whitespace |

Xem thêm [nhật ký AI theo task](AI-LOG.md).
