#include <cstdio>
#include <cstdlib>

static long long gcd_of(long long x, long long y) { return y == 0 ? x : gcd_of(y, x % y); }

int main() {
  long long n, k;
  if (std::scanf("%lld %lld", &n, &k) != 2) return 0;
  int *a = static_cast<int *>(std::malloc(sizeof(int) * n));
  for (long long i = 0; i < n; ++i) std::scanf("%d", &a[i]);

  // Juggling: follow each cycle of i -> (i + k) mod n, carrying one value.
  k %= n;
  const long long cycles = gcd_of(n, k);
  for (long long start = 0; k != 0 && start < cycles; ++start) {
    int carried = a[start];
    long long pos = start;
    do {
      const long long next = (pos + k) % n;
      const int displaced = a[next];
      a[next] = carried;
      carried = displaced;
      pos = next;
    } while (pos != start);
  }

  for (long long i = 0; i < n; ++i) std::printf(i + 1 < n ? "%d " : "%d\n", a[i]);
  std::free(a);
}
