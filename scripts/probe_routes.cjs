const http = require('http');

const routes = ['/checkout', '/checkout/cashfree', '/your-order', '/admin/orders', '/branch-manager'];

async function probe(path) {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'GET',
    }, (res) => {
      resolve({ path, statusCode: res.statusCode });
    });
    req.on('error', (err) => {
      resolve({ path, error: err.message });
    });
    req.end();
  });
}

async function main() {
  for (const r of routes) {
    const res = await probe(r);
    console.log(`${res.path} => HTTP ${res.statusCode || res.error}`);
  }
}

main();
