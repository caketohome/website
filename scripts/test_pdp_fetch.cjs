const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
});

async function main() {
  try {
    const res = await pool.query('SELECT * FROM public.product WHERE id = $1', ['acc_01']);
    console.log('Product acc_01 in DB:', res.rows[0]);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

main();
