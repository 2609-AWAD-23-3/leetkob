import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  assertSafeSandboxDockerArgs,
  buildSandboxDockerArgs,
  createDockerSandboxRunner,
  FAQ05_SANDBOX_LIMITS,
  FIXED_COMPILE_MEMORY_LIMIT_MB,
  normalizeJudgeOutput,
  resolveSandboxLimits,
  sanitizeDockerHostEnv,
} from '../../dist/sandbox/index.js';

function createMockSpawn(handler) {
  const calls = [];
  const spawnProcess = (command, args, options) => {
    const proc = new EventEmitter();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    proc.stdin = stdin;
    proc.stdout = stdout;
    proc.stderr = stderr;
    let killHandler = null;
    proc.setKillHandler = (fn) => {
      killHandler = fn;
    };
    proc.kill = (signal) => {
      if (killHandler) {
        return killHandler(signal);
      }
      return true;
    };

    const stdinChunks = [];
    stdin.on('data', (chunk) => stdinChunks.push(chunk));
    stdin.on('finish', () => {
      const stdinBuffer = Buffer.concat(stdinChunks);
      calls.push({ command, args, env: options.env, stdinBuffer });
      handler({
        command,
        args,
        env: options.env,
        stdinBuffer,
        proc,
        stdout,
        stderr,
      });
    });

    return proc;
  };
  return { spawnProcess, calls };
}

function getStatusToken(args) {
  return args[args.length - 1];
}

function writeHelperStatus(
  args,
  stderr,
  outcome,
  exitCode,
  signal = 0,
  cpuUsec = 1000,
) {
  const token = getStatusToken(args);
  stderr.write(
    `\n__LEETKOB_STATUS__:${token}:${outcome}:${exitCode}:${signal}:${cpuUsec}\n`,
  );
}

test('FAQ05_SANDBOX_LIMITS matches FAQ-05 defaults', () => {
  assert.deepEqual(FAQ05_SANDBOX_LIMITS, {
    cpuTimeLimitSeconds: 1,
    wallTimeLimitSeconds: 3,
    memoryLimitMb: 256,
    maxProcesses: 16,
    outputLimitBytes: 1048576,
    compileCpuTimeLimitSeconds: 10,
    compileWallTimeLimitSeconds: 30,
  });
});

test('buildSandboxDockerArgs enforces all 9 minimums without forbidden flags', () => {
  const args = buildSandboxDockerArgs({
    mode: 'run',
    containerName: 'leetkob-sbx-test',
    statusToken: 'tok123',
  });

  const joined = args.join(' ');
  assert.match(joined, /--network none/);
  assert.match(joined, /--memory 256m --memory-swap 256m/);
  assert.match(joined, /--pids-limit 16/);
  assert.match(joined, /--ulimit cpu=1:2/);
  assert.match(joined, /--ulimit fsize=1048576:1048576/);
  assert.match(joined, /--user 10001:10001/);
  assert.match(joined, /--read-only/);
  assert.match(joined, /--cap-drop ALL/);
  assert.match(joined, /--security-opt no-new-privileges/);
  assert.equal(args[args.length - 1], 'tok123');
  assert.doesNotMatch(
    joined,
    /--privileged|docker\.sock|--env-file|MODEL_API_KEY|\s-v\s|--volume|--mount/,
  );
});

test('assertSafeSandboxDockerArgs rejects dangerous sandbox options', () => {
  for (const badArgs of [
    ['run', '--privileged', 'img'],
    ['run', '-v', '/var/run/docker.sock:/var/run/docker.sock', 'img'],
    ['run', '--volume=/host:/sandbox', 'img'],
    ['run', '--mount', 'type=bind,source=/etc,target=/etc', 'img'],
    ['run', '--env-file', '.env', 'img'],
    ['run', '-e', 'MODEL_API_KEY=secret', 'img'],
    ['run', '--env=ANTHROPIC_API_KEY=secret', 'img'],
  ]) {
    assert.throws(
      () => assertSafeSandboxDockerArgs(badArgs),
      /Forbidden sandbox Docker argument/,
    );
  }
});

