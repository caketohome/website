const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function run() {
  const data = await fetchJson('http://localhost:3000/api/v1/products/prod_01KXYMAJKNS8AGWCN5S1WEGKSD');
  console.log('Weight prices on product:', JSON.stringify(data.product?.weight_prices, null, 2));
}

run().catch(console.error);
