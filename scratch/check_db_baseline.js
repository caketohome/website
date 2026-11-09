const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const t0 = Date.now();
  const res = await pool.query('SELECT version()');
  console.log('Ping:', Date.now() - t0, 'ms | Version:', res.rows[0].version.split(' ')[0], res.rows[0].version.split(' ')[1]);
  const tables = ['cms_page', 'cms_homepage_section', 'product', 'product_category', 'media', 'branch', 'customer', 'order'];
  for (const t of tables) {
    try {
      const c = await pool.query(`SELECT count(*) as c FROM "${t}"`);
      console.log(`Table ${t}: ${c.rows[0].c}`);
    } catch(e) {
      console.log(`Table ${t} error:`, e.message);
    }
  }
  const legacy = await pool.query("SELECT id, title FROM product WHERE id IN ('prod_01KYZ4XG8Y5N8KJC6NV54TJTGR', 'prod_01KYZ54K5XD0JP6HJR7R111K5B', 'prod_01KYZ5VK205SFXPVX3MYZTQGHB')");
  console.log('3 Legacy eggless records intact:', legacy.rows.length === 3, legacy.rows.map(r => `${r.id} (${r.title})`));
  await pool.end();
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
