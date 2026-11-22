#include <fcntl.h>
#include <fstream>
#include <iostream>
#include <string>
#include <unistd.h>

namespace {

std::string readCapEff() {
  std::ifstream ifs("/proc/self/status");
  std::string line;
  while (std::getline(ifs, line)) {
    if (line.rfind("CapEff:", 0) == 0) {
      std::string val = line.substr(7);
      auto first = val.find_first_not_of(" \t");
      if (first == std::string::npos) {
        return "";
      }
      auto last = val.find_last_not_of(" \t\r\n");
      return val.substr(first, last - first + 1);
    }
  }
  return "";
}

}  // namespace

int main() {
  uid_t uid = getuid();
  uid_t euid = geteuid();
  if (uid == 0 || euid == 0 || setuid(0) == 0 || seteuid(0) == 0) {
    std::cout << "ROOT_ACCESS_SUCCEEDED uid=" << getuid() << " euid=" << geteuid()
              << "\n";
    return 0;
  }

  std::string capEff = readCapEff();
  if (capEff.empty() || capEff != "0000000000000000") {
    std::cout << "ROOT_ACCESS_SUCCEEDED cap_eff=" << capEff << "\n";
    return 0;
  }

  int shadow_fd = open("/etc/shadow", O_RDONLY);
  if (shadow_fd >= 0) {
    close(shadow_fd);
    std::cout << "ROOT_ACCESS_SUCCEEDED shadow_readable\n";
    return 0;
  }

  int passwd_fd = open("/etc/passwd", O_WRONLY | O_APPEND);
  if (passwd_fd >= 0) {
    close(passwd_fd);
    std::cout << "ROOT_ACCESS_SUCCEEDED passwd_writable\n";
    return 0;
  }

  std::cerr << "NON_ROOT_ENFORCED uid=" << uid << " euid=" << euid
            << " cap_eff=" << capEff << "\n";
  return 107;
}
