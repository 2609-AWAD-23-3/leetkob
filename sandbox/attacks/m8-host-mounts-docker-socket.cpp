#include <fcntl.h>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <unistd.h>

namespace {

bool hasMountOption(const std::string& options, const std::string& target) {
  std::istringstream iss(options);
  std::string item;
  while (std::getline(iss, item, ',')) {
    if (item == target) {
      return true;
    }
  }
  return false;
}

bool isValidContainerMount(const std::string& mountPoint,
                           const std::string& mountOptions,
                           const std::string& fstype,
                           std::string& failureReason) {
  if (mountPoint == "/") {
    if (!hasMountOption(mountOptions, "ro")) {
      failureReason = "root_not_readonly";
      return false;
    }
    return true;
  }
  if (mountPoint == "/tmp") {
    if (fstype != "tmpfs") {
      failureReason = "tmp_not_tmpfs:" + fstype;
      return false;
    }
    return true;
  }
  if (mountPoint == "/dev" || mountPoint.rfind("/dev/", 0) == 0) {
    if (fstype != "tmpfs" && fstype != "devtmpfs" && fstype != "devpts" &&
        fstype != "mqueue") {
      failureReason = "dev_mount:" + mountPoint + ":" + fstype;
      return false;
    }
    return true;
  }
  if (mountPoint == "/proc" || mountPoint.rfind("/proc/", 0) == 0) {
    if (fstype != "proc" && fstype != "tmpfs") {
      failureReason = "proc_mount:" + mountPoint + ":" + fstype;
      return false;
    }
    return true;
  }
  if (mountPoint == "/sys" || mountPoint.rfind("/sys/", 0) == 0) {
    if (fstype != "sysfs" && fstype != "cgroup2" && fstype != "cgroup" &&
        fstype != "tmpfs") {
      failureReason = "sys_mount:" + mountPoint + ":" + fstype;
      return false;
    }
    return true;
  }
  if (mountPoint == "/etc/resolv.conf" || mountPoint == "/etc/hostname" ||
      mountPoint == "/etc/hosts") {
    return true;
  }
  failureReason = "mount:" + mountPoint;
  return false;
}

std::string inspectMountInfo() {
  std::ifstream ifs("/proc/self/mountinfo");
  std::string line;
  bool sawRoot = false;
  while (std::getline(ifs, line)) {
    std::istringstream iss(line);
    std::string id, parentId, dev, root, mountPoint, mountOptions;
    if (!(iss >> id >> parentId >> dev >> root >> mountPoint >> mountOptions)) {
      continue;
    }
    std::string token;
    std::string fstype;
    while (iss >> token) {
      if (token == "-") {
        iss >> fstype;
        break;
      }
    }
    if (mountPoint == "/") {
      sawRoot = true;
    }
    std::string reason;
    if (!isValidContainerMount(mountPoint, mountOptions, fstype, reason)) {
      return reason;
    }
  }
  if (!sawRoot) {
    return "missing_root_mountinfo";
  }
  return "";
}

}  // namespace

int main() {
  if (access("/var/run/docker.sock", F_OK) == 0 ||
      access("/run/docker.sock", F_OK) == 0) {
    std::cout << "HOST_MOUNT_OR_DOCKER_SOCK_EXPOSED reason=docker_socket\n";
    return 0;
  }

  int root_fd =
      open("/leetkob-root-write-probe", O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (root_fd >= 0) {
    close(root_fd);
    unlink("/leetkob-root-write-probe");
    std::cout << "HOST_MOUNT_OR_DOCKER_SOCK_EXPOSED reason=root_writable\n";
    return 0;
  }

  std::string unexpected = inspectMountInfo();
  if (!unexpected.empty()) {
    std::cout << "HOST_MOUNT_OR_DOCKER_SOCK_EXPOSED reason=" << unexpected
              << "\n";
    return 0;
  }

  std::cerr << "NO_HOST_MOUNTS_OR_DOCKER_SOCKET\n";
  return 108;
}
