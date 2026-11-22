#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#define MAX_SOURCE_BYTES (256u * 1024u)
#define MAX_BINARY_BYTES (32u * 1024u * 1024u)
#define HEADER_LEN 17u
#define EXIT_CGROUP_OOM 197
#define SOURCE_PATH "/tmp/solution.cpp"
#define BINARY_PATH "/tmp/solution"
#define MAX_STATUS_TOKEN_LEN 96u

static char g_status_token[128] = "";
static char g_cgroup_buf[2048];
static uint8_t g_pipe_buf[16384];
static int g_mem_events_fd = -1;
static int g_cpu_stat_fd = -1;
static int g_cpu_stat_is_v1 = 0;

static char* const CLEAN_ENV[] = {
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "HOME=/tmp",
    "TMPDIR=/tmp",
    "LANG=C.UTF-8",
    NULL,
};

static int is_valid_token_char(char c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
         c == '_' || c == '-';
}

static void prefault_static_buffers(void) {
  for (size_t i = 0; i < sizeof(g_cgroup_buf); i++) {
    ((volatile char*)g_cgroup_buf)[i] = '\0';
  }
  for (size_t i = 0; i < sizeof(g_pipe_buf); i += 4096u) {
    ((volatile uint8_t*)g_pipe_buf)[i] = 1u;
  }
  ((volatile uint8_t*)g_pipe_buf)[sizeof(g_pipe_buf) - 1u] = 1u;
}

static void init_cgroup_fds(void) {
  prefault_static_buffers();
  g_mem_events_fd = open("/sys/fs/cgroup/memory.events", O_RDONLY | O_CLOEXEC);
  g_cpu_stat_fd = open("/sys/fs/cgroup/cpu.stat", O_RDONLY | O_CLOEXEC);
  if (g_cpu_stat_fd >= 0) {
    g_cpu_stat_is_v1 = 0;
    return;
  }

  const char* v1_paths[] = {
      "/sys/fs/cgroup/cpuacct/cpuacct.usage",
      "/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage",
  };
  for (size_t i = 0; i < sizeof(v1_paths) / sizeof(v1_paths[0]); i++) {
    int fd = open(v1_paths[i], O_RDONLY | O_CLOEXEC);
    if (fd >= 0) {
      g_cpu_stat_fd = fd;
      g_cpu_stat_is_v1 = 1;
      return;
    }
  }
}

static int read_fd_into_buf(int fd, char* buf, size_t cap) {
  if (fd < 0 || cap < 2u) {
    return 0;
  }
  ssize_t n = 0;
  for (;;) {
    n = pread(fd, buf, cap - 1u, 0);
    if (n < 0 && errno == EINTR) {
      continue;
    }
    break;
  }
  if (n <= 0) {
    buf[0] = '\0';
    return 0;
  }
  buf[(size_t)n] = '\0';
  return 1;
}

static int parse_cgroup_key_u64(const char* buf, const char* key, uint64_t* out_val) {
  size_t key_len = strlen(key);
  const char* p = buf;
  while (*p != '\0') {
    if (strncmp(p, key, key_len) == 0 && (p[key_len] == ' ' || p[key_len] == '\t')) {
      const char* num_start = p + key_len + 1;
      while (*num_start == ' ' || *num_start == '\t') {
        num_start++;
      }
      char* end = NULL;
      errno = 0;
      unsigned long long val = strtoull(num_start, &end, 10);
      if (errno == 0 && end != num_start) {
        *out_val = (uint64_t)val;
        return 1;
      }
    }
    const char* nl = strchr(p, '\n');
    if (nl == NULL) {
      break;
    }
    p = nl + 1;
  }
  return 0;
}

