const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
});

async function run() {
  try {
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product' AND table_schema = 'public' ORDER BY ordinal_position;");
    console.log('Columns of public.product:', cols.rows.map(r => `${r.column_name} (${r.data_type})`));

    const p = await pool.query("SELECT * FROM public.product WHERE id = 'acc_01';");
    console.log('Product acc_01:', JSON.stringify(p.rows[0], null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
