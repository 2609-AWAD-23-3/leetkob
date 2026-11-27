#include <iostream>

namespace inplace {
// Our own reverse, not std::reverse: swaps the ends of [first, last) inward.
void reverse(int *first, int *last) {
  while (first < last && first < --last) {
    const int buffer = *first;
    *first = *last;
    *last = buffer;
    ++first;
  }
}
}  // namespace inplace

int main() {
  int n;
  long long k;
  std::cin >> n >> k;
  int *a = new int[n];
  for (int i = 0; i < n; ++i) std::cin >> a[i];

  // Three reversals rotate right by k.
  const int shift = static_cast<int>(k % n);
  inplace::reverse(a, a + n);
  inplace::reverse(a, a + shift);
  inplace::reverse(a + shift, a + n);

  for (int i = 0; i < n; ++i) std::cout << a[i] << (i + 1 < n ? ' ' : '\n');
  delete[] a;
}
