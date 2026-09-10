import * as fs from "fs";
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
  const report: Record<string, any> = {};

  for (const table of TARGET_TABLES) {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);

    const idxs = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY indexname;
    `, [table]);

    report[table] = {
      columns: cols.rows,
      indexes: idxs.rows
    };
  }

  fs.writeFileSync("scripts/table_indexes_report.json", JSON.stringify(report, null, 2));
  console.log("Wrote scripts/table_indexes_report.json successfully");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
