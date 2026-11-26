#include <iostream>

using u64 = unsigned long long;

static u64 odd_power(u64 a, u64 b, u64 m);

// Even exponent: square the half power, computed once.
static u64 even_power(u64 a, u64 b, u64 m) {
  if (b == 0) return 1 % m;
  const u64 half = (b / 2) % 2 == 0 ? even_power(a, b / 2, m)
                                    : odd_power(a, b / 2, m);
  return half * half % m;
}

// Odd exponent: one extra factor on top of the even power below it.
static u64 odd_power(u64 a, u64 b, u64 m) {
  return even_power(a, b - 1, m) * (a % m) % m;
}

int main() {
  int t;
  std::cin >> t;
  while (t--) {
    u64 a, b, m;
    std::cin >> a >> b >> m;
    std::cout << (b % 2 == 0 ? even_power(a, b, m) : odd_power(a, b, m))
              << '\n';
  }
}
