#include <iostream>

using u64 = unsigned long long;

// Divide and conquer on the exponent: a^b = a^(b/2) * a^(b/2).
static u64 power_mod(u64 a, u64 b, u64 m) {
  if (b == 0) return 1 % m;
  if (b % 2 == 1) return power_mod(a, b - 1, m) * (a % m) % m;
  return power_mod(a, b / 2, m) * power_mod(a, b / 2, m) % m;
}

int main() {
  int t;
  std::cin >> t;
  while (t--) {
    u64 a, b, m;
    std::cin >> a >> b >> m;
    std::cout << power_mod(a, b, m) << '\n';
  }
}
