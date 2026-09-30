const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../node_modules/pg'));

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function runForensics() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    console.log("=== STEP 3C.2.1: FORENSIC VALIDATION OF branch_inventory ===");

    // 1. Total row count and null checks
    const totalRes = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE product_id IS NULL) as null_product_id,
        COUNT(*) FILTER (WHERE variant_id IS NULL) as null_variant_id,
        COUNT(*) FILTER (WHERE branch_id IS NULL) as null_branch_id,
        COUNT(*) FILTER (WHERE quantity < 0) as negative_quantity,
        COUNT(*) FILTER (WHERE reserved < 0) as negative_reserved,
        COUNT(*) FILTER (WHERE quantity < reserved) as qty_less_than_reserved,
        MIN(quantity) as min_qty,
        MAX(quantity) as max_qty,
        MIN(reserved) as min_reserved,
        MAX(reserved) as max_reserved
      FROM public.branch_inventory
    `);
    console.log("\n1. Row counts & numeric ranges:", totalRes.rows[0]);

    // 2. Distinct products in branch_inventory
    const distProdRes = await client.query(`
      SELECT 
        bi.product_id,
        p.id as found_product_id,
        p.title,
        p.merchandise_type,
        p.deleted_at as product_deleted_at,
        COUNT(*) as inventory_rows
      FROM public.branch_inventory bi
      LEFT JOIN public.product p ON bi.product_id = p.id
      GROUP BY bi.product_id, p.id, p.title, p.merchandise_type, p.deleted_at
      ORDER BY bi.product_id
    `);
    console.log("\n2. Distinct products referenced in branch_inventory (" + distProdRes.rowCount + " distinct):");
    console.table(distProdRes.rows);

    // 3. Check for any branch_inventory rows where product_id NOT IN product
    const orphanProdRes = await client.query(`
      SELECT bi.id, bi.branch_id, bi.product_id, bi.variant_id
      FROM public.branch_inventory bi
      LEFT JOIN public.product p ON bi.product_id = p.id
      WHERE p.id IS NULL
    `);
    console.log("\n3. Orphan product_id count:", orphanProdRes.rowCount);
    if (orphanProdRes.rowCount > 0) {
      console.log("Orphans found:", orphanProdRes.rows);
    }

    // 4. Distinct variants in branch_inventory
    const distVarRes = await client.query(`
      SELECT 
        bi.variant_id,
        pv.id as found_variant_id,
        pv.product_id as variant_parent_product_id,
        pv.title as variant_title,
        pv.sku as variant_sku,
        pv.deleted_at as variant_deleted_at,
        COUNT(*) as inventory_rows
      FROM public.branch_inventory bi
      LEFT JOIN public.product_variant pv ON bi.variant_id = pv.id
      GROUP BY bi.variant_id, pv.id, pv.product_id, pv.title, pv.sku, pv.deleted_at
      ORDER BY bi.variant_id
    `);
    console.log("\n4. Distinct variants referenced in branch_inventory (" + distVarRes.rowCount + " distinct):");
    console.table(distVarRes.rows);

    // 5. Check for any branch_inventory rows where variant_id NOT IN product_variant
    const orphanVarRes = await client.query(`
      SELECT bi.id, bi.branch_id, bi.product_id, bi.variant_id
      FROM public.branch_inventory bi
      LEFT JOIN public.product_variant pv ON bi.variant_id = pv.id
      WHERE pv.id IS NULL
    `);
    console.log("\n5. Orphan variant_id count:", orphanVarRes.rowCount);
    if (orphanVarRes.rowCount > 0) {
      console.log("Orphans found:", orphanVarRes.rows);
    }

    // 6. Check consistency between bi.product_id and pv.product_id (does bi.product_id match pv.product_id?)
    const mismatchRes = await client.query(`
      SELECT 
        bi.id, 
        bi.branch_id, 
        bi.product_id as bi_product_id, 
        pv.product_id as pv_product_id,
        bi.variant_id
      FROM public.branch_inventory bi
      JOIN public.product_variant pv ON bi.variant_id = pv.id
      WHERE bi.product_id <> pv.product_id
    `);
    console.log("\n6. bi.product_id vs pv.product_id mismatch count:", mismatchRes.rowCount);
    if (mismatchRes.rowCount > 0) {
      console.log("Mismatches found:", mismatchRes.rows);
    }

    // 7. Check for duplicate (branch_id, variant_id) records
    const dupRes = await client.query(`
      SELECT branch_id, variant_id, COUNT(*) as cnt
      FROM public.branch_inventory
      GROUP BY branch_id, variant_id
      HAVING COUNT(*) > 1
    `);
    console.log("\n7. Duplicate (branch_id, variant_id) count:", dupRes.rowCount);
    if (dupRes.rowCount > 0) {
      console.log("Duplicates found:", dupRes.rows);
    }

    // 8. Check existing foreign keys and constraints on branch_inventory
    const constrRes = await client.query(`
      SELECT 
        conname, 
        contype, 
        pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      JOIN pg_namespace n ON cl.relnamespace = n.oid
      WHERE n.nspname = 'public' AND cl.relname = 'branch_inventory'
    `);
    console.log("\n8. Existing constraints on branch_inventory:");
    console.table(constrRes.rows);

    // 9. Check existing indexes on branch_inventory
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'branch_inventory'
    `);
    console.log("\n9. Existing indexes on branch_inventory:");
    console.table(idxRes.rows);

    // 10. Check branches referenced in branch_inventory
    const branchRes = await client.query(`
      SELECT 
        COUNT(DISTINCT bi.branch_id) as referenced_branches,
        COUNT(*) FILTER (WHERE b.id IS NULL) as orphan_branch_rows
      FROM public.branch_inventory bi
      LEFT JOIN public.branch b ON bi.branch_id = b.id
    `);
    console.log("\n10. Branch references:", branchRes.rows[0]);

  } finally {
    await client.end();
  }
}

runForensics().catch(console.error);
