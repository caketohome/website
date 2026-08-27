const http = require('http');

http.get('http://localhost:3000/api/v1/health', (res) => {
  console.log('HTTP Status:', res.statusCode);
  console.log('X-Data-Source:', res.headers['x-data-source']);
  console.log('X-Backend-Target:', res.headers['x-backend-target']);
  console.log('X-Backend-Health:', res.headers['x-backend-health']);
  console.log('X-Fallback:', res.headers['x-fallback']);
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Body:', JSON.parse(data));
  });
});
