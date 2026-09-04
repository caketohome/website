import { ApiEngine } from '../src/lib/api-engine';
import { closeDbPool } from '../src/lib/db';

async function diagnose() {
  console.log('1. Calling ensureHydrated()...');
  const status = await ApiEngine.ensureHydrated();
  console.log('Hydration status:', status);

  console.log('2. MemoryStore products count:', ApiEngine.getStore().products?.length);

  console.log('3. Raw products from ApiEngine.getProducts({}):', ApiEngine.getProducts({}).length);

  console.log('4. Calling ApiEngine.searchProducts({}):');
  const searchRes = ApiEngine.searchProducts({});
  console.log('searchProducts total:', searchRes.total, 'products length:', searchRes.products?.length);

  if (searchRes.products?.length === 0 && ApiEngine.getStore().products?.length > 0) {
    console.log('Why did searchProducts return 0 when products exist?');
    const firstP = ApiEngine.getStore().products[0];
    console.log('Sample product:', firstP);
  }

  await closeDbPool();
}

diagnose()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Diagnostic error:', err);
    process.exit(1);
  });
