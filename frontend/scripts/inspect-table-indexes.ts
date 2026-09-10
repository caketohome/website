import { getDbPool } from "../src/lib/db";

const TARGET_TABLES = [
  "order",
  "product",
  "branch",
  "customer",
  "customer_address",
  "delivery",
  "delivery_partner",
  "delivery_zone",
  "cms_page",
  "cms_homepage_section",
  "order_status_history",
  "product_reviews",
  "lead_enquiry",
  "analytics_event",
  "offer",
  "cart",
  "cart_line_item",
  "payment_transaction"
];

async function run() {
  const pool = getDbPool();

  for (const table of TARGET_TABLES) {
    console.log(`\n==================================================`);
    console.log(`TABLE: "${table}"`);
    console.log(`==================================================`);

    // Columns
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);
    console.log("COLUMNS:");
    for (const c of cols.rows) {
      console.log(` - ${c.column_name.padEnd(25)} : ${c.data_type} (nullable: ${c.is_nullable})`);
    }

    // Indexes
    const idxs = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY indexname;
    `, [table]);
    console.log("\nEXISTING INDEXES:");
    if (idxs.rows.length === 0) {
      console.log(" [!] NO INDEXES FOUND!");
    } else {
      for (const i of idxs.rows) {
        console.log(` - ${i.indexname}: ${i.indexdef}`);
      }
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
