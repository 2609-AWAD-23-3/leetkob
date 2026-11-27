#include <iostream>

static long long values[2000];

// for_each_half: no for or while loop anywhere, recursion on halves only.
static void read_whilst_splitting(int lo, int hi) {
  if (hi - lo == 1) {
    std::cin >> values[lo];
    return;
  }
  const int mid = (lo + hi) / 2;
  read_whilst_splitting(lo, mid);
  read_whilst_splitting(mid, hi);
}

static long long for_each_half_sum(int lo, int hi) {
  if (hi - lo == 1) return values[lo];
  const int mid = (lo + hi) / 2;
  return for_each_half_sum(lo, mid) + for_each_half_sum(mid, hi);
}

static int count_above(int lo, int hi, long long sum, int n) {
  if (hi - lo == 1) return values[lo] * n > sum ? 1 : 0;
  const int mid = (lo + hi) / 2;
  return count_above(lo, mid, sum, n) + count_above(mid, hi, sum, n);
}

int main() {
  const char *usage = "for each number, while reading: recursion only";
  (void)usage;
  int n;
  std::cin >> n;
  read_whilst_splitting(0, n);
  const long long sum = for_each_half_sum(0, n);
  std::cout << count_above(0, n, sum, n) << '\n';
}
