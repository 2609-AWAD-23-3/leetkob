# PA03-T05 — Kiểm tra Sandbox và 9 bài tấn công

Nhánh `feat/pa03-t05-sandbox` ([PR #46](https://github.com/2609-AWAD-23-3/leetkob/pull/46), Refs #34), người thực hiện `@BHVPhuc`, reviewer độc lập `@vinny2707`.

## Môi trường kiểm chứng thực tế

- Kiểm thử unit/quality gate chạy trên Windows PowerShell với Node `v24.22.1`, npm `11.19.1` (`npm.cmd`) sau khi merge `origin/develop` (`f2a4f04`).
- Kiểm thử Docker thật (`npm run test:sandbox`) chạy từ checkout local tới Docker Engine trên host Linux của nhóm (`Ubuntu 24.04.5 LTS`, Docker `29.10.0`, `CgroupVersion=2/systemd`, cùng cgroup v2 với `ubuntu-latest` của GitHub Actions) qua tunnel SSH tạm thời (`DOCKER_HOST=tcp://127.0.0.1:23759`, đã đóng ngay sau khi chạy xong).
- CI GitHub Actions các vòng trước: [Run 44779595118](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/44779595118) tại `e9c8904` và [Run 44932685576](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/44932685576) tại `06989fc` (đạt `SUCCESS` cho cả `quality-gate`, `postgres-store`, `sandbox-attacks`). Ghi chú: trigger tag `pa3` sẽ được kiểm chứng tiếp khi `T13` gắn tag `pa3` nộp bài; sau vòng sửa giới hạn CPU chính xác tới millisecond (`1500 ms`) và sync `origin/develop` (`f2a4f04`), kết quả Docker thật và unit test mới đã được kiểm chứng lại ở local trước khi push để chạy CI mới.

## Thành phần triển khai

- Image sandbox: [docker/sandbox.Dockerfile](../../../../docker/sandbox.Dockerfile) (`debian:bookworm-slim`, `g++`, `libc6-dev`, non-root user `10001:10001`) và helper [docker/leetkob-runner.c](../../../../docker/leetkob-runner.c) biên dịch thành `/usr/local/bin/leetkob-runner`.
- Runner TypeScript: [src/sandbox/types.ts](../../../../src/sandbox/types.ts), [src/sandbox/runner.ts](../../../../src/sandbox/runner.ts), [src/sandbox/index.ts](../../../../src/sandbox/index.ts). Truyền source/binary/stdin qua `stdin`/`stdout`, không mount thư mục host (`-v`), phân biệt cgroup OOM (`197`) với `SIGKILL` thường (`137`), tách kết quả solution khỏi lỗi hạ tầng Docker bằng status frame kèm nonce theo từng lượt chạy, giám sát tổng CPU cả cây process qua `/sys/fs/cgroup/cpu.stat` (`usage_usec`) hỗ trợ ngưỡng millisecond (ví dụ `1.5s` / `1500 ms`, Docker `--ulimit cpu` làm tròn lên theo giây nguyên trong khi helper ngắt đúng microsecond), và đặt deadline giới hạn cho fallback kill / cleanup.
- 9 bài tấn công C++17: [sandbox/attacks/](../../../../sandbox/attacks/).
- Unit tests offline (không cần Docker): [tests/unit/sandbox-runner.test.mjs](../../../../tests/unit/sandbox-runner.test.mjs) (`17/17` tests).
- Suite Docker thật (tách khỏi `npm test`): [tests/sandbox/sandbox-attacks.mjs](../../../../tests/sandbox/sandbox-attacks.mjs) chạy qua [scripts/test-sandbox.mjs](../../../../scripts/test-sandbox.mjs) (`npm run test:sandbox`, `15/15` tests).
- CI workflow: [ci.yml](../../../../.github/workflows/ci.yml) thêm tag `'pa3'`, `'pa03*'`, giữ cả `postgres-store` (T03/T06) và job `sandbox-attacks` (T05) song song với `quality-gate`.

## Kết quả 9 minimums (M1–M9) và các ca kiểm thử bổ sung sau review

| Ca kiểm thử | Bài nộp / Probe | Kết quả khi bật sandbox | Kết quả khi tắt/nới giới hạn tương ứng |
| --- | --- | --- | --- |
| Baseline | C++17 `a + b` hợp lệ (2 test) | `Accepted`, compile + run trong sandbox đều thành công | — |
| Phân biệt OOM vs `SIGKILL` | `kill(getpid(), SIGKILL)` | `RuntimeError`, exit `137`, không bị nhận nhầm là `MemoryLimitExceeded` | — |
| Regression `return 125` (Finding #2) | `int main() { return 125; }` | `RuntimeError`, exit `125` qua status frame có nonce của helper, không ném lỗi hạ tầng Docker | — |
| Lỗi hạ tầng Docker (thiếu frame) | Image không tồn tại (`leetkob-sandbox:nonexistent-regression-tag`) | Ném `Error: Docker sandbox infrastructure error` | — |
| M1 — No network | `m1-network.cpp` | `runtime_error`, exit `101`, `NETWORK_BLOCKED udp_errno=101 ... tcp_errno=101 ...` | Với `--network bridge`: exit `0`, `NETWORK_ACCESS_SUCCEEDED` |
| M2 — CPU time (1s) | `m2-cpu-time.cpp` | `time_limit_exceeded` (`cpu_time_limit`), exit `152` (`SIGXCPU`) | Với `cpuTimeLimitSeconds: 5`: exit `0`, `CPU_ATTACK_FINISHED` |
| M2 regression — Cây process `fork()` (Finding #1) | Fork 2 process con mỗi con đốt `700ms` CPU (`CLOCK_THREAD_CPUTIME_ID`), `main` in `OK` thoát không `waitpid` | `TimeLimitExceeded` (`cpu_time_limit`), exit `152` nhờ giám sát `/sys/fs/cgroup/cpu.stat` và dọn toàn bộ tiến trình con | Trước khi cộng CPU cgroup: thoát `Accepted`, exit `0` |
| M2 regression — Ngưỡng millisecond `1500 ms` (`1.5s`) (Finding #4) | `limits: { cpuTimeLimitSeconds: 1.5 }` chạy 2 bài đốt `1150 ms` và `1700 ms` CPU | Bài `1150 ms` đạt `Accepted`; bài `1700 ms` bị ngắt `TimeLimitExceeded` (`cpu_time_limit`, exit `152`) dù `--ulimit cpu=2:3` ở mức 2s | — |
| M3 — Wall-clock kill container (3s) | `m3-wall-clock.cpp` | `time_limit_exceeded` (`wall_clock_timeout`), `containerKilled: true`, `docker inspect` exit `1` và `docker ps -a` rỗng | Với `wallTimeLimitSeconds: 15`: exit `0`, `WALL_CLOCK_SURVIVED` |
| M4 — Memory 256 MB gồm swap (đọc lại vùng nhớ) | `m4-memory-swap.cpp` | `memory_limit_exceeded` (`memory_limit`), exit `197` (`oom_kill` trên `/sys/fs/cgroup/memory.events`); đã kiểm stress 25/25 lần đều `197` với `0` lỗi `137` | Với `memoryLimitMb: 512`: exit `0`, `MEMORY_ATTACK_SUCCEEDED checksum=12536684` |
| M5 — Process limit (16) | `m5-process-limit.cpp` | `runtime_error`, exit `105`, `PROCESS_LIMIT_ENFORCED spawned=14 errno=11 (Resource temporarily unavailable)` | Với `maxProcesses: 64`: exit `0`, `PROCESS_ATTACK_SUCCEEDED children=32` |
| M6 — Output size (1 MB) | `m6-output-size.cpp` | `output_limit_exceeded` (`output_size_limit`), exit `153`, `outputTruncated: true`, `stdout <= 1048576` bytes | Với `outputLimitBytes: 8388608`: exit `0`, `OUTPUT_ATTACK_FINISHED` |
| M7 — Non-root user & zero capabilities | `m7-non-root.cpp` | `runtime_error`, exit `107`, `NON_ROOT_ENFORCED uid=10001 euid=10001 cap_eff=0000000000000000` | Với `--user 0:0`: exit `0`, `ROOT_ACCESS_SUCCEEDED uid=0 euid=0` |
| M8 — No host mounts, read-only rootfs, no Docker socket | `m8-host-mounts-docker-socket.cpp` | `runtime_error`, exit `108`, `NO_HOST_MOUNTS_OR_DOCKER_SOCKET` | Bỏ `--read-only`: exit `0` (`root_not_readonly`); `-v /tmp:/tmp`: exit `0` (`tmp_not_tmpfs:ext4`); `-v /var/run/docker.sock:/var/run/docker.sock`: exit `0` (`docker_socket`) |
| M9 — No secrets (env, file, `#include`) | `m9-no-secrets.cpp` + probe `#include` file canary host, `/etc/shadow`, `/run/secrets/model_api_key` | `runtime_error`, exit `109`, `NO_SECRETS_FOUND`; 3 probe `#include` đều `CompileError` và `stderr` không rò nội dung | Với `-e MODEL_API_KEY=probe-only`: exit `0`, `SECRET_LEAKED reason=file` |
| Cleanup treo / reject & fallback kill (Finding #3, mock) | `killContainer` không resolve (cả khi process phớt lờ `SIGKILL`) hoặc `killContainer` reject | Fallback `SIGKILL` kích hoạt độc lập theo `fallbackKillDelayMs`, runner giải phóng và ném lỗi hạ tầng có giới hạn theo `cleanupTimeoutMs` | — |

## Quality commands (sau vòng sửa `1500 ms` + merge `origin/develop` `f2a4f04`)

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm run lint` | exit `0` | `oxlint --deny-warnings src tests scripts` (0 warnings, 0 errors trên 128 files) |
| `npm run format-check` | exit `0` | `prettier --check .` |
| `npm run type-check` | exit `0` | `tsc -p tsconfig.check.json` |
| `npm test` | exit `0` | `375` pass, `0` fail, `1` skip (`postgres store tests` bỏ qua khi chưa đặt `TEST_DATABASE_URL`; riêng `sandbox-runner.test.mjs` `17/17` pass), không cần Docker hay network |
| `npm run test:sandbox` | exit `0` | `15/15` tests pass trên Docker Linux Ubuntu 24.04 (`baseline` + `self-SIGKILL` + `return 125` + `missing image` + `M1`–`M9` + `M2 fork tree` + `M2 1500 ms`), kiểm tra `docker ps -a --filter name=leetkob-sbx` rỗng (0 container sót) |
| CI các vòng trước | `SUCCESS` | [Run 44779595118](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/44779595118) (`e9c8904`), [Run 44932685576](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/44932685576) (`06989fc`); CI vòng mới chạy sau khi push bản sửa `1500 ms` |
| `git diff --check` | exit `0` | Không lỗi whitespace / conflict marker |

Xem thêm [nhật ký AI theo task](AI-LOG.md).
