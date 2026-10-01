#!/usr/bin/env node
// Selftest: runs the tool against fake reviewers. No network.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = __dirname;
const tool = path.join(root, 'seeded-review-check.js');
// Quote a path for the shell: JSON quoting on Windows, POSIX single quotes elsewhere.
const q = (x) => (process.platform === 'win32' ? JSON.stringify(x) : "'" + x.split("'").join("'" + String.fromCharCode(92) + "''") + "'");
const node = q(process.execPath);
let failures = 0;

function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' :: ' + detail));
  if (!ok) failures++;
}

function runTool(reviewerFile, extra) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'src-selftest-'));
  const reviewer = node + ' ' + q(reviewerFile.includes(path.sep) ? reviewerFile : path.join(root, 'test', reviewerFile));
  const r = spawnSync(process.execPath, [tool, '--reviewer', reviewer, '--runs', '3', '--timeout', '30', '--out', out].concat(extra || []), { encoding: 'utf8' });
  const stamps = fs.existsSync(out) ? fs.readdirSync(out) : [];
  let results = null;
  if (stamps.length) {
    const f = path.join(out, stamps[0], 'results.json');
    if (fs.existsSync(f)) results = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  return { r, out, stamps, results };
}

function perCase(res, fn) {
  return res.results && res.results.cases.length === 3 && res.results.cases.every(fn);
}

// 1. A reviewer that never names the mechanism: 0 candidates everywhere.
let a = runTool('never.js');
check('never: tool exits 0', a.r.status === 0, 'status ' + a.r.status + ' ' + a.r.stderr);
check('never: 3 cases, 0 candidates, 3 valid per presentation',
  perCase(a, (c) => c.raw.candidate === 0 && c.diff.candidate === 0 && c.raw.valid === 3 && c.diff.valid === 3),
  JSON.stringify(a.results));
check('never: disclaimer line printed verbatim',
  a.r.stdout.includes('Candidates are keyword matches in sentences without a denial; read the outputs to confirm.'), 'missing');
check('never: summary.md and 18 output files written', (() => {
  if (!a.stamps.length) return false;
  const files = fs.readdirSync(path.join(a.out, a.stamps[0]));
  return files.includes('summary.md') && files.filter((f) => /^[\w-]+-(raw|diff)-\d+\.txt$/.test(f)).length === 18;
})(), 'files missing');

// 2. Names it only for a unified diff: diff 3/3, raw 0/3.
let b = runTool('diff-only.js');
check('diff-only: diff 3/3 and raw 0/3 in every case',
  perCase(b, (c) => c.diff.candidate === 3 && c.diff.valid === 3 && c.raw.candidate === 0 && c.raw.valid === 3),
  JSON.stringify(b.results));

// 3. A reviewer that exits non-zero is NO DATA, not a miss.
let c = runTool('crash.js');
check('crash: every run is NO DATA, valid 0, named 0',
  perCase(c, (x) => x.raw.valid === 0 && x.diff.valid === 0 && x.raw.candidate === 0 && x.diff.candidate === 0 && x.raw.nodata === 3 && x.diff.nodata === 3),
  JSON.stringify(c.results));

// 3b. Denials are not candidates.
let e = runTool('deny.js');
check('deny: a reviewer that only denies has 0 candidates',
  perCase(e, (x) => x.raw.candidate === 0 && x.diff.candidate === 0 && x.raw.valid === 3 && x.diff.valid === 3), JSON.stringify(e.results));

// 3c. Plain-wording diagnoses are candidates.
let f = runTool('positive.js');
check('positive: three plain diagnoses give 3/3 in every cell',
  perCase(f, (x) => x.raw.candidate === 3 && x.diff.candidate === 3 && x.raw.valid === 3), JSON.stringify(f.results));

// 3c2. Terminal escape codes are stripped before scoring.
let h = runTool('ansi.js');
check('ansi: diagnoses split by escape codes score 3/3',
  perCase(h, (x) => x.raw.candidate === 3 && x.diff.candidate === 3), JSON.stringify(h.results));

// 3d. A reviewer path with an apostrophe survives shell quoting.
const odd = fs.mkdtempSync(path.join(os.tmpdir(), "it's-"));
fs.copyFileSync(path.join(root, 'test', 'never.js'), path.join(odd, 'never.js'));
let g = runTool(path.join(odd, 'never.js'));
check('quoting: reviewer path containing an apostrophe runs', g.results && g.results.cases.every((x) => x.raw.valid === 3), JSON.stringify(g.results) + g.r.stderr);

// 3e. Bad --timeout values are rejected.
const bt = spawnSync(process.execPath, [tool, '--reviewer', 'x', '--timeout', '9999999'], { encoding: 'utf8' });
check('--timeout above 2147483.647 is rejected', bt.status === 2, bt.status + bt.stderr);

// 4. A single case can be selected.
let d = runTool('diff-only.js', ['--case', 'pagination-offset']);
check('--case selects one case', d.results && d.results.cases.length === 1 && d.results.cases[0].id === 'pagination-offset', JSON.stringify(d.results));

// 5. A reviewer that times out is NO DATA.
const slow = spawnSync(process.execPath, [tool, '--reviewer', node + ' -e "setTimeout(()=>{},60000)"', '--runs', '1', '--timeout', '1', '--case', 'pagination-offset', '--out', fs.mkdtempSync(path.join(os.tmpdir(), 'src-selftest-'))], { encoding: 'utf8' });
check('timeout: counted as NO DATA', /no-data/i.test(slow.stdout) && /\|\s*2\s*\|?\s*$/m.test(slow.stdout), slow.stdout + slow.stderr);

console.log(failures === 0 ? '\nSELFTEST GREEN' : '\nSELFTEST RED (' + failures + ' failed)');
process.exit(failures === 0 ? 0 : 1);
