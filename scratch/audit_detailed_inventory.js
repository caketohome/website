const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('--- 1. All Distinct Categories & Subcategories in product table ---');
  const catRes = await pool.query(`
    SELECT DISTINCT 
      metadata->>'category' as category,
      metadata->>'category_slug' as slug,
      count(*) as count
    FROM product
    GROUP BY metadata->>'category', metadata->>'category_slug'
    ORDER BY count DESC;
  `);
  console.table(catRes.rows);

  console.log('\n--- 2. Sample Products with Titles, Handles, Categories, and Metadata Keys ---');
  const prodRes = await pool.query(`
    SELECT id, title, handle, metadata->>'category' as category, 
           metadata->'pim_config' as pim_config,
           metadata->>'price' as price
    FROM product
    LIMIT 10;
  `);
  console.log(JSON.stringify(prodRes.rows, null, 2));

  console.log('\n--- 3. Branch Metadata Availability Inspection ---');
  const branchRes = await pool.query(`
    SELECT id, name, code, is_open,
           metadata->'product_availability' as product_avail,
           metadata->'cake_fulfilment' as cake_fulfil,
           metadata->'accessory_inventory' as acc_inv
    FROM branch
    WHERE metadata IS NOT NULL
    LIMIT 5;
  `);
  console.log(JSON.stringify(branchRes.rows, null, 2));

  console.log('\n--- 4. Branch Inventory Summary by Product ---');
  const biSummary = await pool.query(`
    SELECT bi.branch_id, b.name as branch_name, 
           count(bi.id) as inventory_rows,
           sum(bi.quantity) as total_qty,
           sum(bi.reserved) as total_reserved
    FROM branch_inventory bi
    LEFT JOIN branch b ON b.id = bi.branch_id
    GROUP BY bi.branch_id, b.name;
  `);
  console.table(biSummary.rows);

  console.log('\n--- 5. Orders by Branch & Item Sales in PostgreSQL ---');
  const orderStats = await pool.query(`
    SELECT 
      metadata->>'branch_id' as branch_id,
      count(*) as order_count,
      sum((metadata->>'total_amount')::numeric) as gross_sales
    FROM "order"
    GROUP BY metadata->>'branch_id';
  `);
  console.table(orderStats.rows);

  await pool.end();
}

main().catch(console.error);