test('sanitizeDockerHostEnv strips secrets while preserving Docker transport vars', () => {
  const sanitized = sanitizeDockerHostEnv({
    PATH: '/usr/bin',
    DOCKER_HOST: 'unix:///var/run/docker.sock',
    MODEL_API_KEY: 'secret-value',
    ANTHROPIC_API_KEY: 'secret-value',
    OPENAI_API_KEY: 'secret-value',
    GEMINI_API_KEY: 'secret-value',
    DATABASE_URL: 'postgres://user:pass@localhost/db',
  });

  assert.equal(sanitized.PATH, '/usr/bin');
  assert.equal(sanitized.DOCKER_HOST, 'unix:///var/run/docker.sock');
  assert.equal(sanitized.MODEL_API_KEY, undefined);
  assert.equal(sanitized.ANTHROPIC_API_KEY, undefined);
  assert.equal(sanitized.OPENAI_API_KEY, undefined);
  assert.equal(sanitized.GEMINI_API_KEY, undefined);
  assert.equal(sanitized.DATABASE_URL, undefined);
});

test('normalizeJudgeOutput ignores CRLF and trailing spaces/newlines', () => {
  assert.equal(normalizeJudgeOutput('1 2  \r\n3\t\r\n\n'), '1 2\n3');
});

test('runner compiles and judges compliant submission as Accepted', async () => {
  const fakeElf = Buffer.from('\x7fELF-fake-binary');
  const { spawnProcess, calls } = createMockSpawn(
    ({ args, stdinBuffer, proc, stdout, stderr }) => {
      if (args.includes('compile')) {
        assert.match(stdinBuffer.toString('utf8'), /int main/);
        stdout.end(fakeElf);
        writeHelperStatus(args, stderr, 'exited', 0);
        stderr.end();
        proc.emit('close', 0, null);
        return;
      }
      const newlineIdx = stdinBuffer.indexOf(0x0a);
      const declaredLen = Number(
        stdinBuffer.subarray(0, newlineIdx).toString('ascii'),
      );
      assert.equal(declaredLen, fakeElf.length);
      const testInput = stdinBuffer
        .subarray(newlineIdx + 1 + declaredLen)
        .toString('utf8');
      assert.equal(testInput, '2 3\n');
      stdout.end('5 \r\n');
      writeHelperStatus(args, stderr, 'exited', 0);
      stderr.end();
      proc.emit('close', 0, null);
    },
  );

  const runner = createDockerSandboxRunner({
    spawnProcess,
    killContainer: async () => {},
    hostEnv: { PATH: '/usr/bin', MODEL_API_KEY: 'must-not-leak' },
  });

  const result = await runner.compileAndRun('int main() { return 0; }', [
    { id: 'tc-1', input: '2 3\n', expectedOutput: '5' },
  ]);

  assert.equal(result.verdict, 'Accepted');
  assert.equal(result.compileResult.success, true);
  assert.equal(result.compileResult.stderr, '');
  assert.equal(result.testResults.length, 1);
  assert.equal(result.testResults[0]?.status, 'accepted');
  assert.equal(result.testResults[0]?.stderr, '');
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.env.MODEL_API_KEY, undefined);
  assert.equal(calls[1]?.env.MODEL_API_KEY, undefined);
});

test('runner returns CompileError and skips execution when compilation fails', async () => {
  const { spawnProcess, calls } = createMockSpawn(({ args, proc, stderr }) => {
    stderr.write('solution.cpp:1:1: error: syntax error\n');
    writeHelperStatus(args, stderr, 'exited', 1);
    stderr.end();
    proc.emit('close', 0, null);
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    killContainer: async () => {},
  });

  const result = await runner.compileAndRun('bad code', [
    { id: 'tc-1', input: '', expectedOutput: '' },
  ]);

  assert.equal(result.verdict, 'CompileError');
  assert.equal(result.compileResult.success, false);
  assert.equal(result.compileResult.exitCode, 1);
  assert.match(result.compileResult.stderr, /syntax error/);
  assert.doesNotMatch(result.compileResult.stderr, /__LEETKOB_STATUS__/);
  assert.equal(result.testResults.length, 0);
  assert.equal(calls.length, 1);
});

