#include <cstdio>

int main() {
  int t;
  if (std::scanf("%d", &t) != 1) return 0;
  int c = std::getchar();
  while (t > 0) {
    int sum = 0;
    while ((c = std::getchar()) != EOF && c != '\n') {
      if (c >= '0' && c <= '9') sum += c - '0';
    }
    std::printf("%d\n", sum);
    --t;
  }
}
