import { searchProducts, getCatalogFilterOptions } from '../src/lib/data/catalog';
import { closeDbPool } from '../src/lib/db';

async function testCatalog() {
  console.log('Testing searchProducts({})...');
  const t0 = Date.now();
  const res = await searchProducts({});
  console.log(`searchProducts({}) returned in ${Date.now() - t0}ms:`, {
    resultsCount: res.results?.length,
    count: res.count,
    categoriesCount: res.categories?.length,
    flavoursCount: res.flavours?.length,
  });

  if (res.results && res.results.length > 0) {
    console.log('First result:', {
      product_id: res.results[0].product_id,
      title: res.results[0].title,
      price: res.results[0].price,
      handle: res.results[0].handle,
    });
  }

  console.log('\nTesting searchProducts({ q: "Chocolate" })...');
  const resQ = await searchProducts({ q: 'Chocolate' });
  console.log(`searchProducts({ q: "Chocolate" }) returned:`, {
    resultsCount: resQ.results?.length,
    count: resQ.count,
  });

  console.log('\nTesting getCatalogFilterOptions()...');
  const filters = await getCatalogFilterOptions();
  console.log('Filter options:', {
    categories: filters.categories?.length,
    flavours: filters.flavours?.length,
    weights: filters.weights?.length,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  });

  await closeDbPool();
}

testCatalog()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error in testCatalog:', err);
    process.exit(1);
  });
