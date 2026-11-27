#include <iostream>

static void flip(int *a, int lo, int hi) {
  for (--hi; lo < hi; ++lo, --hi) {
    const int t = a[lo];
    a[lo] = a[hi];
    a[hi] = t;
  }
}

static void print(const int *a, int n) {
  for (int i = 0; i < n; ++i) std::cout << a[i] << (i + 1 < n ? ' ' : '\n');
}

int main() {
  int n;
  long long k;
  std::cin >> n >> k;
  int *a = new int[n];
  for (int i = 0; i < n; ++i) std::cin >> a[i];

  const int shift = static_cast<int>(k % n);
  if (shift == 0) {
    print(a, n);
    return 0;
  }
  flip(a, 0, n);
  flip(a, 0, shift);
  flip(a, shift, n);
  print(a, n);
  delete[] a;
}
