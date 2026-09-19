const http = require('http');

http.get('http://localhost:3000/api/v1/products', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const products = parsed.data || parsed.products || (Array.isArray(parsed) ? parsed : []);
      console.log(`Found ${products.length} products. First 5:`);
      products.slice(0, 5).forEach(p => console.log(` - title: "${p.title}", slug: "${p.slug || p.handle}", id: "${p.id || p.product_id}"`));
    } catch (e) {
      console.error(e.message, data.slice(0, 200));
    }
  });
});
