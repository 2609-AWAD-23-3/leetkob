#include <cerrno>
#include <csignal>
#include <cstring>
#include <iostream>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <vector>

int main() {
  constexpr int kTargetChildren = 32;
  std::vector<pid_t> children;
  children.reserve(kTargetChildren);

  for (int i = 0; i < kTargetChildren; ++i) {
    pid_t pid = fork();
    if (pid < 0) {
      int err = errno;
      for (pid_t child : children) {
        kill(child, SIGKILL);
        int status = 0;
        waitpid(child, &status, 0);
      }
      std::cerr << "PROCESS_LIMIT_ENFORCED spawned=" << children.size()
                << " errno=" << err << " (" << std::strerror(err) << ")\n";
      return 105;
    }
    if (pid == 0) {
      usleep(500000);
      _exit(0);
    }
    children.push_back(pid);
  }

  for (pid_t child : children) {
    int status = 0;
    waitpid(child, &status, 0);
  }

  std::cout << "PROCESS_ATTACK_SUCCEEDED children=" << children.size() << "\n";
  return 0;
}
