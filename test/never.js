// Fake reviewer: never names any mechanism.
process.stdin.resume();
process.stdin.on('end', () => console.log('Looks fine to me. The code is readable and I found nothing to report.'));
