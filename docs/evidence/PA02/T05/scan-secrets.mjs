// T05 evidence collector only; not the shared T04 runner. Never prints raw findings/config.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const scanner = process.argv[2];
const config = process.argv[3];
if (!scanner || !config) {
  throw new Error(
    'Usage: node docs/evidence/PA02/T05/scan-secrets.mjs <gitleaks> <official-config>',
  );
}
const expectedConfigHash =
  'e163e53b9e7e8a8511e77271e2b323ed057759542a6d988258afe3a1fa329caf';
const configHash = createHash('sha256')
  .update(fs.readFileSync(config))
  .digest('hex');
if (configHash !== expectedConfigHash)
  throw new Error('Use the pinned v8.30.1 official config');
const startedAtUtc = new Date().toISOString();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'leetkob-t05-scan-'));
const snapshot = path.join(scratch, 'working-tree');
fs.mkdirSync(snapshot);
const emptyIgnore = path.join(scratch, 'empty.gitleaksignore');
fs.writeFileSync(emptyIgnore, '');

function git(args) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error('Git metadata collection failed; inspect privately');
  return result.stdout;
}
const versionResult = spawnSync(scanner, ['version'], { encoding: 'utf8' });
if (versionResult.status !== 0 || versionResult.stdout.trim() !== '8.30.1') {
  throw new Error('Gitleaks 8.30.1 is required');
}
const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
if (shallow)
  throw new Error(
    'History is shallow; obtain complete history before recording acceptance',
  );

const files = [];
const symlinksSkipped = [];
const rootExclusions = new Set(['.git', 'node_modules', 'dist']);
// Generated manifests cannot hash their own final contents. No source/secrets paths are excluded here.
const generatedReports = new Set([
  'docs/evidence/PA02/T05/security-scan.json',
  'docs/evidence/PA02/T05/security-triage.json',
  'docs/evidence/PA02/T05/verification.json',
]);
function snapshotDirectory(relative = '') {
  for (const entry of fs.readdirSync(path.join(repo, relative), {
    withFileTypes: true,
  })) {
    if (relative === '' && rootExclusions.has(entry.name)) continue;
    const next = path.join(relative, entry.name);
    if (generatedReports.has(next.split(path.sep).join('/'))) continue;
    if (entry.isSymbolicLink()) {
      symlinksSkipped.push(next.split(path.sep).join('/'));
      continue;
    }
    if (entry.isDirectory()) snapshotDirectory(next);
    else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(path.join(snapshot, next)), {
        recursive: true,
      });
      fs.copyFileSync(path.join(repo, next), path.join(snapshot, next));
      files.push(next.split(path.sep).join('/'));
    }
  }
}
snapshotDirectory();

const record = {
  startedAtUtc,
  completedAtUtc: null,
  sourceHead: git(['rev-parse', 'HEAD']).trim(),
  branch: git(['branch', '--show-current']).trim(),
  node: process.version,
  git: git(['--version']).trim(),
  platform: `${process.platform} ${process.arch}`,
  scanner: {
    name: 'gitleaks',
    version: '8.30.1',
    configSha256: configHash,
    configSource:
      'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml',
    redactionPercent: 100,
    customBaseline: false,
    customAllowlist: false,
    note: 'Official default config includes its own allowlists. Inline gitleaks:allow comments are ignored; external ignore file is empty.',
  },
  history: {
    shallow,
    refs: git(['for-each-ref', '--format=%(refname) %(objectname)'])
      .trim()
      .split(/\r?\n/),
    uniqueCommits: Number(
      git(['rev-list', '--all', '--reflog', '--count']).trim(),
    ),
    logOptions: '--all --full-history --reflog --root -m',
  },
  workingTree: {
    files: files.sort(),
    excludedRoots: [...rootExclusions],
    generatedReportsExcluded: [...generatedReports],
    symlinksSkipped,
  },
  scans: [],
  manualConfigReview: {},
  limitations: [
    'Pattern-based scan, not proof that every possible secret is absent or inactive.',
    'History coverage is local refs/reflogs after fetch; unreachable objects without refs/reflogs and inaccessible/deleted remote refs are not covered.',
    'Working snapshot includes hidden/ignored files except .git, node_modules, dist and symlinks; symlink skips are listed.',
    'Archive extraction is disabled; binary/PDF contents or other unsupported encodings may not be fully inspected.',
    'No credential/helper execution, provider request, credential validity check or secret rotation was performed.',
  ],
};

