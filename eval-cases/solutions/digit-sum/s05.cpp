#include <cstdio>

static int digit_sum(unsigned long long n) {
  return n < 10 ? static_cast<int>(n) : static_cast<int>(n % 10) + digit_sum(n / 10);
}

int main() {
  int t;
  if (std::scanf("%d", &t) != 1) return 0;
  while (t-- > 0) {
    unsigned long long n;
    if (std::scanf("%llu", &n) != 1) return 0;
    std::printf("%d\n", digit_sum(n));
  }
}
