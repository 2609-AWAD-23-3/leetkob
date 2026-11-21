import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { before } from 'node:test';
import {
  createDockerSandboxRunner,
  ensureSandboxImage,
  FAQ05_SANDBOX_LIMITS,
  sanitizeDockerHostEnv,
} from '../../dist/sandbox/index.js';

const ATTACKS_DIR = path.resolve('sandbox/attacks');

async function readAttack(filename) {
  return readFile(path.join(ATTACKS_DIR, filename), 'utf8');
}

before(async () => {
  await ensureSandboxImage();
});

test('baseline compliant C++17 solution compiles and passes in sandbox', async () => {
  const runner = createDockerSandboxRunner();
  const source = `
#include <iostream>
int main() {
  long long a = 0, b = 0;
  if (!(std::cin >> a >> b)) return 1;
  std::cout << (a + b) << "\\n";
  return 0;
}
`;
  const result = await runner.compileAndRun(source, [
    { id: 'sum-1', input: '19 23\n', expectedOutput: '42' },
    { id: 'sum-2', input: '-5 12\n', expectedOutput: '7' },
  ]);

  assert.equal(result.compileResult.success, true);
  assert.equal(result.verdict, 'Accepted');
  assert.equal(result.testResults.length, 2);
  assert.equal(result.testResults[0]?.status, 'accepted');
  assert.equal(result.testResults[1]?.status, 'accepted');
});

test('self-SIGKILL is classified as RuntimeError, not MemoryLimitExceeded', async () => {
  const runner = createDockerSandboxRunner();
  const source = `
#include <csignal>
#include <unistd.h>
int main() {
  kill(getpid(), SIGKILL);
  return 0;
}
`;
  const result = await runner.compileAndRun(source, [
    { id: 'self-sigkill', input: '', expectedOutput: '' },
  ]);

  assert.equal(result.compileResult.success, true);
  assert.equal(result.verdict, 'RuntimeError');
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'runtime_error');
  assert.equal(tc.terminationReason, 'runtime_error');
  assert.equal(tc.exitCode, 137);
});

test('regression: student exit code 125 returns RuntimeError instead of Docker infrastructure error', async () => {
  const runner = createDockerSandboxRunner();
  const source = `
int main() {
  return 125;
}
`;
  const result = await runner.compileAndRun(source, [
    { id: 'exit-125', input: '', expectedOutput: '' },
  ]);

  assert.equal(result.compileResult.success, true);
  assert.equal(result.verdict, 'RuntimeError');
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'runtime_error');
  assert.equal(tc.terminationReason, 'runtime_error');
  assert.equal(tc.exitCode, 125);
});

test('regression: missing sandbox image throws Docker infrastructure error', async () => {
  const runner = createDockerSandboxRunner({
    imageTag: 'leetkob-sandbox:nonexistent-regression-tag',
  });

  await assert.rejects(
    () => runner.compile('int main() { return 0; }'),
    /Docker sandbox infrastructure error/,
  );
});

test('M1: no network access', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m1-network.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm1', input: '', expectedOutput: 'NETWORK_ACCESS_SUCCEEDED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'runtime_error');
  assert.equal(tc.exitCode, 101);
  assert.match(tc.stderr, /NETWORK_BLOCKED/);
  assert.doesNotMatch(tc.stdout, /NETWORK_ACCESS_SUCCEEDED/);
});

test('M2: CPU time limit (1s)', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m2-cpu-time.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm2', input: '', expectedOutput: 'CPU_ATTACK_FINISHED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'time_limit_exceeded');
  assert.equal(tc.terminationReason, 'cpu_time_limit');
  assert.equal(tc.exitCode, 152);
  assert.doesNotMatch(tc.stdout, /CPU_ATTACK_FINISHED/);
});

