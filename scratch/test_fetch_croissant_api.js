const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const data = await fetchJson('http://localhost:3000/api/v1/products/butter-croissant');
  console.log('HTTP API Product Response:');
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