test('runner classifies CPU limit, memory OOM, non-OOM SIGKILL and WrongAnswer accurately', async () => {
  let runIndex = 0;
  const { spawnProcess } = createMockSpawn(({ args, proc, stdout, stderr }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
      writeHelperStatus(args, stderr, 'exited', 0);
      stderr.end();
      proc.emit('close', 0, null);
      return;
    }
    runIndex += 1;
    if (runIndex === 1) {
      writeHelperStatus(args, stderr, 'cpu_time_limit', 152, 24, 1005000);
      stderr.end();
      proc.emit('close', 0, null);
    } else if (runIndex === 2) {
      writeHelperStatus(args, stderr, 'memory_limit', 197, 9, 20000);
      stderr.end();
      proc.emit('close', 0, null);
    } else if (runIndex === 3) {
      stderr.write('terminate called after throwing std::bad_alloc\n');
      writeHelperStatus(args, stderr, 'signaled', 134, 6, 15000);
      stderr.end();
      proc.emit('close', 0, null);
    } else if (runIndex === 4) {
      writeHelperStatus(args, stderr, 'signaled', 137, 9, 5000);
      stderr.end();
      proc.emit('close', 0, null);
    } else {
      stdout.end('99\n');
      writeHelperStatus(args, stderr, 'exited', 0, 0, 5000);
      stderr.end();
      proc.emit('close', 0, null);
    }
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    killContainer: async () => {},
  });

  const compiled = await runner.compile('int main() {}');
  assert.ok(compiled.binary);

  const cpuRes = await runner.runBinary(compiled.binary, {
    id: 'cpu',
    input: '',
    expectedOutput: '',
  });
  assert.equal(cpuRes.status, 'time_limit_exceeded');
  assert.equal(cpuRes.terminationReason, 'cpu_time_limit');
  assert.equal(cpuRes.exitCode, 152);

  const oomRes = await runner.runBinary(compiled.binary, {
    id: 'oom',
    input: '',
    expectedOutput: '',
  });
  assert.equal(oomRes.status, 'memory_limit_exceeded');
  assert.equal(oomRes.terminationReason, 'memory_limit');
  assert.equal(oomRes.exitCode, 197);

  const badAllocRes = await runner.runBinary(compiled.binary, {
    id: 'bad-alloc',
    input: '',
    expectedOutput: '',
  });
  assert.equal(badAllocRes.status, 'memory_limit_exceeded');
  assert.equal(badAllocRes.terminationReason, 'memory_limit');

  const sigkillRes = await runner.runBinary(compiled.binary, {
    id: 'non-oom-sigkill',
    input: '',
    expectedOutput: '',
  });
  assert.equal(sigkillRes.status, 'runtime_error');
  assert.equal(sigkillRes.terminationReason, 'runtime_error');
  assert.equal(sigkillRes.exitCode, 137);

  const waRes = await runner.runBinary(compiled.binary, {
    id: 'wa',
    input: '',
    expectedOutput: '42',
  });
  assert.equal(waRes.status, 'wrong_answer');
  assert.equal(waRes.terminationReason, 'normal');
});

test('runner treats solution exit codes 125, 152 and 197 as RuntimeError when helper status reports exited', async () => {
  const exitCodes = [125, 152, 197];
  let idx = 0;
  const { spawnProcess } = createMockSpawn(({ args, proc, stdout, stderr }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
      writeHelperStatus(args, stderr, 'exited', 0);
      stderr.end();
      proc.emit('close', 0, null);
      return;
    }
    const code = exitCodes[idx];
    idx += 1;
    stderr.write('user diagnostic line');
    writeHelperStatus(args, stderr, 'exited', code, 0, 2000);
    stderr.end();
    proc.emit('close', 0, null);
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    killContainer: async () => {},
  });

  const result = await runner.compileAndRun('int main() { return 125; }', [
    { id: 'exit-125', input: '', expectedOutput: '' },
    { id: 'exit-152', input: '', expectedOutput: '' },
    { id: 'exit-197', input: '', expectedOutput: '' },
  ]);

  assert.equal(result.verdict, 'RuntimeError');
  for (let i = 0; i < exitCodes.length; i += 1) {
    const tc = result.testResults[i];
    assert.ok(tc);
    assert.equal(tc.status, 'runtime_error');
    assert.equal(tc.terminationReason, 'runtime_error');
    assert.equal(tc.exitCode, exitCodes[i]);
    assert.equal(tc.stderr, 'user diagnostic line');
  }
});

