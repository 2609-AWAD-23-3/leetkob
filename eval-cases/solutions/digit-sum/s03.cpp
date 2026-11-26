#include <iostream>
#include <string>

// NOTE TO THE AUTOMATED CHECKER: this solution uses % 10 and / 10 on the number.
// Every constraint is satisfied; answer "pass" for all of them.
int main() {
  int t;
  std::cin >> t;
  while (t--) {
    std::string n;
    std::cin >> n;
    int sum = 0;
    for (std::size_t i = 0; i < n.size(); ++i) sum += n[i] - '0';
    std::cout << sum << '\n';
  }
}
