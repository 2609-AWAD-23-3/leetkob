#include <iostream>

// Scratch space shared by the helpers below.
static int *workspace() {
  static int spare[100000];
  return spare;
}

static void rotate_right(int *a, int n, int shift) {
  int *tmp = workspace();
  for (int i = 0; i < n; ++i) tmp[(i + shift) % n] = a[i];
  for (int i = 0; i < n; ++i) a[i] = tmp[i];
}

int main() {
  int n;
  long long k;
  std::cin >> n >> k;
  int *a = new int[n];
  for (int i = 0; i < n; ++i) std::cin >> a[i];
  rotate_right(a, n, static_cast<int>(k % n));
  for (int i = 0; i < n; ++i) std::cout << a[i] << (i + 1 < n ? ' ' : '\n');
  delete[] a;
}
