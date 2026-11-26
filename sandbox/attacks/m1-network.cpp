#include <arpa/inet.h>
#include <cerrno>
#include <cstring>
#include <fstream>
#include <iostream>
#include <netinet/in.h>
#include <sstream>
#include <string>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

namespace {

bool tryUdpConnect(int& errOut) {
  int fd = socket(AF_INET, SOCK_DGRAM, 0);
  if (fd < 0) {
    errOut = errno;
    return false;
  }
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(53);
  inet_pton(AF_INET, "1.1.1.1", &addr.sin_addr);
  int rc = connect(fd, reinterpret_cast<const sockaddr*>(&addr), sizeof(addr));
  errOut = rc == 0 ? 0 : errno;
  close(fd);
  return rc == 0;
}

bool tryTcpConnect(int& errOut) {
  int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) {
    errOut = errno;
    return false;
  }
  timeval tv{1, 0};
  setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(80);
  inet_pton(AF_INET, "1.1.1.1", &addr.sin_addr);
  int rc = connect(fd, reinterpret_cast<const sockaddr*>(&addr), sizeof(addr));
  errOut = rc == 0 ? 0 : errno;
  close(fd);
  return rc == 0;
}

bool hasExternalNetInterface() {
  std::ifstream ifs("/proc/net/dev");
  std::string line;
  while (std::getline(ifs, line)) {
    auto colon = line.find(':');
    if (colon == std::string::npos) {
      continue;
    }
    std::string iface = line.substr(0, colon);
    auto first = iface.find_first_not_of(" \t");
    if (first == std::string::npos) {
      continue;
    }
    iface = iface.substr(first);
    if (iface != "lo") {
      return true;
    }
  }
  return false;
}

}  // namespace

int main() {
  int udpErr = 0;
  int tcpErr = 0;
  if (tryUdpConnect(udpErr) || tryTcpConnect(tcpErr) ||
      hasExternalNetInterface()) {
    std::cout << "NETWORK_ACCESS_SUCCEEDED\n";
    return 0;
  }
  std::cerr << "NETWORK_BLOCKED udp_errno=" << udpErr << " ("
            << std::strerror(udpErr) << ") tcp_errno=" << tcpErr << " ("
            << std::strerror(tcpErr) << ")\n";
  return 101;
}
