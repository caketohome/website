const http = require('http');

const routes = [
  '/',
  '/login',
  '/account',
  '/category/chocolate-cakes',
  '/cart',
  '/checkout',
  '/dashboard',
  '/dashboard/shop',
  '/dashboard/shop/menu',
  '/products'
];

async function checkRoute(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          headers: res.headers,
          dataLength: data.length,
          snippet: data.slice(0, 300).replace(/\s+/g, ' ')
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        path,
        error: err.message
      });
    });
    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ path, error: 'TIMEOUT (60s)' });
    });
  });
}

async function run() {
  console.log('Testing frontend routes against http://127.0.0.1:3000 ...');
  for (const r of routes) {
    const result = await checkRoute(r);
    console.log(JSON.stringify(result, null, 2));
  }
}

run();
