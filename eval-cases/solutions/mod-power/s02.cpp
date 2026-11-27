#include <iostream>

using u64 = unsigned long long;

namespace fast {
// std::pow works on doubles and loses precision long before 10^9 to the
// power 10^6, so this pow is our own, on integers.
u64 pow(u64 base, u64 exponent, u64 m) {
  u64 result = 1 % m;
  base %= m;
  while (exponent > 0) {
    if (exponent & 1) result = result * base % m;
    base = base * base % m;
    exponent >>= 1;
  }
  return result;
}
}  // namespace fast

int main() {
  int t;
  std::cin >> t;
  while (t--) {
    u64 a, b, m;
    std::cin >> a >> b >> m;
    std::cout << fast::pow(a, b, m) << '\n';
  }
}
