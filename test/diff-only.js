// Fake reviewer: names the mechanism only when stdin holds a unified diff header.
let s = '';
process.stdin.on('data', (d) => (s += d));
process.stdin.on('end', () => {
  if (/^--- a\//m.test(s) && /^\+\+\+ b\//m.test(s)) {
    console.log('Defect: the role check is inverted. Also an off-by-one skips the first row, and the tenant filter is dropped when customerId is set.');
  } else {
    console.log('Looks fine to me. The code is readable and I found nothing to report.');
  }
});
