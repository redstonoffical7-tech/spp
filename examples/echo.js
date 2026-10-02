const payload = process.argv[2] || 'hello';

console.log(`echo-service: ${payload}`);

setInterval(() => {
  console.log(`still-running: ${payload}`);
}, 500);
