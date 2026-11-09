const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test' });

async function main() {
  const t = 'order_sequence';
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public';", [t]);
  console.log('Columns for ' + t + ':', cols.rows);
  const rows = await pool.query('SELECT * FROM public.' + t + ';');
  console.log('Rows for ' + t + ':', rows.rows);

  // Compare with invoice_sequence
  const invCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoice_sequence' AND table_schema = 'public';");
  console.log('\nColumns for invoice_sequence:', invCols.rows);
  const invRows = await pool.query('SELECT * FROM public.invoice_sequence;');
  console.log('Rows for invoice_sequence:', invRows.rows);

  await pool.end();
}

main().catch(console.error);
