# seeded-review-check

Test whether the way you hand code to an AI reviewer changes what it finds.

The tool plants a known defect in a small piece of code, shows it to your reviewer twice (once as the raw file, once as a diff against the correct version), and counts how often the reviewer's output contains a candidate diagnosis. Same instruction, same bug; only the presentation changes between the two arms.

## Why

In one small experiment, the same model with the same prompt named a seeded defect 9 times in 10 when shown a diff, and 0 times in 10 when shown raw source. The arms differed in presentation and, for seven of the ten valid diff runs, also in a harness flag; a small control with the flag off still named it in 2 of 3 runs. That is a pattern worth checking, not proof. Details and limits: [POST LINK]. The cases here are new and different from that experiment's material, so you can check your own reviewer without reusing it.

## Limits

- **Keyword scoring.** The output is split into sentences. A run counts as a **candidate** if some sentence matches one of the case's regexes and contains no denial word (no, not, none, never, without, looks correct, looks fine, is correct, properly, correctly). That is a rough proxy: it can miss a real diagnosis and can count a wrong one. Read the saved outputs.
- **Small n.** Default is 3 runs per cell. Three runs show a pattern at best, not a rate.
- **Three toy defects**, each under 25 lines. Your reviewer may behave differently on real code.
- If a reviewer echoes the prompt back, it can match by accident. Read the outputs.

A crash, timeout, non-zero exit or empty output is recorded as NO DATA, never as a miss.

**Known limits.** A reviewer that spawns detached processes may leave them running after a timeout. Terminal escape codes (colors, cursor moves) are stripped from the output before scoring and saving.

## Run

Node 18+. No dependencies. No network calls from the tool.

```
node seeded-review-check.js --reviewer "<command>" [--runs 3] [--case <id>|all] [--timeout 180] [--out results]
```

The reviewer command receives the prompt on stdin and must print its review on stdout.

**Warning: the command runs through your system shell, exactly as you type it.** The tool executes whatever you give it. Only pass commands you trust.

```
# Ollama (--nowordwrap avoids cursor codes; the tool also strips escape codes)
node seeded-review-check.js --reviewer "ollama run llama3 --nowordwrap"

# Claude Code, print mode
node seeded-review-check.js --reviewer "claude -p"

# Codex, prompt from stdin
node seeded-review-check.js --reviewer "codex exec -"
```

Under the table: "Candidates are keyword matches in sentences without a denial; read the outputs to confirm."

Output: a table on screen, plus `results/<timestamp>/summary.md` and one file per run (`<case>-<raw|diff>-<n>.txt`).

```
| case | raw candidate/valid | diff candidate/valid | no-data |
```

Check the tool itself with `node selftest.js` (uses fake reviewers, no network).

## Cases

`cases/<id>/`: `correct.js` (prior version), `seeded.js` (with the defect), `change.diff` (the diff between them), `case.json` (instruction, mechanism regexes, one-line defect description). Add your own by copying a folder.

## Share your result

If you run it, open an issue with your table (model, version, runs). I will collect results across models in a follow-up post.

## License

MIT
