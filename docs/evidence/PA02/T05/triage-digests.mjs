// Verify only SHA-256 manifests in T03 evidence, against the exact history/snapshot source.
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
      finding.file !== 'docs/evidence/PA02/T03/verification.json'
    ) {
      throw new Error(
        'New finding requires private review; do not suppress it',
      );
    }
    function sourceText(file) {
      if (scan.name === 'history') return show(`${finding.commit}:${file}`);
      const resolved = path.resolve(repo, file);
      if (!resolved.startsWith(repo + path.sep))
        throw new Error('Manifest path escapes repo');
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
    if (!match || record.sha256WorkingFiles[match[1]] !== match[2]) {
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
      formats = matchingFormats(show(`${report.sourceHead}:${match[1]}`));
      verifiedAgainst = report.sourceHead;
    }
    if (!formats.length)
      throw new Error('Unverified digest; retain finding for review');
    findings.push({
      scan: scan.name,
      ...finding,
      classification: 'false_positive_verified_file_digest',
      sourcePath: match[1],
      verifiedFormats: formats,
      verifiedAgainst,
      reason:
        'SHA-256 in sha256WorkingFiles matches the referenced source content, not a provider credential. No validity request was sent.',
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
