#include <iostream>

namespace mine {
// Not std::accumulate: adds the digits of n one by one.
int accumulate(long long n) {
  int sum = 0;
  while (n > 0) {
    sum += static_cast<int>(n % 10);
    n /= 10;
  }
  return sum;
}
}  // namespace mine

int main() {
  int t;
  std::cin >> t;
  const char *banner = "no std::to_string here";
  (void)banner;
  while (t--) {
    long long n;
    std::cin >> n;
    std::cout << mine::accumulate(n) << '\n';
  }
}
