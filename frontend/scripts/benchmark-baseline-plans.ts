import { getDbPool } from "../src/lib/db";

async function testQueryPlans() {
  const pool = getDbPool();

  const testQueries = [
    {
      name: "1. Order List by created_at DESC (Admin/Storefront)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "order" WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50;`
    },
    {
      name: "2. Order List by Customer (Account History)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "order" WHERE customer_id = 'cus_test' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20;`
    },
    {
      name: "3. Order List by Status (Kitchen / Telecalling)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "order" WHERE status = 'pending' AND deleted_at IS NULL ORDER BY created_at DESC;`
    },
    {
      name: "4. CMS Pages by created_at ASC (#1 Top DB Time Query)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "cms_page" WHERE deleted_at IS NULL ORDER BY created_at ASC;`
    },
    {
      name: "5. CMS Homepage Sections by sort_order ASC (#2 Top DB Time Query)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "cms_homepage_section" WHERE deleted_at IS NULL ORDER BY sort_order ASC;`
    },
    {
      name: "6. Delivery Slots Availability Check (Delivery Date + Slots)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "delivery" WHERE delivery_date = '2026-09-07' AND delivery_slot_id = ANY(ARRAY['slot_1', 'slot_2']) AND delivery_status != 'cancelled' AND deleted_at IS NULL;`
    },
    {
      name: "7. Driver Active Deliveries Check (Driver Dispatch)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "delivery" WHERE delivery_partner_id = 'dlp_1' AND delivery_status = ANY(ARRAY['assigned', 'picked_up']) AND deleted_at IS NULL;`
    },
    {
      name: "8. Delivery Zone Branch Lookup (Branch Isolation & Serviceability)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "delivery_zone" WHERE branch_id = 'br_01KYWH05FY08YH6XJKATV0NXDR' AND deleted_at IS NULL;`
    },
    {
      name: "9. Customer Lookup by Phone (OTP Login)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "customer" WHERE phone = '+919876543210' AND deleted_at IS NULL;`
    },
    {
      name: "10. Product Catalog Order by created_at (Catalog Listing)",
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "product" WHERE deleted_at IS NULL ORDER BY created_at ASC;`
    }
  ];

  console.log("================================================================================");
  console.log("  BASELINE EXPLAIN (ANALYZE, BUFFERS) BENCHMARKS");
  console.log("================================================================================\n");

  for (const t of testQueries) {
    console.log(`--- ${t.name} ---`);
    try {
      const res = await pool.query(t.sql);
      for (const row of res.rows) {
        console.log(row["QUERY PLAN"]);
      }
    } catch (e: any) {
      console.log("EXPLAIN error:", e.message);
    }
    console.log("\n");
  }

  process.exit(0);
}

testQueryPlans().catch(err => {
  console.error(err);
  process.exit(1);
});
