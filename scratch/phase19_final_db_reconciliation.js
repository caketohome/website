const path = require("path");
const fs = require("fs");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));

async function runFinalReconciliation() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to PostgreSQL for Phase 19 Final Database Reconciliation.");

  const reconciliationReport = {
    timestamp: new Date().toISOString(),
    metrics_reconciliation: {},
    relational_integrity_checks: [],
    anomalies_detected: [],
    status: "PENDING"
  };

  // 1. Entities Direct Row Counts
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM customer) as total_customers,
      (SELECT COUNT(*)::int FROM "order" WHERE deleted_at IS NULL) as total_orders,
      (SELECT COUNT(*)::int FROM product WHERE deleted_at IS NULL) as total_products,
      (SELECT COUNT(*)::int FROM product_variant WHERE deleted_at IS NULL) as total_variants,
      (SELECT COUNT(*)::int FROM branch WHERE deleted_at IS NULL) as total_branches,
      (SELECT COUNT(*)::int FROM branch_inventory) as total_inventory_records,
      (SELECT COUNT(*)::int FROM popup_campaigns) as total_campaigns,
      (SELECT COUNT(*)::int FROM product_category WHERE deleted_at IS NULL) as total_categories;
  `);
  reconciliationReport.metrics_reconciliation = counts.rows[0];
  console.log("\nAuthoritative PostgreSQL Row Counts:", reconciliationReport.metrics_reconciliation);

  // 2. Financial Integrity Check
  const invCols = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'branch_inventory';
  `);
  console.log("branch_inventory columns:", invCols.rows.map(r => r.column_name));

  const financialCheck = await client.query(`
    SELECT
      COUNT(*)::int as total_active_orders,
      COALESCE(SUM(
        CASE
          WHEN metadata->>'total' ~ '^[0-9]+(\.[0-9]+)?$' THEN (metadata->>'total')::numeric
          WHEN metadata->>'total_amount' ~ '^[0-9]+(\.[0-9]+)?$' THEN (metadata->>'total_amount')::numeric
          WHEN metadata->>'grand_total' ~ '^[0-9]+(\.[0-9]+)?$' THEN (metadata->>'grand_total')::numeric
          WHEN metadata->>'subtotal' ~ '^[0-9]+(\.[0-9]+)?$' THEN (metadata->>'subtotal')::numeric
          ELSE 0
        END
      ), 0) as calculated_total_revenue,
      COUNT(*) FILTER (
        WHERE metadata->>'total' IS NULL 
          AND metadata->>'total_amount' IS NULL 
          AND metadata->>'grand_total' IS NULL
          AND metadata->>'subtotal' IS NULL
      )::int as orders_with_missing_totals
    FROM "order"
    WHERE deleted_at IS NULL;
  `);
  const fin = financialCheck.rows[0];
  reconciliationReport.financial_integrity = {
    total_active_orders: fin.total_active_orders,
    calculated_total_revenue: Number(fin.calculated_total_revenue),
    orders_with_missing_totals: Number(fin.orders_with_missing_totals)
  };
  console.log("\nFinancial Integrity:", reconciliationReport.financial_integrity);

  // 3. Relational Health & Orphan Inspections
  // Check A: Orphan variants
  const orphanVariants = await client.query(`
    SELECT count(*)::int as count FROM product_variant pv
    LEFT JOIN product p ON p.id = pv.product_id
    WHERE pv.deleted_at IS NULL AND p.id IS NULL;
  `);
  reconciliationReport.relational_integrity_checks.push({
    check: "Orphan Product Variants",
    count: orphanVariants.rows[0].count,
    passed: orphanVariants.rows[0].count === 0
  });

  // Check B: Orphan Inventory
  const orphanInventory = await client.query(`
    SELECT count(*)::int as count FROM branch_inventory bi
    LEFT JOIN branch b ON b.id = bi.branch_id
    WHERE b.id IS NULL;
  `);
  reconciliationReport.relational_integrity_checks.push({
    check: "Orphan Branch Inventory Records",
    count: orphanInventory.rows[0].count,
    passed: orphanInventory.rows[0].count === 0
  });

  // Check C: Negative Inventory or Reserved Exceeding Quantity
  const invalidStock = await client.query(`
    SELECT count(*)::int as count FROM branch_inventory
    WHERE quantity < 0 OR reserved < 0 OR reserved > quantity;
  `);
  reconciliationReport.relational_integrity_checks.push({
    check: "Invalid Physical Inventory Stock (Negative or Over-reserved)",
    count: invalidStock.rows[0].count,
    passed: invalidStock.rows[0].count === 0
  });

  // Check D: Orders with invalid branch_id
  const invalidOrderBranches = await client.query(`
    SELECT o.id, o.metadata->>'branch_id' as branch_id, o.metadata->>'branch_name' as branch_name 
    FROM "order" o
    LEFT JOIN branch b ON b.id = COALESCE(o.metadata->>'branch_id', 'br_indiranagar')
    WHERE o.deleted_at IS NULL AND b.id IS NULL;
  `);
  console.log("Orders with unresolvable branch ID:", invalidOrderBranches.rows);
  reconciliationReport.relational_integrity_checks.push({
    check: "Orders with Unresolvable Branch",
    count: invalidOrderBranches.rows.length,
    details: invalidOrderBranches.rows,
    passed: invalidOrderBranches.rows.length === 0
  });

  const sampleMissingTotals = await client.query(`
    SELECT id, status::text, metadata FROM "order"
    WHERE metadata->>'total' IS NULL 
      AND metadata->>'total_amount' IS NULL 
      AND metadata->>'grand_total' IS NULL
    LIMIT 5;
  `);
  if (sampleMissingTotals.rows.length > 0) {
    console.log("Sample orders with alternative total metadata:", sampleMissingTotals.rows.map(r => ({
      id: r.id,
      status: r.status,
      keys: Object.keys(r.metadata || {})
    })));
  }

  // Check E: Synthetic Cake records in physical inventory
  const syntheticCakesInInventory = await client.query(`
    SELECT count(*)::int as count FROM branch_inventory
    WHERE product_id NOT LIKE 'acc_%' AND variant_id NOT LIKE 'acc_%';
  `);
  reconciliationReport.relational_integrity_checks.push({
    check: "Zero Synthetic Cake Inventory Records in branch_inventory",
    count: syntheticCakesInInventory.rows[0].count,
    passed: syntheticCakesInInventory.rows[0].count === 0
  });

  // Check F: Unreconciled Statuses in Orders
  const orderStatuses = await client.query(`
    SELECT DISTINCT COALESCE(metadata->>'bakery_status', status::text) as status_name
    FROM "order"
    WHERE deleted_at IS NULL;
  `);
  const validStatuses = new Set([
    "pending", "confirmed", "CONFIRMED", "kitchen_accepted",
    "preparing", "packed", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"
  ]);
  const invalidStatuses = orderStatuses.rows
    .map(r => r.status_name)
    .filter(s => !validStatuses.has(s));

  reconciliationReport.relational_integrity_checks.push({
    check: "All Order Bakery Statuses Belong to Recognized State Machine",
    invalid_statuses: invalidStatuses,
    passed: invalidStatuses.length === 0
  });

  const allChecksPassed = reconciliationReport.relational_integrity_checks.every(c => c.passed) &&
                          reconciliationReport.financial_integrity.orders_with_missing_totals === 0;

  reconciliationReport.status = allChecksPassed ? "PASS" : "FAIL";

  await client.end();

  console.log("\n=================================================");
  console.log("PHASE 19 FINAL RECONCILIATION SUMMARY");
  console.log("=================================================");
  console.log(JSON.stringify(reconciliationReport, null, 2));

  fs.writeFileSync(
    path.join(__dirname, "phase19_reconciliation_results.json"),
    JSON.stringify(reconciliationReport, null, 2),
    "utf8"
  );
  console.log("Saved results to scratch/phase19_reconciliation_results.json");
}

runFinalReconciliation().catch(err => {
  console.error("Phase 19 failed:", err);
  process.exit(1);
});
