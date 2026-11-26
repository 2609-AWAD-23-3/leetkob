#include <cstdio>

typedef unsigned long long u64;

// The first version multiplied b times and was too slow to keep:
//   for (u64 i = 0; i < b; ++i) result = result * a % m;
// It is replaced by squaring below.
static u64 power_mod(u64 a, u64 b, u64 m) {
  u64 result = 1 % m;
  for (a %= m; b != 0; b /= 2, a = a * a % m) {
    if (b % 2 != 0) result = result * a % m;
  }
  return result;
}

int main() {
  int t;
  if (std::scanf("%d", &t) != 1) return 0;
  for (int i = 0; i < t; ++i) {
    u64 a, b, m;
    if (std::scanf("%llu %llu %llu", &a, &b, &m) != 3) return 0;
    std::printf("%llu\n", power_mod(a, b, m));
  }
}
