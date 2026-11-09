const path = require('path');
const pg = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new pg.Pool({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });

async function main() {
  const res = await pool.query('SELECT id, title, merchandise_type, hsn_code, metadata FROM public.product ORDER BY id');
  console.log(`TOTAL PRODUCTS: ${res.rows.length}`);
  for (const r of res.rows) {
    console.log(`${r.id} | ${r.merchandise_type} | ${r.title} | ${r.hsn_code} | ${JSON.stringify(r.metadata)}`);
  }
  await pool.end();
}
main().catch(console.error);
