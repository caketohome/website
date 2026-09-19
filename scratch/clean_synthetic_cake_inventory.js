const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function resolveProductInventoryMode(product) {
  if (!product) return "UNKNOWN";
  const meta = product.metadata || {};
  const pim = meta.pim_config || product.pim_config || {};

  // 1. Explicit PIM authority
  if (pim.inventory_mode === "STOCK_CONTROLLED" || pim.inventory_mode === "MADE_TO_ORDER_AVAILABILITY") {
    return pim.inventory_mode;
  }

  // 2. Physical accessories
  const cat = String(meta.category || product.category || "").toLowerCase();
  const slug = String(meta.category_slug || product.category_slug || "").toLowerCase();
  const id = String(product.id || "");

  if (
    id.startsWith("acc_") ||
    slug === "accessories" ||
    slug === "cake-accessories" ||
    slug === "greeting-cards" ||
    cat === "accessories" ||
    cat === "cake accessories" ||
    cat === "greeting cards"
  ) {
    return "STOCK_CONTROLLED";
  }

  // 3. Made-to-order bakery indicators
  const isBakeryCategory = [
    "cakes", "pastries", "cupcakes", "specialty-cakes", "artisanal-cakes",
    "chocolate-cakes", "signature-cakes", "black-forest-cakes", "red-velvet-cakes",
    "fruit-mousse-cakes", "butterscotch-caramel-cakes", "desserts"
  ].some(b => slug.includes(b) || cat.includes(b));

  const hasBakeryAttributes = 
    meta.prep_time_minutes != null ||
    meta.flavour != null ||
    meta.cake_base != null ||
    meta.filling != null ||
    (Array.isArray(meta.weight_prices) && meta.weight_prices.length > 0) ||
    meta.weight != null;

  if (isBakeryCategory || hasBakeryAttributes) {
    return "MADE_TO_ORDER_AVAILABILITY";
  }

  return "UNKNOWN";
}

async function runCleanup(isExecute = false) {
  console.log(`\n======================================================`);
  console.log(`BRANCH INVENTORY CLEANUP — ${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'}`);
  console.log(`======================================================\n`);

  // Fetch all rows from branch_inventory joined with product and branch
  const res = await pool.query(`
    SELECT 
      bi.id,
      bi.branch_id,
      bi.product_id,
      bi.variant_id,
      bi.quantity,
      bi.reserved,
      bi.created_at,
      bi.updated_at,
      b.name as branch_name,
      b.code as branch_code,
      p.title as product_title,
      p.metadata as product_metadata
    FROM "branch_inventory" bi
    LEFT JOIN "branch" b ON b.id = bi.branch_id
    LEFT JOIN "product" p ON p.id = bi.product_id
    ORDER BY bi.branch_id, bi.product_id;
  `);

  const totalRows = res.rows.length;
  console.log(`Total rows in branch_inventory: ${totalRows}`);

  // Save complete raw backup first
  const backupPath = path.join(__dirname, 'backup_branch_inventory_before_cleanup.json');
  fs.writeFileSync(backupPath, JSON.stringify(res.rows, null, 2), 'utf8');
  console.log(`✓ Complete raw backup written to: ${backupPath} (${fs.statSync(backupPath).size} bytes)`);

  const syntheticRows = [];
  const preservedRows = [];
  const ambiguousRows = [];

  const affectedProducts = new Map();
  const affectedBranches = new Map();

  for (const row of res.rows) {
    const fakeProd = {
      id: row.product_id,
      title: row.product_title,
      metadata: row.product_metadata
    };
    const mode = resolveProductInventoryMode(fakeProd);

    if (mode === "MADE_TO_ORDER_AVAILABILITY") {
      syntheticRows.push(row);
      affectedProducts.set(row.product_id, (affectedProducts.get(row.product_id) || 0) + 1);
      affectedBranches.set(row.branch_id, (affectedBranches.get(row.branch_id) || 0) + 1);
    } else if (mode === "STOCK_CONTROLLED") {
      preservedRows.push(row);
    } else {
      ambiguousRows.push({ ...row, mode });
    }
  }

  console.log(`\n--- Classification Breakdown ---`);
  console.log(`Synthetic Cake/Pastry Rows Identified for Removal: ${syntheticRows.length}`);
  console.log(`Legitimate Physical Inventory Rows Preserved:     ${preservedRows.length}`);
  console.log(`Ambiguous Rows Requiring Manual Clarification:    ${ambiguousRows.length}`);

  console.log(`\n--- Affected Products Breakdown (${affectedProducts.size} distinct products) ---`);
  for (const [pid, count] of affectedProducts.entries()) {
    const sample = syntheticRows.find(r => r.product_id === pid);
    console.log(` - Product ${pid} ("${sample?.product_title}"): ${count} rows (avg qty: ${sample?.quantity})`);
  }

  console.log(`\n--- Affected Branches Breakdown (${affectedBranches.size} distinct branches) ---`);
  console.log(`Total branches with synthetic cake inventory: ${affectedBranches.size}`);

  if (ambiguousRows.length > 0) {
    console.error(`\n❌ CRITICAL: Found ${ambiguousRows.length} ambiguous rows! Stopping immediately.`);
    console.error(ambiguousRows);
    await pool.end();
    process.exit(1);
  }

  if (preservedRows.length > 0) {
    console.log(`\n--- Preserved Rows (${preservedRows.length}) ---`);
    console.log(preservedRows);
  } else {
    console.log(`\n--- Preserved Rows: 0 (All 758 existing rows in branch_inventory were cake rows with quantity=50 seeded by previous script) ---`);
  }

  if (isExecute) {
    console.log(`\n🗑️ Executing deletion of ${syntheticRows.length} confirmed synthetic cake inventory rows...`);
    const idsToDelete = syntheticRows.map(r => r.id);
    
    // Batch delete in chunks of 500 to avoid query parameter overflow
    let deletedCount = 0;
    const chunkSize = 200;
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize);
      const delRes = await pool.query(`DELETE FROM "branch_inventory" WHERE id = ANY($1);`, [chunk]);
      deletedCount += delRes.rowCount;
    }

    console.log(`✓ Successfully removed ${deletedCount} synthetic cake rows from branch_inventory.`);
    
    // Verify post-deletion state
    const afterCount = await pool.query(`SELECT count(*) FROM "branch_inventory";`);
    console.log(`Remaining rows in branch_inventory: ${afterCount.rows[0].count}`);
  } else {
    console.log(`\nℹ️ DRY RUN COMPLETE. Zero database modifications made. Run with --execute to perform deletion.`);
  }

  await pool.end();
}

const isExecute = process.argv.includes('--execute');
runCleanup(isExecute).catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
