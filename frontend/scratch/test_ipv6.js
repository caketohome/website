const http = require('http');

console.log('Testing IPv6 http://[::1]:3000 ...');
const req = http.get({
  host: '::1',
  port: 3000,
  path: '/',
  timeout: 5000,
}, (res) => {
  console.log('HTTP Status from IPv6 [::1]:', res.statusCode);
  res.on('data', () => {});
  res.on('end', () => {
    console.log('Success connecting to IPv6 [::1]:3000!');
    process.exit(0);
  });
});

req.on('timeout', () => {
  console.error('IPv6 request timed out after 5s');
  req.destroy();
  process.exit(1);
});

req.on('error', (err) => {
  console.error('IPv6 request error:', err.message);
  process.exit(1);
});
