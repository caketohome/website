const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });

async function main() {
  const res = await pool.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'allocate_invoice_number'");
  console.log(res.rows[0].pg_get_functiondef);
  await pool.end();
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
