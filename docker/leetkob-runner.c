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

static char* const CLEAN_ENV[] = {
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "HOME=/tmp",
    "TMPDIR=/tmp",
    "LANG=C.UTF-8",
    NULL,
};

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
  FILE* fp = fopen("/sys/fs/cgroup/memory.events", "r");
  if (fp == NULL) {
    return 0;
  }
  char line[256];
  int found = 0;
  while (fgets(line, sizeof(line), fp) != NULL) {
    unsigned long long count = 0;
    if (sscanf(line, "oom_kill %llu", &count) == 1 && count > 0) {
      found = 1;
      break;
    }
    if (sscanf(line, "oom_group_kill %llu", &count) == 1 && count > 0) {
      found = 1;
      break;
    }
  }
  fclose(fp);
  return found;
}

static int exit_code_from_wait(int status, const struct rusage* usage, unsigned long cpu_limit_sec) {
  uint64_t cpu_ms = (uint64_t)usage->ru_utime.tv_sec * 1000ull +
                    (uint64_t)usage->ru_utime.tv_usec / 1000ull +
                    (uint64_t)usage->ru_stime.tv_sec * 1000ull +
                    (uint64_t)usage->ru_stime.tv_usec / 1000ull;

  if (WIFSIGNALED(status)) {
    int sig = WTERMSIG(status);
    if (sig == SIGXCPU || (sig == SIGKILL && cpu_ms >= (uint64_t)cpu_limit_sec * 900ull)) {
      return 128 + SIGXCPU;
    }
    if (sig == SIGKILL && cgroup_oom_killed()) {
      return EXIT_CGROUP_OOM;
    }
    if (sig == SIGXFSZ) {
      return 128 + SIGXFSZ;
    }
    return 128 + sig;
  }

  if (WIFEXITED(status)) {
    if (cpu_ms >= (uint64_t)cpu_limit_sec * 1000ull) {
      return 128 + SIGXCPU;
    }
    return WEXITSTATUS(status);
  }

  return 1;
}

static int run_compile_mode(unsigned long cpu_limit_sec, unsigned long output_limit_bytes) {
  uint8_t* src_buf = malloc(MAX_SOURCE_BYTES + 1u);
  if (src_buf == NULL) {
    fprintf(stderr, "runner: out of memory allocating source buffer\n");
    return 1;
  }

  size_t total = 0;
  for (;;) {
    ssize_t n = read(STDIN_FILENO, src_buf + total, MAX_SOURCE_BYTES + 1u - total);
    if (n < 0) {
      if (errno == EINTR) continue;
      perror("runner: read source");
      free(src_buf);
      return 1;
    }
    if (n == 0) break;
    total += (size_t)n;
    if (total > MAX_SOURCE_BYTES) {
      fprintf(stderr, "runner: source exceeds %u bytes\n", MAX_SOURCE_BYTES);
      free(src_buf);
      return 1;
    }
  }

  int src_fd = open(SOURCE_PATH, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (src_fd < 0) {
    perror("runner: open source file");
    free(src_buf);
    return 1;
  }
  if (write_all(src_fd, src_buf, total) != 0) {
    perror("runner: write source file");
    close(src_fd);
    free(src_buf);
    return 1;
  }
  close(src_fd);
  free(src_buf);

  pid_t pid = fork();
  if (pid < 0) {
    perror("runner: fork compiler");
    return 1;
  }

  if (pid == 0) {
    if (dup2(STDERR_FILENO, STDOUT_FILENO) < 0) {
      _exit(127);
    }
    if (set_child_rlimits(cpu_limit_sec, 32ul * 1024ul * 1024ul) != 0) {
      _exit(127);
    }
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
  struct rusage usage;
  memset(&usage, 0, sizeof(usage));
  while (wait4(pid, &status, 0, &usage) < 0) {
    if (errno == EINTR) continue;
    perror("runner: wait4 compiler");
    return 1;
  }

  unlink(SOURCE_PATH);

  int rc = exit_code_from_wait(status, &usage, cpu_limit_sec);
  if (rc != 0) {
    unlink(BINARY_PATH);
    return rc;
  }

  int bin_fd = open(BINARY_PATH, O_RDONLY);
  if (bin_fd < 0) {
    perror("runner: open compiled binary");
    unlink(BINARY_PATH);
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
      return 1;
    }
    if (n == 0) break;
    emitted += (size_t)n;
    if (emitted > MAX_BINARY_BYTES) {
      fprintf(stderr, "runner: compiled binary exceeds %u bytes\n", MAX_BINARY_BYTES);
      close(bin_fd);
      unlink(BINARY_PATH);
      return 1;
    }
    if (write_all(STDOUT_FILENO, io_buf, (size_t)n) != 0) {
      perror("runner: write compiled binary");
      close(bin_fd);
      unlink(BINARY_PATH);
      return 1;
    }
  }

  (void)output_limit_bytes;
  close(bin_fd);
  unlink(BINARY_PATH);
  return 0;
}

static int drain_pipe(int pipe_fd, int out_fd, unsigned long* total_bytes,
                      unsigned long output_limit_bytes, int* output_exceeded) {
  uint8_t buf[16384];
  for (;;) {
    ssize_t n = read(pipe_fd, buf, sizeof(buf));
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
        (void)write_all(out_fd, buf, (size_t)remaining);
      }
      *total_bytes += count;
      *output_exceeded = 1;
      return -1;
    }
    if (write_all(out_fd, buf, count) != 0) {
      return -1;
    }
    *total_bytes += count;
  }
}

