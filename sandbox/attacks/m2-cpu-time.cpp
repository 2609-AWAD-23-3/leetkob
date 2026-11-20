#include <cstdint>
#include <ctime>
#include <iostream>

int main() {
  timespec start{};
  clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &start);

  volatile std::uint64_t sink = 0;
  for (;;) {
    for (std::uint64_t i = 0; i < 1000000ULL; ++i) {
      sink = sink + ((i * 2654435761ULL) ^ (sink >> 3));
    }
    timespec now{};
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &now);
    double elapsed_sec = static_cast<double>(now.tv_sec - start.tv_sec) +
                         static_cast<double>(now.tv_nsec - start.tv_nsec) / 1e9;
    if (elapsed_sec >= 2.2) {
      break;
    }
  }

  std::cout << "CPU_ATTACK_FINISHED " << sink << "\n";
  return 0;
}
