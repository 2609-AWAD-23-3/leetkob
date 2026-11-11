// Verify exact T03/T05 SHA-256 manifest entries against history/snapshot source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const report = JSON.parse(
  fs.readFileSync(path.join(evidenceDir, 'security-scan.json'), 'utf8'),
);
function show(spec) {
  const result = spawnSync('git', ['show', spec], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('Cannot inspect finding privately');
  return result.stdout;
}
const findings = [];
for (const scan of report.scans)
  for (const finding of scan.findings) {
    if (
      !['history', 'working-tree'].includes(scan.name) ||
      ![
        'docs/evidence/PA02/T03/verification.json',
        'docs/evidence/PA02/T05/security-scan.json',
      ].includes(finding.file)
    ) {
      throw new Error(
        'New finding requires private review; do not suppress it',
      );
    }
    function sourceText(file) {
      const resolved = path.resolve(repo, file);
      if (!resolved.startsWith(repo + path.sep))
        throw new Error('Manifest path escapes repo');
      if (scan.name === 'history') return show(`${finding.commit}:${file}`);
      const bytes = fs.readFileSync(resolved);
      const expectedSnapshotHash = report.workingTree.fileSha256[file];
      if (
        !expectedSnapshotHash ||
        createHash('sha256').update(bytes).digest('hex') !==
          expectedSnapshotHash
      ) {
        throw new Error(
          'Working file differs from scanned snapshot; rescan before triage',
        );
      }
      return bytes.toString('utf8');
    }
    const text = sourceText(finding.file);
    const line = text.split(/\r?\n/)[finding.startLine - 1];
    const match = /^\s*"([^"]+)":\s*"([a-f0-9]{64})",?$/.exec(line);
    const record = JSON.parse(text.replace(/^\uFEFF/, ''));
    const manifestName =
      finding.file === 'docs/evidence/PA02/T03/verification.json'
        ? 'sha256WorkingFiles'
        : 'workingTree.fileSha256';
    const manifest =
      manifestName === 'sha256WorkingFiles'
        ? record.sha256WorkingFiles
        : record.workingTree?.fileSha256;
    if (!match || !manifest || manifest[match[1]] !== match[2]) {
      throw new Error('Finding is not a SHA-256 manifest entry');
    }
    function matchingFormats(source) {
      return Object.entries({
        gitBlob: source,
        lf: source.replace(/\r\n/g, '\n'),
        crlf: source.replace(/\r?\n/g, '\r\n'),
      })
        .filter(
          ([, value]) =>
            createHash('sha256').update(value).digest('hex') === match[2],
        )
        .map(([name]) => name);
    }
    let formats = matchingFormats(sourceText(match[1]));
    let verifiedAgainst =
      scan.name === 'history' ? finding.commit : 'working-tree-snapshot';
    if (!formats.length && scan.name === 'working-tree') {
      // Formatting may change current source bytes while this historical evidence stays unchanged.
      // Require the entire evidence document to match HEAD before testing its recorded source digest.
      const baselineEvidence = show(`${report.sourceHead}:${finding.file}`);
      if (
        baselineEvidence.replace(/\r\n/g, '\n') !== text.replace(/\r\n/g, '\n')
      ) {
        throw new Error('Changed historical evidence requires separate review');
      }
      const revisions = spawnSync(
        'git',
        ['log', '--format=%H', report.sourceHead, '--', finding.file],
        { cwd: repo, encoding: 'utf8' },
      );
      if (revisions.status !== 0)
        throw new Error('Cannot inspect manifest history');
      // HEAD may now contain formatting changes. Only an ancestor with the
      // identical entire evidence document can establish the recorded digest.
      const candidates = [
        report.sourceHead,
        ...revisions.stdout.trim().split(/\r?\n/).filter(Boolean),
      ];
      for (const revision of new Set(candidates)) {
        if (
          show(`${revision}:${finding.file}`).replace(/\r\n/g, '\n') !==
          text.replace(/\r\n/g, '\n')
        )
          continue;
        formats = matchingFormats(show(`${revision}:${match[1]}`));
        if (formats.length) {
          verifiedAgainst = revision;
          break;
        }
      }
    }
    if (!formats.length)
      throw new Error('Unverified digest; retain finding for review');
    findings.push({
      scan: scan.name,
      ...finding,
      classification: 'false_positive_verified_file_digest',
      sourcePath: match[1],
      manifestName,
      verifiedFormats: formats,
      verifiedAgainst,
      reason: `SHA-256 in ${manifestName} matches the referenced source content, not a provider credential. No validity request was sent.`,
    });
  }
const result = {
  recordedAtUtc: new Date().toISOString(),
  sourceHead: report.sourceHead,
  scanCompletedAtUtc: report.completedAtUtc,
  scanner: 'gitleaks 8.30.1 official default rules',
  findings,
  rawFindingCount: findings.length,
  confirmedSecrets: 0,
  unresolvedFindings: 0,
  limitations:
    'Classification is limited to these exact findings. No scanner rules, baseline, ignore file or history were changed to hide them.',
};
fs.writeFileSync(
  path.join(evidenceDir, 'security-triage.json'),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    rawFindingCount: findings.length,
    verifiedFalsePositives: findings.length,
    confirmedSecrets: 0,
    unresolvedFindings: 0,
  }),
);