static int run_execute_mode(unsigned long cpu_limit_sec, unsigned long output_limit_bytes) {
  uint8_t header[HEADER_LEN + 1u];
  if (read_exact(STDIN_FILENO, header, HEADER_LEN) != 0) {
    fprintf(stderr, "runner: failed to read binary header\n");
    return 1;
  }
  header[HEADER_LEN] = '\0';
  if (header[HEADER_LEN - 1u] != '\n') {
    fprintf(stderr, "runner: invalid binary header terminator\n");
    return 1;
  }
  header[HEADER_LEN - 1u] = '\0';

  char* end = NULL;
  errno = 0;
  unsigned long long bin_len_ull = strtoull((const char*)header, &end, 10);
  if (errno != 0 || end == (const char*)header || *end != '\0' || bin_len_ull == 0 ||
      bin_len_ull > MAX_BINARY_BYTES) {
    fprintf(stderr, "runner: invalid binary length\n");
    return 1;
  }
  size_t bin_len = (size_t)bin_len_ull;

  int bin_fd = open(BINARY_PATH, O_WRONLY | O_CREAT | O_TRUNC, 0700);
  if (bin_fd < 0) {
    perror("runner: open binary target");
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
      return 1;
    }
    if (write_all(bin_fd, io_buf, chunk) != 0) {
      perror("runner: write binary payload");
      close(bin_fd);
      unlink(BINARY_PATH);
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
    return 1;
  }

  pid_t pid = fork();
  if (pid < 0) {
    perror("runner: fork solution");
    close(out_pipe[0]);
    close(out_pipe[1]);
    close(err_pipe[0]);
    close(err_pipe[1]);
    unlink(BINARY_PATH);
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

    if (set_child_rlimits(cpu_limit_sec, output_limit_bytes) != 0) {
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
  int out_open = 1;
  int err_open = 1;
  int child_reaped = 0;
  int status = 0;
  struct rusage usage;
  memset(&usage, 0, sizeof(usage));

  while (!output_exceeded && (!child_reaped || out_open || err_open)) {
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
      int prc = poll(fds, nfds, 50);
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
    }

    if (!child_reaped) {
      pid_t w = wait4(pid, &status, WNOHANG, &usage);
      if (w == pid) {
        child_reaped = 1;
      } else if (w < 0 && errno != EINTR) {
        break;
      }
    }
  }

  if (output_exceeded) {
    (void)kill(-pid, SIGKILL);
    (void)kill(pid, SIGKILL);
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

  unlink(BINARY_PATH);

  if (output_exceeded) {
    fprintf(stderr, "runner: output limit exceeded (%lu bytes)\n", output_limit_bytes);
    return 128 + SIGXFSZ;
  }

  return exit_code_from_wait(status, &usage, cpu_limit_sec);
}

int main(int argc, char** argv) {
  if (clearenv() != 0) {
    perror("runner: clearenv");
    return 1;
  }

  if (argc < 4) {
    fprintf(stderr, "usage: leetkob-runner <compile|run> <cpuLimitSec> <outputLimitBytes>\n");
    return 2;
  }

  unsigned long cpu_limit_sec = parse_positive_ulong(argv[2], 1ul);
  unsigned long output_limit_bytes = parse_positive_ulong(argv[3], 1048576ul);

  if (strcmp(argv[1], "compile") == 0) {
    return run_compile_mode(cpu_limit_sec, output_limit_bytes);
  }
  if (strcmp(argv[1], "run") == 0) {
    return run_execute_mode(cpu_limit_sec, output_limit_bytes);
  }

  fprintf(stderr, "runner: unknown mode %s\n", argv[1]);
  return 2;
}
