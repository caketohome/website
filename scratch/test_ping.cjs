const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/admin/accounting/config',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.get(options, (res) => {
  console.log('STATUS:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('RESPONSE:', data);
  });
});

req.on('error', (err) => {
  console.error('ERROR:', err.message);
});
