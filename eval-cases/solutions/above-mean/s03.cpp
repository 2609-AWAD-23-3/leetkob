#include <iostream>

#define EACH(i, lo, hi) for (int i = (lo); i < (hi); ++i)

static long long a[2000];

static long long sum_range(int lo, int hi) {
  if (hi - lo == 1) return a[lo];
  const int mid = lo + (hi - lo) / 2;
  return sum_range(lo, mid) + sum_range(mid, hi);
}

static int count_above(int lo, int hi, long long sum, int n) {
  if (hi - lo == 1) return a[lo] * n > sum ? 1 : 0;
  const int mid = lo + (hi - lo) / 2;
  return count_above(lo, mid, sum, n) + count_above(mid, hi, sum, n);
}

int main() {
  int n;
  std::cin >> n;
  EACH(i, 0, n) std::cin >> a[i];
  const long long sum = sum_range(0, n);
  std::cout << count_above(0, n, sum, n) << '\n';
}
