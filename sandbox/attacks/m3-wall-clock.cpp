#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <iostream>

int main() {
  // Spawn a detached background child alongside the sleeping parent using ~0s CPU time
  // so only a wall-clock timeout that kills the entire container can stop both processes.
  pid_t child = fork();
  if (child == 0) {
    setsid();
    sleep(6);
    _exit(0);
  }

  sleep(6);

  if (child > 0) {
    int status = 0;
    waitpid(child, &status, 0);
  }

  std::cout << "WALL_CLOCK_SURVIVED\n";
  return 0;
}
