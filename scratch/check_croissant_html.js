const http = require('http');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  const { status, data } = await fetchHtml('http://localhost:3000/products/butter-croissant');
  console.log('Status:', status);
  // Search for prices in HTML
  const matches = data.match(/₹\s*\d+/g) || [];
  console.log('Prices found in Butter Croissant HTML:', Array.from(new Set(matches)));
}

run().catch(console.error);
