const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const inv = await pool.query(`
    SELECT bi.branch_id, b.name as branch_name, bi.product_id, p.title, bi.quantity, bi.reserved
    FROM branch_inventory bi
    JOIN branch b ON b.id = bi.branch_id
    JOIN product p ON p.id = bi.product_id
    WHERE bi.product_id LIKE 'acc_%'
    ORDER BY bi.branch_id, bi.product_id
    LIMIT 20
  `);
  console.log('Sample accessory branch_inventory:');
  console.table(inv.rows);

  const branchesWithInv = await pool.query(`
    SELECT bi.branch_id, b.name, COUNT(*) as count, SUM(bi.quantity) as total_qty
    FROM branch_inventory bi
    JOIN branch b ON b.id = bi.branch_id
    GROUP BY bi.branch_id, b.name
    ORDER BY count DESC
  `);
  console.log('Branches with inventory:');
  console.table(branchesWithInv.rows);

  await pool.end();
}

run().catch(console.error);
