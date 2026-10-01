// Fake reviewer: diagnoses split by terminal escape sequences, as some CLIs print them.
const E = '\x1b';
process.stdin.resume();
process.stdin.on('end', () => console.log([
  'The role check is inve' + E + '[2D' + E + '[Krted.',
  'This is an off-by' + E + ']0;title\x07-one error.',
  'The tenant filter is dr' + E + '[Kopped for customerId.',
].join('\n')));
