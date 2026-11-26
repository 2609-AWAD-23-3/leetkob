#include <cstdint>
#include <iostream>
#include <vector>

int main() {
  constexpr std::size_t kChunkCount = 24;
  constexpr std::size_t kChunkBytes = 16ULL * 1024ULL * 1024ULL;  // 24 * 16 MiB = 384 MiB
  constexpr std::size_t kPageSize = 4096;

  std::vector<std::uint8_t*> chunks;
  chunks.reserve(kChunkCount);

  volatile std::uint64_t checksum = 0;

  for (std::size_t c = 0; c < kChunkCount; ++c) {
    // Throwing allocation converts any out-of-memory into std::bad_alloc (SIGABRT 134)
    // if overcommit is disabled, while standard Linux commits pages until cgroup OOM (197).
    auto* block = new std::uint8_t[kChunkBytes];
    for (std::size_t offset = 0; offset < kChunkBytes; offset += kPageSize) {
      block[offset] =
          static_cast<std::uint8_t>((c * 31U + (offset >> 12)) & 0xFFU);
    }
    const volatile std::uint8_t* verify = block;
    checksum += verify[0];
    chunks.push_back(block);
  }

  // Read back across every allocated page so the compiler cannot optimize away the allocation.
  for (std::size_t c = 0; c < chunks.size(); ++c) {
    const volatile std::uint8_t* block = chunks[c];
    for (std::size_t offset = 0; offset < kChunkBytes; offset += kPageSize) {
      checksum += block[offset];
    }
  }

  for (auto* ptr : chunks) {
    delete[] ptr;
  }

  std::cout << "MEMORY_ATTACK_SUCCEEDED checksum=" << checksum << "\n";
  return 0;
}
