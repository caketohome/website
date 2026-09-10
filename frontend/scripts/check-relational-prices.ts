import { dbQuery, closeDbPool } from "../src/lib/db";

async function checkRelationalPrices() {
  console.log("============================================================");
  console.log("🔍 CHECKING RELATIONAL VARIANTS & PRICES FOR ALL 14 PRODUCTS");
  console.log("============================================================");

  try {
    const productsRes = await dbQuery(`
      SELECT p.id, p.title, p.handle, p.metadata
      FROM "product" p
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at ASC
    `);

    for (const p of productsRes.rows) {
      const variantsRes = await dbQuery(`
        SELECT pv.id, pv.title, pv.sku, pv.manage_inventory, pv.metadata
        FROM "product_variant" pv
        WHERE pv.product_id = $1 AND pv.deleted_at IS NULL
      `, [p.id]);

      console.log(`\nProduct: "${p.title}" (${p.id})`);
      console.log(`  Metadata price: ${p.metadata?.price || p.metadata?.selling_price}`);
      console.log(`  Variants found in product_variant table: ${variantsRes.rows.length}`);
      
      for (const v of variantsRes.rows) {
        const pricesRes = await dbQuery(`
          SELECT pr.id, pr.amount, pr.currency_code, pr.raw_amount
          FROM "product_variant_price_set" pvps
          JOIN "price" pr ON pr.price_set_id = pvps.price_set_id
          WHERE pvps.variant_id = $1 AND pr.deleted_at IS NULL
        `, [v.id]);

        console.log(`    - Variant: "${v.title}" (${v.id}, SKU: ${v.sku})`);
        console.log(`      Prices in price table: ${pricesRes.rows.map(pr => `${pr.currency_code} ${pr.amount}`).join(", ") || "NONE"}`);
      }
    }
  } finally {
    await closeDbPool();
  }
}

checkRelationalPrices().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