test('runner strips helper status frame cleanly near stderr limit and ignores spoofed earlier frames', async () => {
  const limitBytes = 1024;
  const { spawnProcess } = createMockSpawn(({ args, proc, stdout, stderr }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
      writeHelperStatus(args, stderr, 'exited', 0);
      stderr.end();
      proc.emit('close', 0, null);
      return;
    }
    stdout.end('42\n');
    const spoofed = `\n__LEETKOB_STATUS__:${getStatusToken(args)}:exited:1:0:0\n`;
    const padding = 'x'.repeat(limitBytes - spoofed.length);
    stderr.write(padding + spoofed);
    // Real trailing frame reports exit 0 even though stderr already matches limitBytes cleanly.
    writeHelperStatus(args, stderr, 'exited', 0, 0, 5000);
    stderr.end();
    proc.emit('close', 0, null);
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    limits: { outputLimitBytes: limitBytes },
    killContainer: async () => {},
  });

  const result = await runner.compileAndRun('int main() { return 0; }', [
    { id: 'exact-stderr', input: '', expectedOutput: '42' },
  ]);

  assert.equal(result.verdict, 'Accepted');
  assert.equal(result.testResults[0]?.outputTruncated, false);
  assert.equal(
    Buffer.byteLength(result.testResults[0]?.stderr ?? '', 'utf8'),
    limitBytes,
  );
});

test('runner kills container on wall-clock timeout', async () => {
  const killedContainers = [];
  let activeRunProc = null;

  const { spawnProcess } = createMockSpawn(({ args, proc, stdout, stderr }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
      writeHelperStatus(args, stderr, 'exited', 0);
      stderr.end();
      proc.emit('close', 0, null);
      return;
    }
    activeRunProc = proc;
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    limits: {
      cpuTimeLimitSeconds: 1,
      wallTimeLimitSeconds: 0.05,
    },
    killContainer: async (containerName) => {
      killedContainers.push(containerName);
      activeRunProc?.emit('close', 137, null);
    },
  });

  const result = await runner.compileAndRun('int main() {}', [
    { id: 'wall', input: '', expectedOutput: '' },
  ]);

  assert.equal(result.verdict, 'TimeLimitExceeded');
  assert.equal(killedContainers.length, 1);
  assert.equal(result.testResults[0]?.containerKilled, true);
  assert.equal(result.testResults[0]?.terminationReason, 'wall_clock_timeout');
  assert.equal(result.testResults[0]?.containerName, killedContainers[0]);
});

test('runner truncates output above limit and kills container', async () => {
  const killedContainers = [];
  let activeRunProc = null;

  const { spawnProcess } = createMockSpawn(({ args, proc, stdout, stderr }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
      writeHelperStatus(args, stderr, 'exited', 0);
      stderr.end();
      proc.emit('close', 0, null);
      return;
    }
    activeRunProc = proc;
    stdout.write(Buffer.alloc(2048, 0x41));
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    limits: {
      outputLimitBytes: 1024,
    },
    killContainer: async (containerName) => {
      killedContainers.push(containerName);
      activeRunProc?.emit('close', 137, null);
    },
  });

  const result = await runner.compileAndRun('int main() {}', [
    { id: 'out', input: '', expectedOutput: '' },
  ]);

  assert.equal(result.verdict, 'OutputLimitExceeded');
  assert.equal(killedContainers.length, 1);
  assert.equal(result.testResults[0]?.outputTruncated, true);
  assert.equal(result.testResults[0]?.terminationReason, 'output_size_limit');
  assert.equal(result.testResults[0]?.stdout.length, 1024);
});

