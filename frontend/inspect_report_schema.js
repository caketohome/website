const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    // Branch city info
    const branches = await p.query('SELECT id, name, code, city_id, metadata FROM public.branch WHERE deleted_at IS NULL LIMIT 10');
    console.log("=== SAMPLE BRANCHES (10) ===");
    for (const b of branches.rows) {
      const meta = b.metadata || {};
      console.log(`  ${b.id}: name=${b.name}, code=${b.code}, city_id=${b.city_id}, meta.city=${meta.city}, meta.state=${meta.state}, meta.gst_number=${meta.gst_number}`);
    }

    // Setting table
    const settings = await p.query('SELECT * FROM public.setting LIMIT 20');
    console.log("\n=== SETTING TABLE ===");
    console.log(JSON.stringify(settings.rows, null, 2));

    // branch_settings table
    const bSettings = await p.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'branch_settings\' AND table_schema = \'public\' ORDER BY ordinal_position');
    console.log("\n=== BRANCH_SETTINGS SCHEMA ===");
    console.log(JSON.stringify(bSettings.rows));

    // Check if there's GST data in any setting
    const gstSettings = await p.query("SELECT * FROM public.setting WHERE key LIKE '%gst%' OR key LIKE '%gstin%' OR key LIKE '%tax%'");
    console.log("\n=== GST-RELATED SETTINGS ===");
    console.log(JSON.stringify(gstSettings.rows));

    // Distinct cities in delivery address metadata
    const cities = await p.query("SELECT DISTINCT metadata->'delivery_address'->>'city' as city, COUNT(*) as cnt FROM public.\"order\" WHERE metadata->'delivery_address'->>'city' IS NOT NULL GROUP BY metadata->'delivery_address'->>'city' ORDER BY cnt DESC");
    console.log("\n=== DISTINCT DELIVERY CITIES ===");
    console.log(JSON.stringify(cities.rows));

    // Branch count
    const branchCount = await p.query('SELECT COUNT(*) as total FROM public.branch WHERE deleted_at IS NULL');
    console.log("\n=== ACTIVE BRANCHES ===", branchCount.rows[0].total);

    // Product count
    const prodCount = await p.query('SELECT COUNT(*) as total FROM public.product WHERE deleted_at IS NULL');
    console.log("=== ACTIVE PRODUCTS ===", prodCount.rows[0].total);

    // Customer count
    const custCount = await p.query('SELECT COUNT(*) as total FROM public.customer WHERE deleted_at IS NULL');
    console.log("=== ACTIVE CUSTOMERS ===", custCount.rows[0].total);

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await p.end();
  }
}
main();
