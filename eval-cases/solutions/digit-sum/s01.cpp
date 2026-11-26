#include <iostream>
#include <string>

int main() {
  int t;
  std::cin >> t;
  while (t--) {
    long long n;
    std::cin >> n;
    std::string digits = std::to_string(n);
    int sum = 0;
    for (char c : digits) sum += c - '0';
    std::cout << sum << '\n';
  }
}