test('M2 regression: forked process tree cannot bypass 1s aggregate CPU limit', async () => {
  const runner = createDockerSandboxRunner();
  const source = `
#include <cstdint>
#include <iostream>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

static void burn_cpu_ms(long target_ms) {
  struct timespec start;
  struct timespec now;
  clock_gettime(CLOCK_THREAD_CPUTIME_ID, &start);
  volatile uint64_t sink = 0;
  for (;;) {
    for (int i = 0; i < 100000; ++i) {
      sink += static_cast<uint64_t>(i);
    }
    clock_gettime(CLOCK_THREAD_CPUTIME_ID, &now);
    long elapsed_ms = (now.tv_sec - start.tv_sec) * 1000L +
                      (now.tv_nsec - start.tv_nsec) / 1000000L;
    if (elapsed_ms >= target_ms) {
      break;
    }
  }
}

int main() {
  for (int i = 0; i < 2; ++i) {
    pid_t pid = fork();
    if (pid == 0) {
      burn_cpu_ms(700);
      _exit(0);
    }
  }
  std::cout << "OK\\n" << std::flush;
  return 0;
}
`;
  const result = await runner.compileAndRun(source, [
    { id: 'm2-fork-tree', input: '', expectedOutput: 'OK' },
  ]);

  assert.equal(result.compileResult.success, true);
  assert.equal(result.verdict, 'TimeLimitExceeded');
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'time_limit_exceeded');
  assert.equal(tc.terminationReason, 'cpu_time_limit');
  assert.equal(tc.exitCode, 152);
});

test('M3: wall-clock limit kills the container, not only the process', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m3-wall-clock.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm3', input: '', expectedOutput: 'WALL_CLOCK_SURVIVED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'time_limit_exceeded');
  assert.equal(tc.terminationReason, 'wall_clock_timeout');
  assert.equal(tc.containerKilled, true);
  assert.doesNotMatch(tc.stdout, /WALL_CLOCK_SURVIVED/);

  // Confirm the entire container is gone from Docker daemon, not left running detached.
  const inspect = spawnSync('docker', ['inspect', tc.containerName], {
    encoding: 'utf8',
    env: sanitizeDockerHostEnv(process.env),
  });
  assert.equal(inspect.error, undefined);
  assert.equal(inspect.status, 1);
  assert.match(inspect.stderr, /No such object|No such container/i);

  const ps = spawnSync(
    'docker',
    [
      'ps',
      '-a',
      '--filter',
      `name=^/${tc.containerName}$`,
      '--format',
      '{{.ID}}',
    ],
    {
      encoding: 'utf8',
      env: sanitizeDockerHostEnv(process.env),
    },
  );
  assert.equal(ps.error, undefined);
  assert.equal(ps.status, 0);
  assert.equal(ps.stdout.trim(), '');
});

test('M4: memory limit (256 MB, swap included) with read-back', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m4-memory-swap.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm4', input: '', expectedOutput: 'MEMORY_ATTACK_SUCCEEDED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'memory_limit_exceeded');
  assert.equal(tc.terminationReason, 'memory_limit');
  assert.ok(tc.exitCode === 197 || tc.exitCode === 134);
  assert.doesNotMatch(tc.stdout, /MEMORY_ATTACK_SUCCEEDED/);
});

test('M5: process limit (16 processes)', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m5-process-limit.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm5', input: '', expectedOutput: 'PROCESS_ATTACK_SUCCEEDED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'runtime_error');
  assert.equal(tc.exitCode, 105);
  assert.match(tc.stderr, /PROCESS_LIMIT_ENFORCED/);
  assert.doesNotMatch(tc.stdout, /PROCESS_ATTACK_SUCCEEDED/);
});

test('M6: output size limit (1 MB)', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m6-output-size.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm6', input: '', expectedOutput: 'OUTPUT_ATTACK_FINISHED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'output_limit_exceeded');
  assert.equal(tc.terminationReason, 'output_size_limit');
  assert.equal(tc.outputTruncated, true);
  assert.ok(
    Buffer.byteLength(tc.stdout, 'utf8') <=
      FAQ05_SANDBOX_LIMITS.outputLimitBytes,
  );
  assert.doesNotMatch(tc.stdout, /OUTPUT_ATTACK_FINISHED/);
});

