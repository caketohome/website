process.env.TEST_DATABASE_URL = "postgresql://cth_test_user@127.0.0.1:5433/cth_test";
process.env.DATABASE_URL = "postgresql://cth_test_user@127.0.0.1:5433/cth_test";
import { ProductRepository } from '../frontend/src/lib/repositories/product.repository';
import { getProductById } from '../frontend/src/lib/data/catalog';

async function main() {
  const repoProd = await ProductRepository.findById('acc_01');
  console.log('REPO PROD acc_01:\n', JSON.stringify(repoProd, null, 2));

  const catalogProd = await getProductById('acc_01');
  console.log('CATALOG PROD acc_01:\n', JSON.stringify(catalogProd, null, 2));

  process.exit(0);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
