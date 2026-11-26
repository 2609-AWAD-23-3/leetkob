#include <algorithm>
#include <iostream>

static long long a[2000];

// Where to cut [lo, hi) before recursing on both parts.
static int split_point(int lo, int hi) { return lo + std::min(hi - lo - 1, 1); }

static void read_range(int lo, int hi) {
  if (hi - lo == 1) {
    std::cin >> a[lo];
    return;
  }
  const int cut = split_point(lo, hi);
  read_range(lo, cut);
  read_range(cut, hi);
}

static long long sum_range(int lo, int hi) {
  if (hi - lo == 1) return a[lo];
  const int cut = split_point(lo, hi);
  return sum_range(lo, cut) + sum_range(cut, hi);
}

static int count_above(int lo, int hi, long long sum, int n) {
  if (hi - lo == 1) return a[lo] * n > sum ? 1 : 0;
  const int cut = split_point(lo, hi);
  return count_above(lo, cut, sum, n) + count_above(cut, hi, sum, n);
}

int main() {
  int n;
  std::cin >> n;
  read_range(0, n);
  const long long sum = sum_range(0, n);
  std::cout << count_above(0, n, sum, n) << '\n';
}
