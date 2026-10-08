// NFR-20: no secrets in the client bundle. Scans every file Vite built (dist/ by default) for
// strings shaped like credentials, and fails when one is found.
//
//   npm run build && npm run check:secrets
//   node tools/check-secrets.mjs dist-e2e
//
// The app has no server and no keys: Mock Service Worker answers the API in the browser, and
// Vite exposes only VITE_* variables, of which there are none. This check keeps it that way.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? 'dist';

const PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe key', /\b[sr]k_(live|test)_[0-9A-Za-z]{16,}\b/],
  ['Anthropic or OpenAI key', /\bsk-(ant-)?[A-Za-z0-9_-]{32,}\b/],
  ['Vercel token', /\bvercel_[A-Za-z0-9]{24,}\b/i],
  ['JSON Web Token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  [
    'credential assignment',
    /\b(api[_-]?key|secret|password|passwd|client[_-]?secret|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["'`][^"'`\s]{12,}["'`]/i,
  ],
  ['basic auth in a URL', /\bhttps?:\/\/[^/\s:@"'`]+:[^/\s@"'`]+@/],
  ['personal email', /\b[A-Za-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud)\.com\b/i],
];

/** Matches that are not secrets, each with the reason. */
const ALLOWED = [];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|css|html|json|map|txt|svg|webmanifest)$/.test(name)) yield path;
  }
}

const found = [];
let scanned = 0;
for (const path of files(root)) {
  scanned++;
  const text = readFileSync(path, 'utf8');
  for (const [kind, re] of PATTERNS) {
    const m = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const hit of text.matchAll(m)) {
      if (ALLOWED.some((a) => hit[0].includes(a.text))) continue;
      found.push(`${relative('.', path)}: ${kind}: ${hit[0].slice(0, 60)}`);
    }
  }
}

console.log(
  JSON.stringify(
    { root, files_scanned: scanned, findings: found, result: found.length ? 'fail' : 'pass' },
    null,
    1,
  ),
);
if (scanned === 0) {
  console.error(`No files in ${root}. Run npm run build first.`);
  process.exitCode = 1;
}
if (found.length) process.exitCode = 1;