test('runner rejects Docker infrastructure errors without valid helper status frame and helper infra_error frames', async () => {
  const compileFail = createMockSpawn(({ proc, stderr }) => {
    stderr.end('docker: Unable to find image leetkob-sandbox:pa03\n');
    proc.emit('close', 125, null);
  });

  const compileRunner = createDockerSandboxRunner({
    spawnProcess: compileFail.spawnProcess,
    killContainer: async () => {},
  });

  await assert.rejects(
    () => compileRunner.compile('int main() {}'),
    /Docker sandbox infrastructure error \(exit 125\)/,
  );

  const runFail = createMockSpawn(({ proc, stderr }) => {
    stderr.end('docker: Cannot connect to the Docker daemon\n');
    proc.emit('close', 127, null);
  });

  const runRunner = createDockerSandboxRunner({
    spawnProcess: runFail.spawnProcess,
    killContainer: async () => {},
  });

  await assert.rejects(
    () =>
      runRunner.runBinary(Buffer.from('ELF'), {
        id: 'tc-1',
        input: '',
        expectedOutput: '',
      }),
    /Docker sandbox infrastructure error \(exit 127\)/,
  );

  const helperInfraFail = createMockSpawn(({ args, proc, stderr }) => {
    stderr.write('runner: pipe2: Too many open files\n');
    writeHelperStatus(args, stderr, 'infra_error', 1, 0, 0);
    stderr.end();
    proc.emit('close', 1, null);
  });

  const helperInfraRunner = createDockerSandboxRunner({
    spawnProcess: helperInfraFail.spawnProcess,
    killContainer: async () => {},
  });

  await assert.rejects(
    () =>
      helperInfraRunner.runBinary(Buffer.from('ELF'), {
        id: 'tc-infra',
        input: '',
        expectedOutput: '',
      }),
    /Docker sandbox helper infrastructure error/,
  );
});

test('fallback kill schedules independently when killContainer hangs and fails within bounded deadline', async () => {
  let fallbackKillCalls = 0;
  let cleanupStarted = false;

  const { spawnProcess } = createMockSpawn(({ proc }) => {
    proc.setKillHandler((sig) => {
      if (sig === 'SIGKILL') {
        fallbackKillCalls += 1;
        proc.emit('close', null, 'SIGKILL');
      }
      return true;
    });
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    limits: { wallTimeLimitSeconds: 0.02 },
    fallbackKillDelayMs: 30,
    cleanupTimeoutMs: 90,
    killContainer: () => {
      cleanupStarted = true;
      return new Promise(() => {});
    },
  });

  const startedAt = Date.now();
  await assert.rejects(
    () =>
      runner.runBinary(Buffer.from('ELF'), {
        id: 'hung-cleanup',
        input: '',
        expectedOutput: '',
      }),
    /Docker sandbox infrastructure error: container cleanup timed out after 90ms/,
  );
  const elapsedMs = Date.now() - startedAt;

  assert.equal(cleanupStarted, true);
  assert.equal(fallbackKillCalls, 1);
  assert.ok(
    elapsedMs < 1000,
    `Expected bounded completion, got ${elapsedMs}ms`,
  );
});

test('runner settles within bounded deadline even when killContainer hangs and process ignores SIGKILL', async () => {
  let fallbackKillCalls = 0;

  const { spawnProcess } = createMockSpawn(({ proc }) => {
    proc.setKillHandler((sig) => {
      if (sig === 'SIGKILL') {
        fallbackKillCalls += 1;
      }
      return true;
    });
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    limits: { wallTimeLimitSeconds: 0.02 },
    fallbackKillDelayMs: 25,
    cleanupTimeoutMs: 70,
    killContainer: () => new Promise(() => {}),
  });

  const startedAt = Date.now();
  await assert.rejects(
    () =>
      runner.runBinary(Buffer.from('ELF'), {
        id: 'hung-cleanup-and-proc',
        input: '',
        expectedOutput: '',
      }),
    /Docker sandbox infrastructure error/,
  );
  const elapsedMs = Date.now() - startedAt;

  assert.equal(fallbackKillCalls, 1);
  assert.ok(
    elapsedMs < 1000,
    `Expected bounded completion, got ${elapsedMs}ms`,
  );
});

