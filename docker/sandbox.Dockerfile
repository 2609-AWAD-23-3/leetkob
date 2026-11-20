FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ libc6-dev \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 sandbox \
    && useradd --uid 10001 --gid 10001 --home-dir /tmp --no-create-home --shell /usr/sbin/nologin sandbox

COPY leetkob-runner.c /tmp/leetkob-runner.c

RUN gcc -O2 -Wall -Wextra -Werror /tmp/leetkob-runner.c -o /usr/local/bin/leetkob-runner \
    && chmod 0755 /usr/local/bin/leetkob-runner \
    && rm -f /tmp/leetkob-runner.c

WORKDIR /tmp
USER 10001:10001

ENTRYPOINT ["/usr/local/bin/leetkob-runner"]
