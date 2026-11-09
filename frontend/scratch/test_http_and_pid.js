const { execSync } = require('child_process');

try {
  const out = execSync('tasklist /FI "PID eq 6016"', { encoding: 'utf8' });
  console.log('PID 6016 details:');
  console.log(out);
} catch (e) {
  console.error("Error:", e);
}

// Also test HTTP to localhost:3000 using node http.get
const http = require('http');

console.log('Testing HTTP to http://localhost:3000 ...');
const req = http.get('http://localhost:3000', { timeout: 10000 }, (res) => {
  console.log('HTTP Status:', res.statusCode);
  console.log('HTTP Headers:', res.headers);
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Received body length:', data.length);
    console.log('Body preview:', data.slice(0, 200));
    process.exit(0);
  });
});

req.on('timeout', () => {
  console.error('HTTP request timed out after 10s');
  req.destroy();
  process.exit(1);
});

req.on('error', (err) => {
  console.error('HTTP error:', err.message);
  process.exit(1);
});
