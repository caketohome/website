const path = require('path');
const pg = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new pg.Pool({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });

async function main() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'invoice_sequence'
  `);
  console.log('COLUMNS:', res.rows);
  const rows = await pool.query('SELECT * FROM public.invoice_sequence LIMIT 5');
  console.log('SAMPLE_ROWS:', rows.rows);
  await pool.end();
}
main().catch(console.error);
