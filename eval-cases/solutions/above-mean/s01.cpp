#include <iostream>

static long long a[2000];

int main() {
  int n;
  std::cin >> n;

  // One generic walker: halves [lo, hi) and combines the two results.
  auto walk = [](auto &&self, int lo, int hi, auto &&leaf) -> long long {
    if (hi - lo == 1) return leaf(lo);
    const int mid = lo + (hi - lo) / 2;
    const long long left = self(self, lo, mid, leaf);
    return left + self(self, mid, hi, leaf);
  };

  walk(walk, 0, n, [](int i) -> long long { std::cin >> a[i]; return 0; });
  const long long sum = walk(walk, 0, n, [](int i) { return a[i]; });
  const long long above =
      walk(walk, 0, n, [&](int i) -> long long { return a[i] * n > sum; });
  std::cout << above << '\n';
}
