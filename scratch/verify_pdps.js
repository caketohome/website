const http = require('http');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log("=== CakeToHome PDP Verification ===");
  const pdpUrls = [
    'http://localhost:3000/products/chocolate-truffle',
    'http://localhost:3000/products/pistachio-gateau',
    'http://localhost:3000/products/choco-red'
  ];

  for (const url of pdpUrls) {
    try {
      const res = await fetchPage(url);
      console.log(`GET ${url}: status=${res.status}, size=${res.body.length}`);
    } catch (err) {
      console.error(`Error fetching ${url}:`, err.message);
    }
  }
}

main();
