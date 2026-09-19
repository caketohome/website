const path = require('path');
// Test ApiEngine in Node
async function test() {
  const { ApiEngine } = await import(path.join(__dirname, '../frontend/src/lib/api-engine.ts'));
  const occasions = ApiEngine.listOccasions();
  console.log('Total occasions in ApiEngine:', occasions.length);
  occasions.slice(0, 10).forEach(o => {
    const prods = ApiEngine.getOccasionProducts(o.slug);
    console.log(`- [${o.id}] slug: "${o.slug}" | name: "${o.name}" -> ${prods.length} products`);
  });
}
test().catch(console.error);
