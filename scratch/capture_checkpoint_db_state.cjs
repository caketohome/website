const { Pool } = require('e:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const fs = require('fs');
const pool = new Pool({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });

async function main() {
  const invCount = await pool.query('SELECT COUNT(*)::int as count FROM invoice');
  const prodCount = await pool.query('SELECT COUNT(*)::int as count FROM product');
  const orderCount = await pool.query('SELECT COUNT(*)::int as count FROM "order"');
  const branchInv = await pool.query('SELECT COUNT(*)::int as count FROM branch_inventory');
  const lastInvoices = await pool.query('SELECT * FROM invoice ORDER BY created_at DESC LIMIT 5');
  
  const state = {
    captured_at: new Date().toISOString(),
    database: 'cth_test (127.0.0.1:5433)',
    counts: {
      invoices: invCount.rows[0].count,
      products: prodCount.rows[0].count,
      orders: orderCount.rows[0].count,
      branch_inventory: branchInv.rows[0].count
    },
    last_5_invoices: lastInvoices.rows.map(r => ({
      id: r.id,
      invoice_number: r.invoice_number,
      total_amount: r.total_amount,
      tax_amount: r.tax_amount,
      created_at: r.created_at
    }))
  };
  fs.writeFileSync('C:/Users/alexc/.gemini/antigravity-ide/brain/7377becf-9510-49ba-82ca-bfed67c55b61/scratch/checkpoint_20261027/database_state.json', JSON.stringify(state, null, 2));
  console.log('Database state saved:', JSON.stringify(state.counts));
  await pool.end();
}
main().catch(err => { console.error(err); process.exit(1); });
