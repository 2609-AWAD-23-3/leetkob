import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  assertSafeSandboxDockerArgs,
  buildSandboxDockerArgs,
  createDockerSandboxRunner,
  FAQ05_SANDBOX_LIMITS,
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
    proc.kill = () => true;

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
    ({ args, stdinBuffer, proc, stdout }) => {
      if (args.includes('compile')) {
        assert.match(stdinBuffer.toString('utf8'), /int main/);
        stdout.end(fakeElf);
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
  assert.equal(result.testResults.length, 1);
  assert.equal(result.testResults[0]?.status, 'accepted');
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.env.MODEL_API_KEY, undefined);
  assert.equal(calls[1]?.env.MODEL_API_KEY, undefined);
});

test('runner returns CompileError and skips execution when compilation fails', async () => {
  const { spawnProcess, calls } = createMockSpawn(({ proc, stderr }) => {
    stderr.end('solution.cpp:1:1: error: syntax error\n');
    proc.emit('close', 1, null);
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
  assert.match(result.compileResult.stderr, /syntax error/);
  assert.equal(result.testResults.length, 0);
  assert.equal(calls.length, 1);
});

test('runner classifies CPU limit, memory OOM, non-OOM SIGKILL and WrongAnswer accurately', async () => {
  let runIndex = 0;
  const { spawnProcess } = createMockSpawn(({ args, proc, stdout, stderr }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
      proc.emit('close', 0, null);
      return;
    }
    runIndex += 1;
    if (runIndex === 1) {
      proc.emit('close', 152, null);
    } else if (runIndex === 2) {
      proc.emit('close', 197, null);
    } else if (runIndex === 3) {
      stderr.end('terminate called after throwing std::bad_alloc\n');
      proc.emit('close', 134, null);
    } else if (runIndex === 4) {
      proc.emit('close', 137, null);
    } else {
      stdout.end('99\n');
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

  const oomRes = await runner.runBinary(compiled.binary, {
    id: 'oom',
    input: '',
    expectedOutput: '',
  });
  assert.equal(oomRes.status, 'memory_limit_exceeded');
  assert.equal(oomRes.terminationReason, 'memory_limit');

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

test('runner kills container on wall-clock timeout', async () => {
  const killedContainers = [];
  let activeRunProc = null;

  const { spawnProcess } = createMockSpawn(({ args, proc, stdout }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
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

  const { spawnProcess } = createMockSpawn(({ args, proc, stdout }) => {
    if (args.includes('compile')) {
      stdout.end(Buffer.from('ELF'));
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

test('runner rejects Docker infrastructure errors (exit 125) on compile and run', async () => {
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
    proc.emit('close', 125, null);
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
    /Docker sandbox infrastructure error \(exit 125\)/,
  );
});

test('resolveSandboxLimits enforces positive integers for container/ulimit integer parameters', () => {
  for (const invalid of [
    { cpuTimeLimitSeconds: 0.5 },
    { compileCpuTimeLimitSeconds: 1.5 },
    { memoryLimitMb: 128.5 },
    { maxProcesses: 0 },
    { outputLimitBytes: 1024.2 },
    { wallTimeLimitSeconds: 0 },
  ]) {
    assert.throws(() => resolveSandboxLimits(invalid), /Sandbox limit/);
  }
});
