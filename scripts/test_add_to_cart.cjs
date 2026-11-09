const http = require('http');

const cartId = 'cart_demo_cf_' + Date.now();
const data = JSON.stringify({
  cart_id: cartId,
  variant_id: 'var_prod_01KXYMAJKNWZCFXJHESPTZE01G',
  quantity: 1,
  product_id: 'prod_01KXYMAJKNWZCFXJHESPTZE01G',
  title: 'Classic Chocolate Truffle Cake',
  unit_price: 525,
  price: 525
});

const req = http.request({
  host: '127.0.0.1',
  port: 3000,
  path: '/api/v1/cart/items',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Cookie': `_cth_cart_id=${cartId}`
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('HTTP ' + res.statusCode + ': ' + body.slice(0, 300)));
});

req.on('error', err => console.log('ERR: ' + err.message));
req.write(data);
req.end();
