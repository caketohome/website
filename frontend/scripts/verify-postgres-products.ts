import { dbQuery, closeDbPool } from '../src/lib/db';
import { ProductRepository } from '../src/lib/repositories/product.repository';

async function verifyProductsDb() {
  console.log('=== PHASE 2: DIRECT POSTGRESQL PRODUCT VERIFICATION ===\n');

  try {
    const totalRes = await dbQuery(`SELECT count(*) AS total FROM "product"`);
    const activeRes = await dbQuery(`SELECT count(*) AS active FROM "product" WHERE deleted_at IS NULL`);
    const archivedRes = await dbQuery(`SELECT count(*) AS archived FROM "product" WHERE deleted_at IS NOT NULL`);

    console.log(`TOTAL PRODUCTS:    ${totalRes.rows[0].total}`);
    console.log(`ACTIVE PRODUCTS:   ${activeRes.rows[0].active}`);
    console.log(`ARCHIVED PRODUCTS: ${archivedRes.rows[0].archived}\n`);

    const sampleRes = await dbQuery(`SELECT id, title, handle, thumbnail, metadata FROM "product" WHERE deleted_at IS NULL LIMIT 5`);
    console.log(`--- Sample Active Products (Raw SQL: ${sampleRes.rows.length}) ---`);
    sampleRes.rows.forEach((r, idx) => {
      console.log(`[${idx + 1}] ID: ${r.id} | Title: "${r.title}" | Handle: "${r.handle}"`);
      console.log(`    Thumbnail: ${r.thumbnail ? r.thumbnail.substring(0, 50) + '...' : 'NONE'}`);
      console.log(`    Metadata: Price=${r.metadata?.price || r.metadata?.selling_price} | Category=${r.metadata?.category} | Flavour=${r.metadata?.flavour}`);
    });

    console.log('\n--- Testing ProductRepository.findAll() ---');
    const repoProducts = await ProductRepository.findAll();
    console.log(`ProductRepository returned ${repoProducts.length} active products.`);
    if (repoProducts.length > 0) {
      console.log(`First product: "${repoProducts[0].title}", Price: ₹${repoProducts[0].price}, Flavour: ${repoProducts[0].flavour}, Category: ${repoProducts[0].category}`);
    }
  } finally {
    await closeDbPool();
  }
}

verifyProductsDb().then(() => process.exit(0)).catch((err) => {
  console.error('Error verifying PostgreSQL products:', err);
  process.exit(1);
});
