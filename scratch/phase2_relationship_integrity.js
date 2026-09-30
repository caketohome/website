const fs = require("fs");
const path = require("path");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));

async function runRelationshipIntegrityAudit() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to PostgreSQL for Phase 2 Relationship Integrity Audit.");

  const findings = {
    orphan_orders: [],
    orphan_addresses: [],
    orphan_variants: [],
    orphan_category_links: [],
    orphan_inventory: [],
    duplicate_customers: [],
    duplicate_branches: [],
    jsonb_structure_audit: {},
    summary: {}
  };

  // 1. Order <-> Customer & Order <-> Branch integrity
  console.log("Auditing Order <-> Customer & Order <-> Branch...");
  const orderRes = await client.query(`
    SELECT
      id,
      display_id,
      customer_id,
      email,
      created_at,
      metadata
    FROM "order"
    ORDER BY created_at DESC;
  `);

  const customersRes = await client.query(`SELECT id, email, phone FROM customer;`);
  const customerIdSet = new Set(customersRes.rows.map(c => c.id));
  const customerEmailSet = new Set(customersRes.rows.map(c => (c.email || "").toLowerCase()));

  const branchesRes = await client.query(`SELECT id, name FROM branch;`);
  const branchIdSet = new Set(branchesRes.rows.map(b => b.id));

  let ordersWithMissingCustomer = 0;
  let ordersWithMissingBranch = 0;
  let ordersWithInvalidItems = 0;
  let ordersMetadataKeys = new Set();

  for (const o of orderRes.rows) {
    const meta = o.metadata || {};
    Object.keys(meta).forEach(k => ordersMetadataKeys.add(k));

    const custId = o.customer_id || meta.customer_id;
    if (custId && !customerIdSet.has(custId)) {
      ordersWithMissingCustomer++;
      findings.orphan_orders.push({
        order_id: o.id,
        display_id: o.display_id,
        issue: `customer_id '${custId}' does not exist in customer table`
      });
    }

    const branchId = meta.branch_id;
    if (branchId && !branchIdSet.has(branchId)) {
      ordersWithMissingBranch++;
      findings.orphan_orders.push({
        order_id: o.id,
        display_id: o.display_id,
        issue: `branch_id '${branchId}' in metadata does not exist in branch table`
      });
    }

    // Check items structure in metadata
    const items = meta.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      // check if it's an old legacy order or draft
      ordersWithInvalidItems++;
    }
  }

  // 2. Customer duplicates & orphan addresses
  console.log("Auditing Customer duplicates & addresses...");
  const dupEmailRes = await client.query(`
    SELECT email, count(*) as cnt
    FROM customer
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email
    HAVING count(*) > 1;
  `);
  findings.duplicate_customers = dupEmailRes.rows;

  const orphanAddrRes = await client.query(`
    SELECT ca.id, ca.customer_id
    FROM customer_address ca
    LEFT JOIN customer c ON ca.customer_id = c.id
    WHERE c.id IS NULL;
  `);
  findings.orphan_addresses = orphanAddrRes.rows;

  // 3. Product & Variant relational integrity
  console.log("Auditing Product & Variant relationships...");
  const orphanVariantRes = await client.query(`
    SELECT pv.id, pv.product_id, pv.title
    FROM product_variant pv
    LEFT JOIN product p ON pv.product_id = p.id
    WHERE p.id IS NULL;
  `);
  findings.orphan_variants = orphanVariantRes.rows;

  const orphanCatLinkRes = await client.query(`
    SELECT pcp.product_id, pcp.product_category_id
    FROM product_category_product pcp
    LEFT JOIN product p ON pcp.product_id = p.id
    LEFT JOIN product_category pc ON pcp.product_category_id = pc.id
    WHERE p.id IS NULL OR pc.id IS NULL;
  `);
  findings.orphan_category_links = orphanCatLinkRes.rows;

  // 4. Branch duplicates and inventory relationships
  console.log("Auditing Branch duplicates & Branch Inventory...");
  const dupBranchRes = await client.query(`
    SELECT name, count(*) as cnt
    FROM branch
    GROUP BY name
    HAVING count(*) > 1;
  `);
  findings.duplicate_branches = dupBranchRes.rows;

  const orphanInventoryRes = await client.query(`
    SELECT bi.id, bi.branch_id, bi.product_id, bi.variant_id, bi.quantity, bi.reserved
    FROM branch_inventory bi
    LEFT JOIN branch b ON bi.branch_id = b.id
    LEFT JOIN product p ON bi.product_id = p.id
    WHERE b.id IS NULL OR p.id IS NULL;
  `);
  findings.orphan_inventory = orphanInventoryRes.rows;

  // 5. JSONB Document Field Structure Deep-Dive
  console.log("Deep-diving JSONB structures...");

  // Customer metadata
  const custMetaRes = await client.query(`
    SELECT id, metadata FROM customer WHERE metadata IS NOT NULL LIMIT 50;
  `);
  const custMetaKeys = new Set();
  custMetaRes.rows.forEach(r => {
    if (r.metadata) Object.keys(r.metadata).forEach(k => custMetaKeys.add(k));
  });

  // Product metadata
  const prodMetaRes = await client.query(`
    SELECT id, metadata FROM product WHERE metadata IS NOT NULL LIMIT 50;
  `);
  const prodMetaKeys = new Set();
  prodMetaRes.rows.forEach(r => {
    if (r.metadata) Object.keys(r.metadata).forEach(k => prodMetaKeys.add(k));
  });

  // Branch metadata
  const branchMetaRes = await client.query(`
    SELECT id, metadata FROM branch WHERE metadata IS NOT NULL LIMIT 50;
  `);
  const branchMetaKeys = new Set();
  branchMetaRes.rows.forEach(r => {
    if (r.metadata) Object.keys(r.metadata).forEach(k => branchMetaKeys.add(k));
  });

  // Outreach / Campaign tables check
  console.log("Auditing Outreach / Campaign tables...");
  let outreachStats = {};
  try {
    const crmCampRes = await client.query(`SELECT count(*) as cnt FROM crm_campaign;`);
    outreachStats.crm_campaign = Number(crmCampRes.rows[0].cnt);
  } catch (e) { outreachStats.crm_campaign = "N/A"; }
  try {
    const popRes = await client.query(`SELECT count(*) as cnt FROM popup_campaigns;`);
    outreachStats.popup_campaigns = Number(popRes.rows[0].cnt);
  } catch (e) { outreachStats.popup_campaigns = "N/A"; }
  try {
    const leadRes = await client.query(`SELECT count(*) as cnt FROM lead_enquiry;`);
    outreachStats.lead_enquiry = Number(leadRes.rows[0].cnt);
  } catch (e) { outreachStats.lead_enquiry = "N/A"; }

  await client.end();

  findings.summary = {
    total_orders_audited: orderRes.rows.length,
    orders_with_missing_customer: ordersWithMissingCustomer,
    orders_with_missing_branch: ordersWithMissingBranch,
    orders_without_metadata_items: ordersWithInvalidItems,
    orphan_customer_addresses: findings.orphan_addresses.length,
    orphan_product_variants: findings.orphan_variants.length,
    orphan_category_product_links: findings.orphan_category_links.length,
    orphan_branch_inventory_rows: findings.orphan_inventory.length,
    duplicate_customers_count: findings.duplicate_customers.length,
    duplicate_branches_count: findings.duplicate_branches.length,
    order_metadata_distinct_keys: Array.from(ordersMetadataKeys),
    customer_metadata_distinct_keys: Array.from(custMetaKeys),
    product_metadata_distinct_keys: Array.from(prodMetaKeys),
    branch_metadata_distinct_keys: Array.from(branchMetaKeys),
    outreach_table_counts: outreachStats
  };

  console.log("\n=================================================");
  console.log("PHASE 2 RELATIONSHIP INTEGRITY AUDIT SUMMARY");
  console.log("=================================================");
  console.log(JSON.stringify(findings.summary, null, 2));

  fs.writeFileSync(
    path.join(__dirname, "phase2_relationship_integrity_results.json"),
    JSON.stringify(findings, null, 2),
    "utf8"
  );
  console.log("Saved results to scratch/phase2_relationship_integrity_results.json");
}

runRelationshipIntegrityAudit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
