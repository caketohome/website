import { dbQuery, closeDbPool } from "../src/lib/db";

async function inspectTaxonomyAndPim() {
  console.log("============================================================");
  console.log("🔍 INSPECTING TAXONOMY, CATEGORIES, AND PIM STRUCTURE");
  console.log("============================================================");

  try {
    // 1. product_category
    const catRows = await dbQuery(`SELECT * FROM "product_category" LIMIT 20`);
    console.log(`\n--- product_category table (${catRows.rows.length} rows) ---`);
    catRows.rows.forEach(r => console.log(JSON.stringify(r)));

    // 2. product_category_product
    const catProdRows = await dbQuery(`SELECT * FROM "product_category_product" LIMIT 20`);
    console.log(`\n--- product_category_product table (${catProdRows.rows.length} rows) ---`);
    catProdRows.rows.forEach(r => console.log(JSON.stringify(r)));

    // 3. Settings table
    const settingsRows = await dbQuery(`SELECT "group", "key", "value" FROM "setting"`);
    console.log(`\n--- setting table (${settingsRows.rows.length} rows) ---`);
    settingsRows.rows.forEach(r => {
      const valPreview = typeof r.value === "object" ? JSON.stringify(r.value).substring(0, 100) + "..." : String(r.value);
      console.log(`  Group: "${r.group}" | Key: "${r.key}" | Value: ${valPreview}`);
    });

  } finally {
    await closeDbPool();
  }
}

inspectTaxonomyAndPim().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
