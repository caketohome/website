const path = require('path');
const { getProductBySlug, getProductById } = require(path.join(__dirname, '../frontend/src/lib/data/catalog'));

async function run() {
  const p1 = await getProductBySlug('butter-croissant');
  console.log('getProductBySlug butter-croissant:');
  console.log('  id:', p1?.id);
  console.log('  title:', p1?.title);
  console.log('  price:', p1?.price);
  console.log('  selling_price:', p1?.selling_price);
  console.log('  weight:', p1?.weight);
  console.log('  weight_prices:', JSON.stringify(p1?.weight_prices));
  console.log('  weights:', JSON.stringify(p1?.weights));
  console.log('  pim_config:', JSON.stringify(p1?.pim_config));
  console.log('  variant_options:', JSON.stringify(p1?.variant_options));
}

run().catch(console.error);