test('rejected killContainer does not hang or leak rejection and triggers fallback SIGKILL', async () => {
  let fallbackKillCalls = 0;

  const { spawnProcess } = createMockSpawn(({ proc }) => {
    proc.setKillHandler((sig) => {
      if (sig === 'SIGKILL') {
        fallbackKillCalls += 1;
        proc.emit('close', null, 'SIGKILL');
      }
      return true;
    });
  });

  const runner = createDockerSandboxRunner({
    spawnProcess,
    limits: { wallTimeLimitSeconds: 0.02 },
    fallbackKillDelayMs: 5000,
    cleanupTimeoutMs: 5000,
    killContainer: async () => {
      throw new Error('docker daemon unavailable');
    },
  });

  const startedAt = Date.now();
  await assert.rejects(
    () =>
      runner.runBinary(Buffer.from('ELF'), {
        id: 'rejected-cleanup',
        input: '',
        expectedOutput: '',
      }),
    /Docker sandbox infrastructure error: container cleanup failed: docker daemon unavailable/,
  );
  const elapsedMs = Date.now() - startedAt;

  assert.equal(fallbackKillCalls, 1);
  assert.ok(elapsedMs < 1000, `Expected fast rejection, got ${elapsedMs}ms`);
});

test('resolveSandboxLimits supports millisecond-precision CPU limits and rejects invalid values', () => {
  const fractional = resolveSandboxLimits({
    cpuTimeLimitSeconds: 1.5,
    compileCpuTimeLimitSeconds: 2.5,
  });
  assert.equal(fractional.cpuTimeLimitSeconds, 1.5);
  assert.equal(fractional.compileCpuTimeLimitSeconds, 2.5);
  assert.equal(fractional.wallTimeLimitSeconds, 4.5);

  const args = buildSandboxDockerArgs({
    mode: 'run',
    containerName: 'leetkob-sbx-ms',
    limits: { cpuTimeLimitSeconds: 1.5 },
    statusToken: 'tok-ms',
  });
  assert.equal(args.includes('cpu=2:3'), true);
  assert.equal(args[args.length - 3], '1.5');

  for (const invalid of [
    { cpuTimeLimitSeconds: 0 },
    { cpuTimeLimitSeconds: -1 },
    { cpuTimeLimitSeconds: 0.0001 },
    { compileCpuTimeLimitSeconds: Number.NaN },
    { memoryLimitMb: 128.5 },
    { maxProcesses: 0 },
    { outputLimitBytes: 1024.2 },
    { wallTimeLimitSeconds: 0 },
  ]) {
    assert.throws(() => resolveSandboxLimits(invalid), /Sandbox limit/);
  }

  assert.throws(
    () => createDockerSandboxRunner({ fallbackKillDelayMs: 0 }),
    /Sandbox option "fallbackKillDelayMs"/,
  );
  assert.throws(
    () => createDockerSandboxRunner({ cleanupTimeoutMs: -5 }),
    /Sandbox option "cleanupTimeoutMs"/,
  );
});

test('compile phase uses fixed memory limit independent of lab runtime memoryLimitMb', () => {
  assert.equal(FIXED_COMPILE_MEMORY_LIMIT_MB, 256);

  const compileArgs = buildSandboxDockerArgs({
    mode: 'compile',
    containerName: 'leetkob-sbx-compile-64',
    limits: { memoryLimitMb: 64 },
    statusToken: 'tok-cmp',
  }).join(' ');
  assert.match(compileArgs, /--memory 256m --memory-swap 256m/);

  const runArgs = buildSandboxDockerArgs({
    mode: 'run',
    containerName: 'leetkob-sbx-run-64',
    limits: { memoryLimitMb: 64 },
    statusToken: 'tok-run',
  }).join(' ');
  assert.match(runArgs, /--memory 64m --memory-swap 64m/);

  const customCompileArgs = buildSandboxDockerArgs({
    mode: 'compile',
    containerName: 'leetkob-sbx-compile-512',
    limits: { memoryLimitMb: 64, compileMemoryLimitMb: 512 },
    statusToken: 'tok-cmp-512',
  }).join(' ');
  assert.match(customCompileArgs, /--memory 512m --memory-swap 512m/);

  for (const invalid of [
    { compileMemoryLimitMb: 0 },
    { compileMemoryLimitMb: -1 },
    { compileMemoryLimitMb: 128.5 },
  ]) {
    assert.throws(() => resolveSandboxLimits(invalid), /Sandbox limit/);
  }
});