static int write_all(int fd, const uint8_t* buf, size_t len) {
  size_t offset = 0;
  while (offset < len) {
    ssize_t written = write(fd, buf + offset, len - offset);
    if (written < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    offset += (size_t)written;
  }
  return 0;
}

static int read_exact(int fd, uint8_t* buf, size_t len) {
  size_t offset = 0;
  while (offset < len) {
    ssize_t n = read(fd, buf + offset, len - offset);
    if (n < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    if (n == 0) {
      return -1;
    }
    offset += (size_t)n;
  }
  return 0;
}

static unsigned long parse_positive_ulong(const char* raw, unsigned long fallback) {
  char* end = NULL;
  errno = 0;
  unsigned long value = strtoul(raw, &end, 10);
  if (errno != 0 || end == raw || *end != '\0' || value == 0) {
    return fallback;
  }
  return value;
}

static uint64_t parse_cpu_limit_usec(const char* raw, uint64_t fallback_usec) {
  if (raw == NULL || raw[0] == '\0') {
    return fallback_usec;
  }

  uint64_t whole_sec = 0;
  uint64_t frac_usec = 0;
  size_t i = 0;
  int has_digits = 0;

  while (raw[i] >= '0' && raw[i] <= '9') {
    has_digits = 1;
    if (whole_sec > 3600ull) {
      return fallback_usec;
    }
    whole_sec = whole_sec * 10ull + (uint64_t)(raw[i] - '0');
    i++;
  }

  if (!has_digits) {
    return fallback_usec;
  }

  if (raw[i] == '.') {
    i++;
    uint64_t place = 100000ull;
    int frac_digits = 0;
    while (raw[i] >= '0' && raw[i] <= '9') {
      frac_digits = 1;
      if (place > 0) {
        frac_usec += (uint64_t)(raw[i] - '0') * place;
        place /= 10ull;
      }
      i++;
    }
    if (!frac_digits) {
      return fallback_usec;
    }
  }

  if (raw[i] != '\0') {
    return fallback_usec;
  }

  uint64_t total = whole_sec * 1000000ull + frac_usec;
  return total > 0 ? total : fallback_usec;
}

static unsigned long ceil_sec_from_usec(uint64_t cpu_limit_usec) {
  if (cpu_limit_usec == 0) {
    return 1ul;
  }
  return (unsigned long)((cpu_limit_usec + 999999ull) / 1000000ull);
}

static void emit_status_frame(const char* outcome, int exit_code, int sig, uint64_t cpu_usec) {
  (void)fflush(stderr);
  if (g_status_token[0] == '\0') {
    return;
  }
  char frame[256];
  int n = snprintf(frame, sizeof(frame), "\n__LEETKOB_STATUS__:%s:%s:%d:%d:%llu\n",
                   g_status_token, outcome, exit_code, sig, (unsigned long long)cpu_usec);
  if (n > 0 && (size_t)n < sizeof(frame)) {
    (void)write_all(STDERR_FILENO, (const uint8_t*)frame, (size_t)n);
  }
}

static int set_child_rlimits(unsigned long cpu_limit_sec, unsigned long fsize_limit_bytes) {
  struct rlimit core_limit = {0, 0};
  if (setrlimit(RLIMIT_CORE, &core_limit) != 0) {
    return -1;
  }

  struct rlimit cpu_limit = {
      (rlim_t)cpu_limit_sec,
      (rlim_t)(cpu_limit_sec + 1ul),
  };
  if (setrlimit(RLIMIT_CPU, &cpu_limit) != 0) {
    return -1;
  }

  if (fsize_limit_bytes > 0) {
    struct rlimit fsize_limit = {
        (rlim_t)fsize_limit_bytes,
        (rlim_t)fsize_limit_bytes,
    };
    if (setrlimit(RLIMIT_FSIZE, &fsize_limit) != 0) {
      return -1;
    }
  }

  return 0;
}

static int cgroup_oom_killed(void) {
  if (!read_fd_into_buf(g_mem_events_fd, g_cgroup_buf, sizeof(g_cgroup_buf))) {
    return 0;
  }
  uint64_t count = 0;
  if (parse_cgroup_key_u64(g_cgroup_buf, "oom_kill", &count) && count > 0) {
    return 1;
  }
  if (parse_cgroup_key_u64(g_cgroup_buf, "oom_group_kill", &count) && count > 0) {
    return 1;
  }
  return 0;
}

static int read_cgroup_cpu_usec(uint64_t* out_usec) {
  if (!read_fd_into_buf(g_cpu_stat_fd, g_cgroup_buf, sizeof(g_cgroup_buf))) {
    return 0;
  }
  if (!g_cpu_stat_is_v1) {
    return parse_cgroup_key_u64(g_cgroup_buf, "usage_usec", out_usec);
  }
  char* end = NULL;
  errno = 0;
  unsigned long long ns = strtoull(g_cgroup_buf, &end, 10);
  if (errno == 0 && end != g_cgroup_buf) {
    *out_usec = (uint64_t)(ns / 1000ull);
    return 1;
  }
  return 0;
}

static uint64_t rusage_to_usec(const struct rusage* ru) {
  return (uint64_t)ru->ru_utime.tv_sec * 1000000ull + (uint64_t)ru->ru_utime.tv_usec +
         (uint64_t)ru->ru_stime.tv_sec * 1000000ull + (uint64_t)ru->ru_stime.tv_usec;
}

static void kill_all_descendants(pid_t child_pid) {
  if (getpid() == 1) {
    // Running as container PID 1: kill(-1, SIGKILL) stops every descendant even across setsid().
    (void)kill(-1, SIGKILL);
    return;
  }
  (void)kill(-child_pid, SIGKILL);
  (void)kill(child_pid, SIGKILL);
}

static void reap_extra_children(void) {
  while (waitpid(-1, NULL, WNOHANG) > 0) {
  }
}

static uint64_t compute_aggregate_cpu_usec(const struct rusage* main_usage,
                                           int has_start_cgroup,
                                           uint64_t start_cgroup_usec,
                                           uint64_t observed_cpu_usec) {
  uint64_t max_usec = observed_cpu_usec;

  uint64_t main_usec = rusage_to_usec(main_usage);
  if (main_usec > max_usec) {
    max_usec = main_usec;
  }

  struct rusage children_usage;
  memset(&children_usage, 0, sizeof(children_usage));
  if (getrusage(RUSAGE_CHILDREN, &children_usage) == 0) {
    uint64_t children_usec = rusage_to_usec(&children_usage);
    if (children_usec > max_usec) {
      max_usec = children_usec;
    }
  }

  if (has_start_cgroup) {
    uint64_t cur_cgroup_usec = 0;
    if (read_cgroup_cpu_usec(&cur_cgroup_usec) && cur_cgroup_usec > start_cgroup_usec) {
      uint64_t delta_usec = cur_cgroup_usec - start_cgroup_usec;
      if (delta_usec > max_usec) {
        max_usec = delta_usec;
      }
    }
  }

  return max_usec;
}

static void classify_child_result(int status,
                                  uint64_t cpu_usec,
                                  uint64_t cpu_limit_usec,
                                  int output_exceeded,
                                  int cpu_exceeded,
                                  const char** out_outcome,
                                  int* out_exit_code,
                                  int* out_sig) {
  if (output_exceeded) {
    *out_outcome = "output_size_limit";
    *out_exit_code = 128 + SIGXFSZ;
    *out_sig = SIGXFSZ;
    return;
  }

  if (cpu_exceeded || cpu_usec >= cpu_limit_usec) {
    *out_outcome = "cpu_time_limit";
    *out_exit_code = 128 + SIGXCPU;
    *out_sig = SIGXCPU;
    return;
  }

  if (WIFSIGNALED(status)) {
    int sig = WTERMSIG(status);
    if (sig == SIGXCPU || (sig == SIGKILL && cpu_usec >= (cpu_limit_usec * 9ull) / 10ull)) {
      *out_outcome = "cpu_time_limit";
      *out_exit_code = 128 + SIGXCPU;
      *out_sig = SIGXCPU;
      return;
    }
    if (sig == SIGKILL && cgroup_oom_killed()) {
      *out_outcome = "memory_limit";
      *out_exit_code = EXIT_CGROUP_OOM;
      *out_sig = SIGKILL;
      return;
    }
    if (sig == SIGXFSZ) {
      *out_outcome = "output_size_limit";
      *out_exit_code = 128 + SIGXFSZ;
      *out_sig = SIGXFSZ;
      return;
    }
    *out_outcome = "signaled";
    *out_exit_code = 128 + sig;
    *out_sig = sig;
    return;
  }

  if (WIFEXITED(status)) {
    if (cgroup_oom_killed()) {
      *out_outcome = "memory_limit";
      *out_exit_code = EXIT_CGROUP_OOM;
      *out_sig = SIGKILL;
      return;
    }
    *out_outcome = "exited";
    *out_exit_code = WEXITSTATUS(status);
    *out_sig = 0;
    return;
  }

  *out_outcome = "infra_error";
  *out_exit_code = 1;
  *out_sig = 0;
}

static int run_compile_mode(uint64_t cpu_limit_usec, unsigned long output_limit_bytes) {
  uint8_t* src_buf = malloc(MAX_SOURCE_BYTES + 1u);
  if (src_buf == NULL) {
    fprintf(stderr, "runner: out of memory allocating source buffer\n");
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }

  size_t total = 0;
  for (;;) {
    ssize_t n = read(STDIN_FILENO, src_buf + total, MAX_SOURCE_BYTES + 1u - total);
    if (n < 0) {
      if (errno == EINTR) continue;
      perror("runner: read source");
      free(src_buf);
      emit_status_frame("infra_error", 1, 0, 0);
      return 1;
    }
    if (n == 0) break;
    total += (size_t)n;
    if (total > MAX_SOURCE_BYTES) {
      fprintf(stderr, "runner: source exceeds %u bytes\n", MAX_SOURCE_BYTES);
      free(src_buf);
      emit_status_frame("infra_error", 1, 0, 0);
      return 1;
    }
  }

  int src_fd = open(SOURCE_PATH, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (src_fd < 0) {
    perror("runner: open source file");
    free(src_buf);
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }
  if (write_all(src_fd, src_buf, total) != 0) {
    perror("runner: write source file");
    close(src_fd);
    free(src_buf);
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }
  close(src_fd);
  free(src_buf);

  uint64_t start_cgroup_usec = 0;
  int has_start_cgroup = read_cgroup_cpu_usec(&start_cgroup_usec);
  unsigned long rlimit_cpu_sec = ceil_sec_from_usec(cpu_limit_usec);

  pid_t pid = fork();
  if (pid < 0) {
    perror("runner: fork compiler");
    unlink(SOURCE_PATH);
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }

  if (pid == 0) {
    if (dup2(STDERR_FILENO, STDOUT_FILENO) < 0) {
      _exit(127);
    }
    if (set_child_rlimits(rlimit_cpu_sec, 32ul * 1024ul * 1024ul) != 0) {
      _exit(127);
    }
    (void)setpgid(0, 0);
    char* const gpp_argv[] = {
        "/usr/bin/g++",
        "-std=c++17",
        "-O2",
        SOURCE_PATH,
        "-o",
        BINARY_PATH,
        NULL,
    };
    execve("/usr/bin/g++", gpp_argv, CLEAN_ENV);
    _exit(127);
  }

  int status = 0;
  int child_reaped = 0;
  int cpu_exceeded = 0;
  uint64_t observed_cpu_usec = 0;
  struct rusage usage;
  memset(&usage, 0, sizeof(usage));

  while (!child_reaped) {
    pid_t w = wait4(pid, &status, WNOHANG, &usage);
    if (w == pid) {
      child_reaped = 1;
      break;
    }
    if (w < 0 && errno != EINTR) {
      break;
    }

    uint64_t cur_cpu_usec =
        compute_aggregate_cpu_usec(&usage, has_start_cgroup, start_cgroup_usec, observed_cpu_usec);
    if (cur_cpu_usec > observed_cpu_usec) {
      observed_cpu_usec = cur_cpu_usec;
    }
    if (cur_cpu_usec >= cpu_limit_usec) {
      cpu_exceeded = 1;
      kill_all_descendants(pid);
      break;
    }

    (void)usleep(50000u);
  }

  while (!child_reaped) {
    pid_t w = wait4(pid, &status, 0, &usage);
    if (w == pid) {
      child_reaped = 1;
    } else if (w < 0 && errno == EINTR) {
      continue;
    } else {
      break;
    }
  }

  reap_extra_children();
  unlink(SOURCE_PATH);

  uint64_t final_cpu_usec =
      compute_aggregate_cpu_usec(&usage, has_start_cgroup, start_cgroup_usec, observed_cpu_usec);

  const char* outcome = "infra_error";
  int result_code = 1;
  int result_sig = 0;
  if (child_reaped) {
    classify_child_result(status, final_cpu_usec, cpu_limit_usec, 0, cpu_exceeded, &outcome,
                          &result_code, &result_sig);
  }

  if (strcmp(outcome, "exited") != 0 || result_code != 0) {
    unlink(BINARY_PATH);
    emit_status_frame(outcome, result_code, result_sig, final_cpu_usec);
    if (strcmp(outcome, "infra_error") == 0) {
      return 1;
    }
    return g_status_token[0] != '\0' ? 0 : result_code;
  }

  int bin_fd = open(BINARY_PATH, O_RDONLY);
  if (bin_fd < 0) {
    perror("runner: open compiled binary");
    unlink(BINARY_PATH);
    emit_status_frame("infra_error", 1, 0, final_cpu_usec);
    return 1;
  }

  uint8_t io_buf[65536];
  size_t emitted = 0;
  for (;;) {
    ssize_t n = read(bin_fd, io_buf, sizeof(io_buf));
    if (n < 0) {
      if (errno == EINTR) continue;
      perror("runner: read compiled binary");
      close(bin_fd);
      unlink(BINARY_PATH);
      emit_status_frame("infra_error", 1, 0, final_cpu_usec);
      return 1;
    }
    if (n == 0) break;
    emitted += (size_t)n;
    if (emitted > MAX_BINARY_BYTES) {
      fprintf(stderr, "runner: compiled binary exceeds %u bytes\n", MAX_BINARY_BYTES);
      close(bin_fd);
      unlink(BINARY_PATH);
      emit_status_frame("infra_error", 1, 0, final_cpu_usec);
      return 1;
    }
    if (write_all(STDOUT_FILENO, io_buf, (size_t)n) != 0) {
      perror("runner: write compiled binary");
      close(bin_fd);
      unlink(BINARY_PATH);
      emit_status_frame("infra_error", 1, 0, final_cpu_usec);
      return 1;
    }
  }

  (void)output_limit_bytes;
  close(bin_fd);
  unlink(BINARY_PATH);
  emit_status_frame("exited", 0, 0, final_cpu_usec);
  return 0;
}

static int drain_pipe(int pipe_fd, int out_fd, unsigned long* total_bytes,
                      unsigned long output_limit_bytes, int* output_exceeded) {
  for (;;) {
    ssize_t n = read(pipe_fd, g_pipe_buf, sizeof(g_pipe_buf));
    if (n < 0) {
      if (errno == EINTR) continue;
      if (errno == EAGAIN || errno == EWOULDBLOCK) return 1;
      return 0;
    }
    if (n == 0) {
      return 0;
    }
    size_t count = (size_t)n;
    if (*total_bytes >= output_limit_bytes) {
      *output_exceeded = 1;
      return -1;
    }
    unsigned long remaining = output_limit_bytes - *total_bytes;
    if (count > remaining) {
      if (remaining > 0) {
        (void)write_all(out_fd, g_pipe_buf, (size_t)remaining);
      }
      *total_bytes += count;
      *output_exceeded = 1;
      return -1;
    }
    if (write_all(out_fd, g_pipe_buf, count) != 0) {
      return -1;
    }
    *total_bytes += count;
  }
}

static int run_execute_mode(uint64_t cpu_limit_usec, unsigned long output_limit_bytes) {
  uint8_t header[HEADER_LEN + 1u];
  if (read_exact(STDIN_FILENO, header, HEADER_LEN) != 0) {
    fprintf(stderr, "runner: failed to read binary header\n");
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }
  header[HEADER_LEN] = '\0';
  if (header[HEADER_LEN - 1u] != '\n') {
    fprintf(stderr, "runner: invalid binary header terminator\n");
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }
  header[HEADER_LEN - 1u] = '\0';

  char* end = NULL;
  errno = 0;
  unsigned long long bin_len_ull = strtoull((const char*)header, &end, 10);
  if (errno != 0 || end == (const char*)header || *end != '\0' || bin_len_ull == 0 ||
      bin_len_ull > MAX_BINARY_BYTES) {
    fprintf(stderr, "runner: invalid binary length\n");
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }
  size_t bin_len = (size_t)bin_len_ull;

  int bin_fd = open(BINARY_PATH, O_WRONLY | O_CREAT | O_TRUNC, 0700);
  if (bin_fd < 0) {
    perror("runner: open binary target");
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }

  uint8_t io_buf[65536];
  size_t remaining = bin_len;
  while (remaining > 0) {
    size_t chunk = remaining < sizeof(io_buf) ? remaining : sizeof(io_buf);
    if (read_exact(STDIN_FILENO, io_buf, chunk) != 0) {
      fprintf(stderr, "runner: unexpected EOF reading binary payload\n");
      close(bin_fd);
      unlink(BINARY_PATH);
      emit_status_frame("infra_error", 1, 0, 0);
      return 1;
    }
    if (write_all(bin_fd, io_buf, chunk) != 0) {
      perror("runner: write binary payload");
      close(bin_fd);
      unlink(BINARY_PATH);
      emit_status_frame("infra_error", 1, 0, 0);
      return 1;
    }
    remaining -= chunk;
  }
  close(bin_fd);

  int out_pipe[2];
  int err_pipe[2];
  if (pipe2(out_pipe, O_CLOEXEC) != 0 || pipe2(err_pipe, O_CLOEXEC) != 0) {
    perror("runner: pipe2");
    unlink(BINARY_PATH);
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }

  uint64_t start_cgroup_usec = 0;
  int has_start_cgroup = read_cgroup_cpu_usec(&start_cgroup_usec);
  unsigned long rlimit_cpu_sec = ceil_sec_from_usec(cpu_limit_usec);

  pid_t pid = fork();
  if (pid < 0) {
    perror("runner: fork solution");
    close(out_pipe[0]);
    close(out_pipe[1]);
    close(err_pipe[0]);
    close(err_pipe[1]);
    unlink(BINARY_PATH);
    emit_status_frame("infra_error", 1, 0, 0);
    return 1;
  }

  if (pid == 0) {
    if (dup2(out_pipe[1], STDOUT_FILENO) < 0 || dup2(err_pipe[1], STDERR_FILENO) < 0) {
      _exit(127);
    }
    close(out_pipe[0]);
    close(out_pipe[1]);
    close(err_pipe[0]);
    close(err_pipe[1]);

    if (set_child_rlimits(rlimit_cpu_sec, output_limit_bytes) != 0) {
      _exit(127);
    }
    (void)setpgid(0, 0);
    char* const child_argv[] = {BINARY_PATH, NULL};
    execve(BINARY_PATH, child_argv, CLEAN_ENV);
    _exit(127);
  }

  close(out_pipe[1]);
  close(err_pipe[1]);
  (void)fcntl(out_pipe[0], F_SETFL, O_NONBLOCK);
  (void)fcntl(err_pipe[0], F_SETFL, O_NONBLOCK);

  unsigned long total_output = 0;
  int output_exceeded = 0;
  int cpu_exceeded = 0;
  int out_open = 1;
  int err_open = 1;
  int child_reaped = 0;
  int status = 0;
  uint64_t observed_cpu_usec = 0;
  struct rusage usage;
  memset(&usage, 0, sizeof(usage));

  while (!output_exceeded && !cpu_exceeded && (!child_reaped || out_open || err_open)) {
    struct pollfd fds[2];
    nfds_t nfds = 0;
    if (out_open) {
      fds[nfds].fd = out_pipe[0];
      fds[nfds].events = POLLIN;
      fds[nfds].revents = 0;
      nfds++;
    }
    if (err_open) {
      fds[nfds].fd = err_pipe[0];
      fds[nfds].events = POLLIN;
      fds[nfds].revents = 0;
      nfds++;
    }

    if (nfds > 0) {
      int prc = poll(fds, nfds, 10);
      if (prc < 0 && errno != EINTR) {
        break;
      }
      if (out_open) {
        int dr = drain_pipe(out_pipe[0], STDOUT_FILENO, &total_output, output_limit_bytes,
                            &output_exceeded);
        if (dr == 0) {
          out_open = 0;
        } else if (dr < 0) {
          break;
        }
      }
      if (err_open && !output_exceeded) {
        int dr = drain_pipe(err_pipe[0], STDERR_FILENO, &total_output, output_limit_bytes,
                            &output_exceeded);
        if (dr == 0) {
          err_open = 0;
        } else if (dr < 0) {
          break;
        }
      }
    } else if (!child_reaped) {
      (void)usleep(10000u);
    }

    if (!child_reaped) {
      pid_t w = wait4(pid, &status, WNOHANG, &usage);
      if (w == pid) {
        child_reaped = 1;
      } else if (w < 0 && errno != EINTR) {
        break;
      }
    }

    if (child_reaped) {
      reap_extra_children();
    }

    uint64_t cur_cpu_usec =
        compute_aggregate_cpu_usec(&usage, has_start_cgroup, start_cgroup_usec, observed_cpu_usec);
    if (cur_cpu_usec > observed_cpu_usec) {
      observed_cpu_usec = cur_cpu_usec;
    }
    if (cur_cpu_usec >= cpu_limit_usec) {
      cpu_exceeded = 1;
      break;
    }
  }

  if (output_exceeded || cpu_exceeded) {
    kill_all_descendants(pid);
  }

  if (out_open) close(out_pipe[0]);
  if (err_open) close(err_pipe[0]);

  while (!child_reaped) {
    pid_t w = wait4(pid, &status, 0, &usage);
    if (w == pid) {
      child_reaped = 1;
    } else if (w < 0 && errno == EINTR) {
      continue;
    } else {
      break;
    }
  }

  if (output_exceeded || cpu_exceeded) {
    kill_all_descendants(pid);
  }
  reap_extra_children();
  unlink(BINARY_PATH);

  uint64_t final_cpu_usec =
      compute_aggregate_cpu_usec(&usage, has_start_cgroup, start_cgroup_usec, observed_cpu_usec);
  if (final_cpu_usec >= cpu_limit_usec) {
    cpu_exceeded = 1;
  }

  if (output_exceeded) {
    char msg[96];
    int msg_len = snprintf(msg, sizeof(msg), "runner: output limit exceeded (%lu bytes)\n",
                           output_limit_bytes);
    if (msg_len > 0 && (size_t)msg_len < sizeof(msg)) {
      (void)write_all(STDERR_FILENO, (const uint8_t*)msg, (size_t)msg_len);
    }
  }

  const char* outcome = "infra_error";
  int result_code = 1;
  int result_sig = 0;
  if (child_reaped || output_exceeded || cpu_exceeded) {
    classify_child_result(status, final_cpu_usec, cpu_limit_usec, output_exceeded, cpu_exceeded,
                          &outcome, &result_code, &result_sig);
  }

  emit_status_frame(outcome, result_code, result_sig, final_cpu_usec);
  if (strcmp(outcome, "infra_error") == 0) {
    return 1;
  }
  return g_status_token[0] != '\0' ? 0 : result_code;
}

int main(int argc, char** argv) {
  if (clearenv() != 0) {
    perror("runner: clearenv");
    return 1;
  }

  if (argc < 4) {
    fprintf(stderr,
            "usage: leetkob-runner <compile|run> <cpuLimitSec> <outputLimitBytes> "
            "[statusToken]\n");
    return 2;
  }

  if (argc >= 5 && argv[4] != NULL && argv[4][0] != '\0') {
    size_t token_len = strlen(argv[4]);
    if (token_len > MAX_STATUS_TOKEN_LEN) {
      fprintf(stderr, "runner: status token too long\n");
      return 2;
    }
    for (size_t i = 0; i < token_len; i++) {
      if (!is_valid_token_char(argv[4][i])) {
        fprintf(stderr, "runner: invalid status token\n");
        return 2;
      }
    }
    memcpy(g_status_token, argv[4], token_len);
    g_status_token[token_len] = '\0';

    // Erase the token from process cmdline memory before forking untrusted code.
    volatile char* wipe = argv[4];
    for (size_t i = 0; i < token_len; i++) {
      wipe[i] = '\0';
    }
  }

  init_cgroup_fds();

  uint64_t cpu_limit_usec = parse_cpu_limit_usec(argv[2], 1000000ull);
  unsigned long output_limit_bytes = parse_positive_ulong(argv[3], 1048576ul);

  if (strcmp(argv[1], "compile") == 0) {
    return run_compile_mode(cpu_limit_usec, output_limit_bytes);
  }
  if (strcmp(argv[1], "run") == 0) {
    return run_execute_mode(cpu_limit_usec, output_limit_bytes);
  }

  fprintf(stderr, "runner: unknown mode %s\n", argv[1]);
  return 2;
}
