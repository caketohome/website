const { ApiEngine } = require('./frontend/src/lib/api-engine');

async function test() {
  await ApiEngine.ensureHydrated();
  const prod = ApiEngine.getProductById('prod_01KXYMAJKNS8AGWCN5S1WEGKSD');
  console.log('Product from ApiEngine:', {
    id: prod?.id,
    title: prod?.title,
    handle: prod?.handle,
    weight: prod?.weight,
    category: prod?.category,
    category_slug: prod?.category_slug,
    pim_config: prod?.pim_config,
    metadata: prod?.metadata,
  });
}
test().catch(console.error);
