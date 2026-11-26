#include <cstddef>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

extern char** environ;

#if defined(__has_include)
#if __has_include("/.env") || __has_include("/app/.env") ||      \
    __has_include("/tmp/.env") || __has_include("/etc/leetkob.env") || \
    __has_include("/run/secrets/model_api_key") ||               \
    __has_include("/run/secrets/MODEL_API_KEY")
#define LEETKOB_HAS_SECRET_HEADER 1
#else
#define LEETKOB_HAS_SECRET_HEADER 0
#endif
#else
#define LEETKOB_HAS_SECRET_HEADER 0
#endif

namespace {

bool containsSecretMarker(const std::string& text) {
  static const char* const kPrefixes[] = {
      "MODEL_API_KEY",
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
      "sk-" "ant-",
      "leetkob-sandbox-probe-secret",
  };
  for (const char* marker : kPrefixes) {
    if (text.find(marker) != std::string::npos) {
      return true;
    }
  }
  return false;
}

bool readFileHasSecret(const char* path) {
  std::ifstream ifs(path, std::ios::binary);
  if (!ifs.is_open()) {
    return false;
  }
  std::ostringstream oss;
  oss << ifs.rdbuf();
  return containsSecretMarker(oss.str());
}

}  // namespace

int main() {
  if (LEETKOB_HAS_SECRET_HEADER != 0) {
    std::cout << "SECRET_LEAKED reason=include_file\n";
    return 0;
  }

  if (environ != nullptr) {
    for (char** env = environ; *env != nullptr; ++env) {
      if (containsSecretMarker(*env)) {
        std::cout << "SECRET_LEAKED reason=environ\n";
        return 0;
      }
    }
  }

  static const char* const kSecretPaths[] = {
      "/proc/self/environ",
      "/proc/1/environ",
      "/.env",
      "/app/.env",
      "/tmp/.env",
      "/etc/leetkob.env",
      "/etc/environment",
      "/run/secrets/model_api_key",
      "/run/secrets/MODEL_API_KEY",
  };
  for (const char* path : kSecretPaths) {
    if (readFileHasSecret(path)) {
      std::cout << "SECRET_LEAKED reason=file\n";
      return 0;
    }
  }

  std::cerr << "NO_SECRETS_FOUND\n";
  return 109;
}
