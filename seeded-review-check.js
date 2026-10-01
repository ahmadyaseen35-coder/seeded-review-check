#!/usr/bin/env node
// seeded-review-check: does the presentation of code (raw vs diff) change whether
// your AI reviewer names a seeded defect? Node 18+, no dependencies, no network.
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DISCLAIMER = 'Candidates are keyword matches in sentences without a denial; read the outputs to confirm.';

// Terminal escape sequences (CSI and OSC) that some CLIs print.
const ANSI_CSI = /\x1b\[[0-?]*[ -\/]*[@-~]/g;
const ANSI_OSC = /\x1b\][^\x07]*(\x07|\x1b[\x5c])/g;
const stripAnsi = (t) => t.replace(ANSI_OSC, '').replace(ANSI_CSI, '');

// A sentence that denies or clears the defect is not a candidate.
const DENIAL = /\b(no|not|none|never|without|nothing)\b|(isn|aren|doesn|don|wasn|didn|hasn|haven|won)'t|looks (correct|fine)|is correct|properly|correctly/i;

// Candidate = some sentence matches a mechanism regex and contains no denial.
function isCandidate(text, matchers) {
  return text.split(/[.!?\n]+/).some((sentence) => !DENIAL.test(sentence) && matchers.some((m) => m.test(sentence)));
}

const PRESENTATIONS = ['raw', 'diff'];

function parseArgs(argv) {
  const o = { runs: 3, case: 'all', timeout: 180, out: 'results' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => {
      if (i + 1 >= argv.length) usage('missing value for ' + k);
      return argv[++i];
    };
    if (k === '--reviewer') o.reviewer = v();
    else if (k === '--runs') o.runs = Number(v());
    else if (k === '--case') o.case = v();
    else if (k === '--timeout') o.timeout = Number(v());
    else if (k === '--out') o.out = v();
    else if (k === '--help' || k === '-h') usage();
    else usage('unknown argument ' + k);
  }
  if (!o.reviewer) usage('--reviewer is required');
  if (!Number.isInteger(o.runs) || o.runs < 1) usage('--runs must be a positive integer');
  if (!Number.isFinite(o.timeout) || o.timeout <= 0 || o.timeout > 2147483.647) usage('--timeout must be finite and between 0 and 2147483.647 seconds');
  return o;
}

function usage(msg) {
  if (msg) console.error('Error: ' + msg + '\n');
  console.error('Usage: node seeded-review-check.js --reviewer "<shell command>" [--runs 3] [--case <id>|all] [--timeout 180] [--out results]\n' +
    'The reviewer command is run through the system shell with the prompt on stdin.');
  process.exit(msg ? 2 : 0);
}

function loadCases(which) {
  const dir = path.join(__dirname, 'cases');
  const ids = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'case.json'))).sort();
  const wanted = which === 'all' ? ids : ids.filter((i) => i === which);
  if (!wanted.length) usage('no such case: ' + which + ' (available: ' + ids.join(', ') + ')');
  return wanted.map((id) => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, id, 'case.json'), 'utf8'));
    return {
      meta,
      matchers: meta.mechanism.map((m) => new RegExp(m, 'i')),
      material: {
        raw: fs.readFileSync(path.join(dir, id, 'seeded.js'), 'utf8'),
        diff: fs.readFileSync(path.join(dir, id, 'change.diff'), 'utf8'),
      },
    };
  });
}

// One fixed instruction line, then the material.
function buildPrompt(instruction, material) {
  return instruction + '\n\n' + material;
}

// Runs the command through the system shell. Resolves { ok, output, reason }.
function runReviewer(command, prompt, timeoutSec) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const done = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { child.kill('SIGKILL'); }
      }
    }, timeoutSec * 1000);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => done({ ok: false, output: stdout, reason: 'spawn error: ' + e.message }));
    child.on('close', (code) => {
      if (timedOut) return done({ ok: false, output: stdout, reason: 'timeout after ' + timeoutSec + 's' });
      if (code !== 0) return done({ ok: false, output: stdout, reason: 'exit code ' + code + (stderr.trim() ? '; stderr: ' + stderr.trim().slice(0, 300) : '') });
      if (!stdout.trim()) return done({ ok: false, output: stdout, reason: 'empty output' });
      done({ ok: true, output: stdout, reason: '' });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cases = loadCases(opts.case);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(opts.out, stamp);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Running: ' + opts.reviewer);
  console.log('(this command is executed through the system shell)\n');

  const results = [];
  for (const c of cases) {
    const row = { id: c.meta.id, title: c.meta.title };
    for (const p of PRESENTATIONS) {
      const cell = { candidate: 0, valid: 0, nodata: 0 };
      const prompt = buildPrompt(c.meta.instruction, c.material[p]);
      for (let n = 1; n <= opts.runs; n++) {
        const r = await runReviewer(opts.reviewer, prompt, opts.timeout);
        const output = stripAnsi(r.output);
        let body = output;
        if (r.ok) {
          cell.valid++;
          if (isCandidate(output, c.matchers)) cell.candidate++;
        } else {
          cell.nodata++;
          body = '[NO DATA: ' + r.reason + ']\n' + r.output;
        }
        fs.writeFileSync(path.join(outDir, c.meta.id + '-' + p + '-' + n + '.txt'), body);
      }
      row[p] = cell;
    }
    results.push(row);
  }

  const lines = [
    '| case | raw candidate/valid | diff candidate/valid | no-data |',
    '|---|---|---|---|',
  ].concat(results.map((r) =>
    '| ' + r.id + ' | ' + r.raw.candidate + '/' + r.raw.valid + ' | ' + r.diff.candidate + '/' + r.diff.valid + ' | ' + (r.raw.nodata + r.diff.nodata) + ' |'));
  const table = lines.join('\n');
  const summary = '# seeded-review-check\n\nReviewer: `' + opts.reviewer + '`\nRuns per cell: ' + opts.runs + '\n\n' + table + '\n\n' + DISCLAIMER + '\n';
  fs.writeFileSync(path.join(outDir, 'summary.md'), summary);
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ reviewer: opts.reviewer, runs: opts.runs, cases: results }, null, 2) + '\n');

  console.log(table + '\n');
  console.log(DISCLAIMER);
  console.log('\nOutputs and summary: ' + outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
