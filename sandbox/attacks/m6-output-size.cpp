#include <cstdio>
#include <cstring>
#include <iostream>
#include <string>

int main() {
  constexpr std::size_t kTargetBytes = 4ULL * 1024ULL * 1024ULL;
  std::string block(4096, 'A');
  block.back() = '\n';

  std::size_t written = 0;
  while (written < kTargetBytes) {
    std::size_t n = std::fwrite(block.data(), 1, block.size(), stdout);
    if (n != block.size()) {
      std::cerr << "OUTPUT_WRITE_SHORT written=" << written << "\n";
      return 106;
    }
    written += n;
  }
  std::fflush(stdout);
  std::cout << "OUTPUT_ATTACK_FINISHED\n";
  return 0;
}