test('M7: non-root user and zero capabilities', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m7-non-root.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm7', input: '', expectedOutput: 'ROOT_ACCESS_SUCCEEDED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'runtime_error');
  assert.equal(tc.exitCode, 107);
  assert.match(
    tc.stderr,
    /NON_ROOT_ENFORCED uid=10001 euid=10001 cap_eff=0000000000000000/,
  );
  assert.doesNotMatch(tc.stdout, /ROOT_ACCESS_SUCCEEDED/);
});

test('M8: no host mounts, read-only rootfs and no Docker socket', async () => {
  const runner = createDockerSandboxRunner();
  const source = await readAttack('m8-host-mounts-docker-socket.cpp');
  const result = await runner.compileAndRun(source, [
    {
      id: 'm8',
      input: '',
      expectedOutput: 'HOST_MOUNT_OR_DOCKER_SOCK_EXPOSED',
    },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'runtime_error');
  assert.equal(tc.exitCode, 108);
  assert.match(tc.stderr, /NO_HOST_MOUNTS_OR_DOCKER_SOCKET/);
  assert.doesNotMatch(tc.stdout, /HOST_MOUNT_OR_DOCKER_SOCK_EXPOSED/);
});

test('M9: no secrets in env, files or compiler #include', async () => {
  const runner = createDockerSandboxRunner({
    hostEnv: {
      ...process.env,
      MODEL_API_KEY: 'leetkob-sandbox-probe-secret-value',
      ANTHROPIC_API_KEY: 'leetkob-sandbox-probe-secret-value',
    },
  });
  const source = await readAttack('m9-no-secrets.cpp');
  const result = await runner.compileAndRun(source, [
    { id: 'm9', input: '', expectedOutput: 'SECRET_LEAKED' },
  ]);

  assert.equal(result.compileResult.success, true);
  const tc = result.testResults[0];
  assert.ok(tc);
  assert.equal(tc.status, 'runtime_error');
  assert.equal(tc.exitCode, 109);
  assert.match(tc.stderr, /NO_SECRETS_FOUND/);
  assert.doesNotMatch(tc.stdout, /SECRET_LEAKED/);

  // Host canary #include probe: compiler must fail with missing file and never leak host canary into stderr.
  const canaryFile = path.join(
    os.tmpdir(),
    `leetkob-m9-canary-${randomUUID()}.txt`,
  );
  await writeFile(
    canaryFile,
    'LEETKOB_HOST_SECRET_CANARY_999=do_not_leak\n',
    'utf8',
  );
  try {
    const canaryProbe = `
#include ${JSON.stringify(canaryFile)}
int main() { return 0; }
`;
    const compileCanary = await runner.compile(canaryProbe);
    assert.equal(compileCanary.success, false);
    assert.match(compileCanary.stderr, /No such file or directory/i);
    assert.doesNotMatch(compileCanary.stderr, /LEETKOB_HOST_SECRET_CANARY_999/);
  } finally {
    await rm(canaryFile, { force: true });
  }

  // Container OS shadow file #include probe: compiler must fail with permission denied and never leak content.
  const shadowProbe = `
#include "/etc/shadow"
int main() { return 0; }
`;
  const compileShadow = await runner.compile(shadowProbe);
  assert.equal(compileShadow.success, false);
  assert.match(
    compileShadow.stderr,
    /Permission denied|No such file or directory/i,
  );
  assert.doesNotMatch(compileShadow.stderr, /root:/);

  // Conventional secret path #include probe.
  const secretPathProbe = `
#include "/run/secrets/model_api_key"
int main() { return 0; }
`;
  const compileSecretPath = await runner.compile(secretPathProbe);
  assert.equal(compileSecretPath.success, false);
  assert.match(compileSecretPath.stderr, /No such file or directory/i);
});
