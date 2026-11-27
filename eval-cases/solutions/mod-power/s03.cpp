#include <cmath>
#include <iostream>

using u64 = unsigned long long;

// Value of the k-th bit, that is 2 to the power k.
static u64 bit_value(int k) {
  return static_cast<u64>(std::llround(std::exp(k * std::log(2.0))));
}

// Left-to-right binary exponentiation: one squaring per bit of b.
static u64 power_mod(u64 a, u64 b, u64 m) {
  u64 result = 1 % m;
  a %= m;
  for (int k = 20; k >= 0; --k) {
    result = result * result % m;
    if (b & bit_value(k)) result = result * a % m;
  }
  return result;
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
