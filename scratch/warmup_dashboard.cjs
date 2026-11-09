const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/dashboard?tab=accounting_setup',
  headers: {
    'Cookie': '_cth_jwt=dummy; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=9999999999',
  }
};

console.log('Sending warmup request to /dashboard?tab=settings...');
const req = http.get(options, (res) => {
  console.log('WARMUP STATUS:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('WARMUP FINISHED. BODY LENGTH:', data.length);
  });
});

req.on('error', (err) => {
  console.error('WARMUP ERROR:', err.message);
});
