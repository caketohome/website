const http = require('http');

const retryRoutes = [
  { path: '/', name: 'Homepage' },
  { path: '/search?q=chocolate', name: 'Search Results' },
  { path: '/category/chocolate-cakes', name: 'Category Page' },
  { path: '/occasions/birthday-cakes', name: 'Occasion Page' },
  { path: '/cart', name: 'Cart' },
  { path: '/account', name: 'Customer Profile' },
  { path: '/account/orders', name: 'Order History' },
  { path: '/account/wishlist', name: 'Wishlist' }
];

async function checkRoute(r) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: 'localhost',
      port: 3000,
      path: r.path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Playwright Audit)',
        'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01'
      },
      timeout: 25000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path: r.path,
          name: r.name,
          status: res.statusCode,
          size: data.length,
          hasTitle: data.includes('<title'),
          hasError: data.includes('Internal Server Error') || data.includes('Application error'),
        });
      });
    });
    req.on('error', (err) => {
      resolve({ path: r.path, name: r.name, status: 'ERROR', error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ path: r.path, name: r.name, status: 'TIMEOUT' });
    });
  });
}

async function main() {
  console.log('Testing ' + retryRoutes.length + ' retry routes with 25s timeout...');
  for (const r of retryRoutes) {
    const res = await checkRoute(r);
    console.log(`[${res.status}] ${r.name} (${r.path}) - ${res.size || 0} bytes`);
  }
}

main();
