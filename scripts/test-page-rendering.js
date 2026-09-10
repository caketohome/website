const http = require('http');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function testPages() {
  console.log('Testing GET http://localhost:3000/ ...');
  const t0 = Date.now();
  const homeRes = await fetchUrl('http://localhost:3000/');
  console.log(`Homepage status: ${homeRes.status} (${Date.now() - t0}ms), HTML size: ${homeRes.body.length}`);
  
  // Look for product links on homepage
  const matches = [...homeRes.body.matchAll(/href="\/products\/([^"#?]+)"/g)].map(m => m[1]);
  const uniqueSlugs = [...new Set(matches)];
  console.log(`Found ${uniqueSlugs.length} product slugs on homepage:`, uniqueSlugs.slice(0, 5));

  const testSlug = uniqueSlugs[0] || 'red-bee';
  console.log(`\nTesting GET http://localhost:3000/products/${testSlug} ...`);
  const t1 = Date.now();
  const prodRes = await fetchUrl(`http://localhost:3000/products/${testSlug}`);
  console.log(`Product page status: ${prodRes.status} (${Date.now() - t1}ms), HTML size: ${prodRes.body.length}`);

  if (prodRes.body.includes('Cannot find module') || prodRes.body.includes('@medusajs.js')) {
    console.error('❌ ERROR: Found missing module error in product page response!');
    process.exit(1);
  } else {
    console.log('✅ Product page rendered with ZERO missing module errors.');
  }

  // Also test cart page
  console.log('\nTesting GET http://localhost:3000/cart ...');
  const cartRes = await fetchUrl('http://localhost:3000/cart');
  console.log(`Cart page status: ${cartRes.status}, HTML size: ${cartRes.body.length}`);
}

testPages().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
