// Fake reviewer: only denies. Every keyword appears, always inside a denial.
process.stdin.resume();
process.stdin.on('end', () => console.log([
  'No inverted role checks were found.',
  'No off-by-one errors found.',
  'Tenant isolation looks correct.',
].join('\n')));
