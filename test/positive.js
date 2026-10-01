// Fake reviewer: three clear diagnoses in plain wording, no denial words.
process.stdin.resume();
process.stdin.on('end', () => console.log([
  'Admins and accountants cannot edit open invoices; visitors can.',
  'The offset should be (current - 1) * size; remove the extra increment.',
  'With customerId supplied, the WHERE clause contains only customer_id, so tenant_id is absent.',
].join('\n')));
