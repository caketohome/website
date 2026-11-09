const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5_7'
});

async function run() {
  const tables = await pool.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema IN ('public', 'auth') 
    ORDER BY table_schema, table_name;
  `);
  console.log(`Tables in cth_rehearsal_phase5_7 (${tables.rows.length}):`);
  tables.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name}`));

  const orders = await pool.query('SELECT count(*) FROM public."order"');
  const invoices = await pool.query('SELECT count(*) FROM public.invoice');
  const vouchers = await pool.query('SELECT count(*) FROM public.accounting_voucher');
  console.log('Counts:', { orders: orders.rows[0].count, invoices: invoices.rows[0].count, vouchers: vouchers.rows[0].count });

  await pool.end();
}

run().catch(console.error);

