const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://cakeshome_user:cakeshome_pass@localhost:5432/cakeshome_db' });

async function main() {
  try {
    // Order table schema
    const schema = await p.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'order' AND table_schema = 'public' ORDER BY ordinal_position");
    console.log("=== ORDER TABLE SCHEMA ===");
    console.log(JSON.stringify(schema.rows, null, 2));
    
    // Sample order metadata to understand JSONB structure
    const sample = await p.query("SELECT id, status, total, metadata FROM public.\"order\" WHERE metadata IS NOT NULL AND metadata::text != '{}' LIMIT 3");
    console.log("\n=== SAMPLE ORDER METADATA (3 rows) ===");
    for (const row of sample.rows) {
      console.log(`\nOrder ${row.id} (status: ${row.status}, total: ${row.total}):`);
      const keys = Object.keys(row.metadata || {});
      console.log("  Metadata keys:", keys.join(", "));
      if (row.metadata.payment_method) console.log("  payment_method:", row.metadata.payment_method);
      if (row.metadata.payment_status) console.log("  payment_status:", row.metadata.payment_status);
      if (row.metadata.payment) console.log("  payment:", JSON.stringify(row.metadata.payment));
      if (row.metadata.delivery) console.log("  delivery:", JSON.stringify(row.metadata.delivery));
      if (row.metadata.branch_id) console.log("  branch_id:", row.metadata.branch_id);
      if (row.metadata.branch_name) console.log("  branch_name:", row.metadata.branch_name);
      if (row.metadata.customer_name) console.log("  customer_name:", row.metadata.customer_name);
      if (row.metadata.customer_phone) console.log("  customer_phone:", row.metadata.customer_phone);
      if (row.metadata.compliance_snapshot) console.log("  compliance_snapshot:", JSON.stringify(row.metadata.compliance_snapshot));
      if (row.metadata.items) console.log("  items count:", row.metadata.items.length, "first item keys:", Object.keys(row.metadata.items[0] || {}));
    }

    // Count orders, distinct statuses, distinct payment methods
    const stats = await p.query("SELECT COUNT(*) as total, COUNT(DISTINCT status) as status_count, COUNT(DISTINCT (metadata->>'payment_method')) as pm_count FROM public.\"order\"");
    console.log("\n=== ORDER STATS ===");
    console.log(JSON.stringify(stats.rows[0]));

    // Distinct statuses
    const statuses = await p.query("SELECT status, COUNT(*) as cnt FROM public.\"order\" GROUP BY status ORDER BY cnt DESC");
    console.log("\n=== ORDER STATUSES ===");
    console.log(JSON.stringify(statuses.rows));

    // Distinct payment methods
    const pms = await p.query("SELECT metadata->>'payment_method' as pm, COUNT(*) as cnt FROM public.\"order\" GROUP BY metadata->>'payment_method' ORDER BY cnt DESC");
    console.log("\n=== PAYMENT METHODS ===");
    console.log(JSON.stringify(pms.rows));

    // Branch table columns  
    const branchSchema = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'branch' AND table_schema = 'public' ORDER BY ordinal_position");
    console.log("\n=== BRANCH TABLE SCHEMA ===");
    console.log(JSON.stringify(branchSchema.rows));

    // Product table columns
    const prodSchema = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product' AND table_schema = 'public' ORDER BY ordinal_position");
    console.log("\n=== PRODUCT TABLE SCHEMA ===");
    console.log(JSON.stringify(prodSchema.rows));

    // Customer table columns
    const custSchema = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer' AND table_schema = 'public' ORDER BY ordinal_position");
    console.log("\n=== CUSTOMER TABLE SCHEMA ===");
    console.log(JSON.stringify(custSchema.rows));

    // GST settings — check if there's a settings/config table
    const settingsTables = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%setting%' OR table_name LIKE '%config%' OR table_name LIKE '%gst%' OR table_name LIKE '%compliance%')");
    console.log("\n=== SETTINGS/CONFIG TABLES ===");
    console.log(JSON.stringify(settingsTables.rows));

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await p.end();
  }
}
main();