function scan(name, args, input) {
  const report = path.join(scratch, `${name}.json`);
  const commandArgs = [
    ...args,
    '--config',
    path.resolve(config),
    '--redact=100',
    '--ignore-gitleaks-allow',
    '--gitleaks-ignore-path',
    emptyIgnore,
    '--no-banner',
    '--no-color',
    '--log-level=error',
    '--report-format=json',
    '--report-path',
    report,
  ];
  const result = spawnSync(scanner, commandArgs, {
    cwd: scratch,
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (
    result.error ||
    ![0, 1].includes(result.status) ||
    !fs.existsSync(report)
  ) {
    throw new Error(
      `Scanner failure in ${name}; private scratch retained; no successful result recorded`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(report, 'utf8')) ?? [];
  // Deliberately omit Match, Secret, Line, Author, Email and commit messages.
  const findings = raw.map((finding) => ({
    ruleId: finding.RuleID,
    file:
      name === 'working-tree' && path.isAbsolute(finding.File)
        ? path.relative(snapshot, finding.File).split(path.sep).join('/')
        : finding.File,
    startLine: finding.StartLine,
    endLine: finding.EndLine,
    commit: finding.Commit ?? '',
  }));
  record.scans.push({
    name,
    exitCode: result.status,
    findingCount: findings.length,
    findings,
  });
  fs.unlinkSync(report); // Remove only the exact temporary redacted report created above.
}

scan('history', [
  'git',
  repo,
  '--log-opts=--all --full-history --reflog --root -m',
]);
scan('working-tree', ['dir', snapshot]);
scan(
  'git-refs-and-messages',
  ['stdin'],
  git(['log', '--all', '--reflog', '--format=%H%n%B%n%an%n%ae%n%cn%n%ce']) +
    '\n' +
    git(['for-each-ref', '--format=%(refname)%0a%(contents)']),
);
const configText = git(['config', '--list', '--show-origin']);
const remotesText = git(['remote', '-v']);
scan('git-config-and-remotes', ['stdin'], `${configText}\n${remotesText}`);

const configEntries = git(['config', '--null', '--list'])
  .split('\0')
  .filter(Boolean)
  .map((entry) => {
    const split = entry.indexOf('\n');
    return {
      key: split < 0 ? entry : entry.slice(0, split),
      value: split < 0 ? '' : entry.slice(split + 1),
    };
  });
let credentialUrlCount = 0;
let inlineAuthHeaderCount = 0;
let sensitiveConfigValueCount = 0;
for (const { key, value } of configEntries) {
  for (const match of value.matchAll(/https?:\/\/[^\s]+/g)) {
    try {
      const url = new URL(match[0]);
      if (url.username || url.password) credentialUrlCount++;
    } catch {
      /* malformed URL also inspected by scanner */
    }
  }
  if (/extraheader$/i.test(key) && /authorization\s*:/i.test(value))
    inlineAuthHeaderCount++;
  if (
    /(?:^|\.)(?:password|token|secret|apikey|api-key)$/i.test(key) &&
    value.trim()
  )
    sensitiveConfigValueCount++;
}
record.manualConfigReview = {
  configEntriesChecked: configEntries.length,
  scope:
    'Applicable system/global/repository config including included values, plus git remote -v; values not retained',
  credentialUrlCount,
  inlineAuthHeaderCount,
  sensitiveConfigValueCount,
};
record.workingTree.fileSha256 = Object.fromEntries(
  files.map((file) => [
    file,
    createHash('sha256')
      .update(fs.readFileSync(path.join(snapshot, file)))
      .digest('hex'),
  ]),
);
record.completedAtUtc = new Date().toISOString();
const output = path.join(repo, 'docs/evidence/PA02/T05/security-scan.json');
fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
console.log(
  JSON.stringify({
    report: 'docs/evidence/PA02/T05/security-scan.json',
    scans: record.scans.map(({ name, exitCode, findingCount }) => ({
      name,
      exitCode,
      findingCount,
    })),
    manualConfigReview: record.manualConfigReview,
  }),
);
const needsReview =
  record.scans.some((scan) => scan.findingCount > 0) ||
  credentialUrlCount + inlineAuthHeaderCount + sensitiveConfigValueCount > 0 ||
  symlinksSkipped.length > 0;
process.exitCode = needsReview ? 1 : 0;
