/**
 * Phase 4F Step 3C.2 — Packaging Master-Data Forensic Inspection
 * 
 * READ-ONLY. No mutations. No inserts. No updates. No deletes.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Try .env.local
  try {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=') || trimmed.startsWith('PG_URL=')) {
        return trimmed.substring(trimmed.indexOf('=') + 1).trim();
      }
    }
  } catch (e) {}
  // Try backend .env
  try {
    const envPath = path.join(__dirname, '../../backend/.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
    }
  } catch (e) {}
  throw new Error('No database connection string found');
}

async function main() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  const q = async (sql) => {
    const res = await client.query(sql);
    return res.rows;
  };

  console.log('='.repeat(80));
  console.log('Phase 4F Step 3C.2 — PACKAGING MASTER-DATA FORENSIC INSPECTION');
  console.log('READ-ONLY — NO MUTATIONS');
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  // ======================================================================
  // A. public.product
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('A. PUBLIC.PRODUCT — SCHEMA & DATA');
  console.log('─'.repeat(80));

  const productCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product'
    ORDER BY ordinal_position
  `);
  console.log('\nA.1 Columns:');
  productCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}${c.character_maximum_length ? '('+c.character_maximum_length+')' : ''} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${c.column_default ? 'DEFAULT '+c.column_default : ''}`));

  const productConstraints = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
    FROM pg_constraint c
    WHERE conrelid = 'public.product'::regclass
    ORDER BY conname
  `);
  console.log('\nA.2 Constraints:');
  productConstraints.forEach(c => {
    const type = {p:'PK',f:'FK',u:'UNIQUE',c:'CHECK'}[c.contype] || c.contype;
    console.log(`  [${type}] ${c.conname}: ${c.definition}`);
  });

  const productIndexes = await q(`
    SELECT indexname, indexdef FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'product' ORDER BY indexname
  `);
  console.log('\nA.3 Indexes:');
  productIndexes.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  const productByType = await q(`
    SELECT merchandise_type, COUNT(*) as cnt FROM public.product GROUP BY merchandise_type ORDER BY merchandise_type
  `);
  console.log('\nA.4 Product count by merchandise_type:');
  productByType.forEach(r => console.log(`  ${r.merchandise_type || 'NULL'}: ${r.cnt}`));

  const productTotal = await q(`SELECT COUNT(*) as cnt FROM public.product`);
  console.log(`\nA.5 Total products: ${productTotal[0].cnt}`);
  const deletedProducts = await q(`SELECT COUNT(*) as cnt FROM public.product WHERE deleted_at IS NOT NULL`);
  console.log(`A.6 Soft-deleted products: ${deletedProducts[0].cnt}`);
  const activeProducts = await q(`SELECT COUNT(*) as cnt FROM public.product WHERE deleted_at IS NULL`);
  console.log(`A.7 Active products: ${activeProducts[0].cnt}`);

  const sampleCake = await q(`
    SELECT id, title, handle, merchandise_type, status, hs_code, metadata::text as metadata_text, created_at, deleted_at
    FROM public.product WHERE merchandise_type = 'CAKE' AND deleted_at IS NULL LIMIT 1
  `);
  console.log('\nA.8 Sample CAKE:');
  if (sampleCake.length > 0) Object.entries(sampleCake[0]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  const sampleAcc = await q(`
    SELECT id, title, handle, merchandise_type, status, hs_code, metadata::text as metadata_text, created_at, deleted_at
    FROM public.product WHERE merchandise_type = 'ACCESSORY' AND deleted_at IS NULL LIMIT 1
  `);
  console.log('\nA.9 Sample ACCESSORY:');
  if (sampleAcc.length > 0) Object.entries(sampleAcc[0]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  try {
    const metadataKeys = await q(`
      SELECT DISTINCT jsonb_object_keys(metadata) as key 
      FROM public.product WHERE metadata IS NOT NULL AND metadata::text != '{}' AND metadata::text != 'null'
      ORDER BY key
    `);
    console.log('\nA.10 Distinct metadata JSON keys:');
    if (metadataKeys.length === 0) console.log('  (no metadata keys)');
    else metadataKeys.forEach(k => console.log(`  ${k.key}`));
  } catch (e) { console.log(`\nA.10 Metadata keys: ${e.message}`); }

  const productStatuses = await q(`SELECT status, COUNT(*) as cnt FROM public.product GROUP BY status ORDER BY status`);
  console.log('\nA.11 Product status distribution:');
  productStatuses.forEach(r => console.log(`  ${r.status || 'NULL'}: ${r.cnt}`));

  // ======================================================================
  // B. public.product_variant
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('B. PUBLIC.PRODUCT_VARIANT — SCHEMA & DATA');
  console.log('─'.repeat(80));

  const pvCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_variant'
    ORDER BY ordinal_position
  `);
  console.log('\nB.1 Columns:');
  pvCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}${c.character_maximum_length ? '('+c.character_maximum_length+')' : ''} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${c.column_default ? 'DEFAULT '+c.column_default : ''}`));

  const pvConstraints = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
    FROM pg_constraint c WHERE conrelid = 'public.product_variant'::regclass ORDER BY conname
  `);
  console.log('\nB.2 Constraints:');
  pvConstraints.forEach(c => {
    const type = {p:'PK',f:'FK',u:'UNIQUE',c:'CHECK'}[c.contype] || c.contype;
    console.log(`  [${type}] ${c.conname}: ${c.definition}`);
  });

  const pvIndexes = await q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'product_variant' ORDER BY indexname`);
  console.log('\nB.3 Indexes:');
  pvIndexes.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  const pvTotal = await q(`SELECT COUNT(*) as cnt FROM public.product_variant`);
  console.log(`\nB.4 Total variants: ${pvTotal[0].cnt}`);
  const pvDeleted = await q(`SELECT COUNT(*) as cnt FROM public.product_variant WHERE deleted_at IS NOT NULL`);
  console.log(`B.5 Soft-deleted variants: ${pvDeleted[0].cnt}`);

  const noVariants = await q(`
    SELECT COUNT(*) as cnt FROM public.product p WHERE p.deleted_at IS NULL 
    AND NOT EXISTS (SELECT 1 FROM public.product_variant pv WHERE pv.product_id = p.id AND pv.deleted_at IS NULL)
  `);
  console.log(`B.6 Active products WITHOUT active variants: ${noVariants[0].cnt}`);

  const withVariants = await q(`
    SELECT COUNT(*) as cnt FROM public.product p WHERE p.deleted_at IS NULL 
    AND EXISTS (SELECT 1 FROM public.product_variant pv WHERE pv.product_id = p.id AND pv.deleted_at IS NULL)
  `);
  console.log(`B.7 Active products WITH active variants: ${withVariants[0].cnt}`);

  const sampleVar = await q(`
    SELECT pv.id, pv.product_id, pv.title, pv.sku, pv.barcode,
           pv.weight, pv.hs_code, pv.manage_inventory, pv.allow_backorder,
           pv.metadata::text as metadata_text, pv.created_at
    FROM public.product_variant pv WHERE pv.deleted_at IS NULL LIMIT 2
  `);
  console.log('\nB.8 Sample variants:');
  sampleVar.forEach((v, i) => { console.log(`  [${i}]`); Object.entries(v).forEach(([k,val]) => console.log(`    ${k}: ${val}`)); });

  try {
    const weightUnits = await q(`
      SELECT weight_unit, COUNT(*) as cnt FROM public.product_variant WHERE deleted_at IS NULL GROUP BY weight_unit ORDER BY weight_unit
    `);
    console.log('\nB.9 Weight unit distribution:');
    weightUnits.forEach(r => console.log(`  ${r.weight_unit || 'NULL'}: ${r.cnt}`));
  } catch (e) {
    console.log(`\nB.9 Weight unit: column does not exist — ${e.message}`);
    // Fallback: check if weight is populated
    const hasWeight = await q(`SELECT COUNT(*) as cnt FROM public.product_variant WHERE weight IS NOT NULL AND deleted_at IS NULL`);
    console.log(`  Variants with weight set: ${hasWeight[0].cnt}`);
  }

  const variantDist = await q(`
    SELECT p.merchandise_type, COUNT(DISTINCT pv.product_id) as products, COUNT(pv.id) as variants
    FROM public.product p JOIN public.product_variant pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
    WHERE p.deleted_at IS NULL GROUP BY p.merchandise_type ORDER BY p.merchandise_type
  `);
  console.log('\nB.10 Variant distribution by merchandise_type:');
  variantDist.forEach(r => console.log(`  ${r.merchandise_type}: ${r.products} products, ${r.variants} variants`));

  // ======================================================================
  // C. public.product_category
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('C. PUBLIC.PRODUCT_CATEGORY');
  console.log('─'.repeat(80));

  try {
    const catCols = await q(`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product_category' ORDER BY ordinal_position
    `);
    if (catCols.length === 0) { console.log('\n  TABLE DOES NOT EXIST'); }
    else {
      console.log('\nC.1 Columns:');
      catCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}`));
      const catCount = await q(`SELECT COUNT(*) as cnt FROM public.product_category`);
      console.log(`\nC.2 Total categories: ${catCount[0].cnt}`);
      const catAll = await q(`SELECT * FROM public.product_category ORDER BY id LIMIT 20`);
      console.log('\nC.3 Categories:');
      catAll.forEach(r => console.log(`  ${JSON.stringify(r)}`));
      const catConstraints = await q(`
        SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
        FROM pg_constraint c WHERE conrelid = 'public.product_category'::regclass ORDER BY conname
      `);
      console.log('\nC.4 Constraints:');
      catConstraints.forEach(c => console.log(`  [${c.contype}] ${c.conname}: ${c.definition}`));
    }
  } catch (e) { console.log(`  ${e.message}`); }

  // ======================================================================
  // D. Junction table search
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('D. PRODUCT-CATEGORY JUNCTION / RELATIONSHIP');
  console.log('─'.repeat(80));

  try {
    const jTables = await q(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name LIKE '%categor%product%' OR table_name LIKE '%product%categor%')
      ORDER BY table_name
    `);
    console.log('\nD.1 Junction tables found:');
    if (jTables.length === 0) console.log('  NONE');
    else jTables.forEach(t => console.log(`  ${t.table_name}`));

    // Check if category_id is on product directly
    const catOnProduct = await q(`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product' AND column_name LIKE '%categor%'
    `);
    console.log('\nD.2 Category columns on product table:');
    if (catOnProduct.length === 0) console.log('  (none)');
    else catOnProduct.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}`));
  } catch (e) { console.log(`  ${e.message}`); }

  // ======================================================================
  // E. public.branch_inventory
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('E. PUBLIC.BRANCH_INVENTORY — SCHEMA & DATA');
  console.log('─'.repeat(80));

  const biCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branch_inventory' ORDER BY ordinal_position
  `);
  console.log('\nE.1 Columns:');
  biCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${c.column_default ? 'DEFAULT '+c.column_default : ''}`));

  const biConstraints = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
    FROM pg_constraint c WHERE conrelid = 'public.branch_inventory'::regclass ORDER BY conname
  `);
  console.log('\nE.2 Constraints:');
  biConstraints.forEach(c => {
    const type = {p:'PK',f:'FK',u:'UNIQUE',c:'CHECK'}[c.contype] || c.contype;
    console.log(`  [${type}] ${c.conname}: ${c.definition}`);
  });

  const biIndexes = await q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'branch_inventory' ORDER BY indexname`);
  console.log('\nE.3 Indexes:');
  biIndexes.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  const biCount = await q(`SELECT COUNT(*) as cnt FROM public.branch_inventory`);
  console.log(`\nE.4 Total rows: ${biCount[0].cnt}`);
  const biNullProd = await q(`SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE product_id IS NULL`);
  console.log(`E.5 NULL product_id rows: ${biNullProd[0].cnt}`);
  const biNullVar = await q(`SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE variant_id IS NULL`);
  console.log(`E.6 NULL variant_id rows: ${biNullVar[0].cnt}`);

  try {
    const biByType = await q(`
      SELECT p.merchandise_type, COUNT(*) as rows, SUM(bi.quantity) as total_qty
      FROM public.branch_inventory bi
      JOIN public.product_variant pv ON pv.id = bi.variant_id
      JOIN public.product p ON p.id = pv.product_id
      GROUP BY p.merchandise_type ORDER BY p.merchandise_type
    `);
    console.log('\nE.7 Inventory by merchandise_type:');
    biByType.forEach(r => console.log(`  ${r.merchandise_type}: ${r.rows} rows, total qty=${r.total_qty}`));
  } catch (e) { console.log(`\nE.7 ERROR: ${e.message}`); }

  const biSample = await q(`
    SELECT bi.* FROM public.branch_inventory bi LIMIT 3
  `);
  console.log('\nE.8 Sample rows:');
  biSample.forEach(r => console.log(`  ${JSON.stringify(r)}`));

  try {
    const biNeg = await q(`SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE quantity < 0`);
    console.log(`\nE.9 Negative quantity rows: ${biNeg[0].cnt}`);
  } catch (e) { console.log(`\nE.9 ERROR: ${e.message}`); }

  const branchStock = await q(`
    SELECT branch_id, COUNT(*) as items, SUM(quantity) as total_qty
    FROM public.branch_inventory GROUP BY branch_id ORDER BY branch_id
  `);
  console.log('\nE.10 Stock by branch:');
  branchStock.forEach(r => console.log(`  branch ${r.branch_id}: ${r.items} items, qty=${r.total_qty}`));

  // Check if product_id column exists on branch_inventory
  const biHasProductId = biCols.find(c => c.column_name === 'product_id');
  console.log(`\nE.11 branch_inventory.product_id column exists: ${biHasProductId ? 'YES' : 'NO'}`);
  if (biHasProductId) console.log(`  Nullability: ${biHasProductId.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}`);

  // ======================================================================
  // F. public.inventory_movement
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('F. PUBLIC.INVENTORY_MOVEMENT');
  console.log('─'.repeat(80));

  const imCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_movement' ORDER BY ordinal_position
  `);
  console.log('\nF.1 Columns:');
  imCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${c.column_default ? 'DEFAULT '+c.column_default : ''}`));

  const imConstraints = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
    FROM pg_constraint c WHERE conrelid = 'public.inventory_movement'::regclass ORDER BY conname
  `);
  console.log('\nF.2 Constraints:');
  imConstraints.forEach(c => {
    const type = {p:'PK',f:'FK',u:'UNIQUE',c:'CHECK'}[c.contype] || c.contype;
    console.log(`  [${type}] ${c.conname}: ${c.definition}`);
  });

  const imCount = await q(`SELECT COUNT(*) as cnt FROM public.inventory_movement`);
  console.log(`\nF.3 Total rows: ${imCount[0].cnt}`);

  // product_id/variant_id nullability on movement
  const imProdNull = imCols.filter(c => ['product_id','variant_id'].includes(c.column_name));
  console.log('\nF.4 product_id/variant_id nullability:');
  imProdNull.forEach(c => console.log(`  ${c.column_name}: ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}`));

  // ======================================================================
  // G. public.inventory_cost_lot
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('G. PUBLIC.INVENTORY_COST_LOT');
  console.log('─'.repeat(80));

  const clCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_cost_lot' ORDER BY ordinal_position
  `);
  console.log('\nG.1 Columns:');
  clCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${c.column_default ? 'DEFAULT '+c.column_default : ''}`));

  const clConstraints = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
    FROM pg_constraint c WHERE conrelid = 'public.inventory_cost_lot'::regclass ORDER BY conname
  `);
  console.log('\nG.2 Constraints:');
  clConstraints.forEach(c => {
    const type = {p:'PK',f:'FK',u:'UNIQUE',c:'CHECK'}[c.contype] || c.contype;
    console.log(`  [${type}] ${c.conname}: ${c.definition}`);
  });

  const clIndexes = await q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_cost_lot' ORDER BY indexname`);
  console.log('\nG.3 Indexes:');
  clIndexes.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  const clCount = await q(`SELECT COUNT(*) as cnt FROM public.inventory_cost_lot`);
  console.log(`\nG.4 Total rows: ${clCount[0].cnt}`);

  const clProdNull = clCols.filter(c => ['product_id','variant_id'].includes(c.column_name));
  console.log('\nG.5 product_id/variant_id nullability:');
  clProdNull.forEach(c => console.log(`  ${c.column_name}: ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}`));

  // ======================================================================
  // H. public.inventory_cost_consumption
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('H. PUBLIC.INVENTORY_COST_CONSUMPTION');
  console.log('─'.repeat(80));

  const ccCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_cost_consumption' ORDER BY ordinal_position
  `);
  console.log('\nH.1 Columns:');
  ccCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${c.column_default ? 'DEFAULT '+c.column_default : ''}`));

  const ccConstraints = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
    FROM pg_constraint c WHERE conrelid = 'public.inventory_cost_consumption'::regclass ORDER BY conname
  `);
  console.log('\nH.2 Constraints:');
  ccConstraints.forEach(c => {
    const type = {p:'PK',f:'FK',u:'UNIQUE',c:'CHECK'}[c.contype] || c.contype;
    console.log(`  [${type}] ${c.conname}: ${c.definition}`);
  });

  const ccCount = await q(`SELECT COUNT(*) as cnt FROM public.inventory_cost_consumption`);
  console.log(`\nH.3 Total rows: ${ccCount[0].cnt}`);

  // ======================================================================
  // I. purchase_item
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('I. PUBLIC.PURCHASE_ITEM');
  console.log('─'.repeat(80));

  const piCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_item' ORDER BY ordinal_position
  `);
  console.log('\nI.1 Columns:');
  piCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${c.column_default ? 'DEFAULT '+c.column_default : ''}`));

  const piConstraints = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition, contype
    FROM pg_constraint c WHERE conrelid = 'public.purchase_item'::regclass ORDER BY conname
  `);
  console.log('\nI.2 Constraints:');
  piConstraints.forEach(c => {
    const type = {p:'PK',f:'FK',u:'UNIQUE',c:'CHECK'}[c.contype] || c.contype;
    console.log(`  [${type}] ${c.conname}: ${c.definition}`);
  });

  const piCount = await q(`SELECT COUNT(*) as cnt FROM public.purchase_item`);
  console.log(`\nI.3 Total rows: ${piCount[0].cnt}`);

  // ======================================================================
  // J. accounting_account
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('J. ACCOUNTING ACCOUNTS — INVENTORY & COGS');
  console.log('─'.repeat(80));

  // First discover columns
  const aaCols = await q(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'accounting_account' ORDER BY ordinal_position
  `);
  console.log('\nJ.2 accounting_account columns:');
  aaCols.forEach(c => console.log(`  ${c.column_name}`));

  // Try to query relevant accounts - use try/catch to handle column name variations
  try {
    const invAccounts = await q(`
      SELECT * FROM public.accounting_account 
      WHERE code IN ('1130','1131','1132','1133','1140','1141','1142','1143','1144','5100','5110','5120','5130','2110','2111')
      ORDER BY code
    `);
    console.log('\nJ.3 Inventory/COGS/GST/AP accounts:');
    invAccounts.forEach(r => console.log(`  ${JSON.stringify(r)}`));
  } catch (e) {
    console.log(`\nJ.3 ERROR: ${e.message}`);
    // Try alternative column names
    try {
      const invAccounts2 = await q(`
        SELECT * FROM public.accounting_account LIMIT 3
      `);
      console.log('  Sample accounting_account rows:');
      invAccounts2.forEach(r => console.log(`  ${JSON.stringify(r)}`));
    } catch (e2) { console.log(`  ${e2.message}`); }
  }

  // ======================================================================
  // K. branch
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('K. PUBLIC.BRANCH');
  console.log('─'.repeat(80));

  const brCount = await q(`SELECT COUNT(*) as cnt FROM public.branch`);
  console.log(`\nK.1 Total branches: ${brCount[0].cnt}`);
  const brAll = await q(`SELECT * FROM public.branch ORDER BY id LIMIT 5`);
  console.log('\nK.2 Sample branches:');
  brAll.forEach(r => console.log(`  ${JSON.stringify(r)}`));

  // ======================================================================
  // L. UQC/UOM
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('L. UQC / UNIT-OF-MEASURE');
  console.log('─'.repeat(80));

  const uomTables = await q(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    AND (table_name LIKE '%uqc%' OR table_name LIKE '%uom%' OR table_name LIKE '%unit%measure%')
  `);
  console.log('\nL.1 UOM tables:');
  if (uomTables.length === 0) console.log('  NONE');
  else uomTables.forEach(t => console.log(`  ${t.table_name}`));

  const uqcCols = await q(`
    SELECT table_name, column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND (column_name LIKE '%uqc%' OR column_name LIKE '%uom%' OR column_name LIKE '%unit_of_measure%' 
         OR column_name = 'unit' OR column_name = 'weight_unit')
    ORDER BY table_name, column_name
  `);
  console.log('\nL.2 UQC/UOM/weight_unit columns:');
  if (uqcCols.length === 0) console.log('  NONE');
  else uqcCols.forEach(c => console.log(`  ${c.table_name}.${c.column_name}: ${c.data_type}`));

  // ======================================================================
  // M. merchandise_type constraint
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('M. MERCHANDISE_TYPE CONSTRAINT');
  console.log('─'.repeat(80));

  const mtConstraint = await q(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition
    FROM pg_constraint c WHERE conrelid = 'public.product'::regclass AND conname LIKE '%merchandise%'
  `);
  console.log('\nM.1 merchandise_type constraint:');
  if (mtConstraint.length === 0) console.log('  NO CONSTRAINT');
  else mtConstraint.forEach(c => console.log(`  ${c.conname}: ${c.definition}`));

  const packCount = await q(`SELECT COUNT(*) as cnt FROM public.product WHERE merchandise_type = 'PACKAGING'`);
  console.log(`\nM.2 PACKAGING products: ${packCount[0].cnt}`);

  // ======================================================================
  // N. HSN/Tax
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('N. HSN / TAX CLASSIFICATION');
  console.log('─'.repeat(80));

  const hsnTables = await q(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    AND (table_name LIKE '%hsn%' OR table_name LIKE '%tax%' OR table_name LIKE '%gst%')
  `);
  console.log('\nN.1 HSN/Tax tables:');
  if (hsnTables.length === 0) console.log('  NONE');
  else hsnTables.forEach(t => console.log(`  ${t.table_name}`));

  const taxCols = await q(`
    SELECT table_name, column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND (column_name LIKE '%hsn%' OR column_name LIKE '%tax_rate%' OR column_name LIKE '%gst%'
         OR column_name LIKE '%cgst%' OR column_name LIKE '%sgst%' OR column_name LIKE '%igst%')
    ORDER BY table_name, column_name
  `);
  console.log('\nN.2 Tax/GST columns across all tables:');
  if (taxCols.length === 0) console.log('  NONE');
  else taxCols.forEach(c => console.log(`  ${c.table_name}.${c.column_name}: ${c.data_type}`));

  // ======================================================================
  // INDEPENDENT VERIFICATION COUNTS
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('INDEPENDENT VERIFICATION — BASELINE COUNTS');
  console.log('─'.repeat(80));

  const checks = [
    ['product (total)', `SELECT COUNT(*) as cnt FROM public.product`],
    ['product (CAKE)', `SELECT COUNT(*) as cnt FROM public.product WHERE merchandise_type = 'CAKE'`],
    ['product (ACCESSORY)', `SELECT COUNT(*) as cnt FROM public.product WHERE merchandise_type = 'ACCESSORY'`],
    ['product (PACKAGING)', `SELECT COUNT(*) as cnt FROM public.product WHERE merchandise_type = 'PACKAGING'`],
    ['product_variant', `SELECT COUNT(*) as cnt FROM public.product_variant`],
    ['branch_inventory', `SELECT COUNT(*) as cnt FROM public.branch_inventory`],
    ['branch_inventory (NULL product)', `SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE product_id IS NULL`],
    ['inventory_cost_lot', `SELECT COUNT(*) as cnt FROM public.inventory_cost_lot`],
    ['inventory_movement', `SELECT COUNT(*) as cnt FROM public.inventory_movement`],
    ['inventory_cost_consumption', `SELECT COUNT(*) as cnt FROM public.inventory_cost_consumption`],
    ['accounting_account', `SELECT COUNT(*) as cnt FROM public.accounting_account`],
    ['accounting_voucher', `SELECT COUNT(*) as cnt FROM public.accounting_voucher`],
    ['accounting_journal_entry', `SELECT COUNT(*) as cnt FROM public.accounting_journal_entry`],
    ['accounting_fiscal_period', `SELECT COUNT(*) as cnt FROM public.accounting_fiscal_period`],
    ['purchase', `SELECT COUNT(*) as cnt FROM public.purchase`],
    ['purchase_item', `SELECT COUNT(*) as cnt FROM public.purchase_item`],
    ['order', `SELECT COUNT(*) as cnt FROM public."order"`],
    ['payment_transaction', `SELECT COUNT(*) as cnt FROM public.payment_transaction`],
    ['accounting_start_date setting', `SELECT COUNT(*) as cnt FROM public.setting WHERE key = 'accounting_start_date'`],
  ];

  for (const [label, sql] of checks) {
    try {
      const r = await q(sql);
      console.log(`  ${label}: ${r[0].cnt}`);
    } catch (e) {
      console.log(`  ${label}: ERROR — ${e.message}`);
    }
  }

  // ======================================================================
  // ALL TABLES
  // ======================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('COMPLETE TABLE LIST (public schema)');
  console.log('─'.repeat(80));

  const allTables = await q(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
  `);
  console.log(`\nTotal tables: ${allTables.length}`);
  allTables.forEach(t => console.log(`  ${t.table_name}`));

  console.log('\n' + '='.repeat(80));
  console.log('FORENSIC INSPECTION COMPLETE — NO MUTATIONS PERFORMED');
  console.log('='.repeat(80));

  await client.end();
}

main().catch(e => {
  console.error('FATAL ERROR:', e.message);
  process.exit(1);
});
