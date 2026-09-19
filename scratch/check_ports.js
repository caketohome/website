const http = require('http');

function check(host, port, path = '/') {
  return new Promise(resolve => {
    const req = http.get(`http://${host}:${port}${path}`, { timeout: 3000 }, res => {
      resolve({ host, port, path, status: res.statusCode });
    });
    req.on('error', err => resolve({ host, port, path, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ host, port, path, error: 'TIMEOUT' }); });
  });
}

Promise.all([
  check('127.0.0.1', 3000),
  check('localhost', 3000),
  check('127.0.0.1', 3001),
  check('localhost', 3001),
  check('127.0.0.1', 9000, '/health'),
  check('localhost', 9000, '/health'),
]).then(results => {
  console.log('Port check results:');
  results.forEach(r => console.log(`  ${r.host}:${r.port}${r.path} -> ${r.status || r.error}`));
});
