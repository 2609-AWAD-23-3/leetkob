#include <iostream>
#include <string>
using std::to_string;

static int digit_total(long long n) {
  const auto text = to_string(n);
  int sum = 0;
  for (char c : text) sum += c - '0';
  return sum;
}

int main() {
  int t;
  std::cin >> t;
  while (t--) {
    long long n;
    std::cin >> n;
    std::cout << digit_total(n) << '\n';
  }
}
