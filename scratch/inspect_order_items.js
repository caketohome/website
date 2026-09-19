const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // 1. Columns of "order"
  const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order'`);
  console.log('Columns of "order":', cols.rows.map(r => r.column_name));

  const o = await pool.query('SELECT * FROM "order" LIMIT 1');
  console.log('\n--- Order Sample ---');
  console.log('ID:', o.rows[0].id);
  console.log('Metadata:', JSON.stringify(o.rows[0].metadata || {}).slice(0, 200));

  // 2. Settings / Taxes
  const s = await pool.query('SELECT key, value FROM "setting"');
  console.log('\n--- Settings / Taxes ---');
  s.rows.forEach(r => console.log(`[${r.key}]:`, typeof r.value === 'object' ? JSON.stringify(r.value).slice(0, 100) : r.value));

  // 3. Delivery slots
  const slots = await pool.query('SELECT count(*) FROM "delivery_slot"');
  console.log('\n--- Delivery Slots Count ---:', slots.rows[0].count);

  // 4. CRM Segments
  const segs = await pool.query('SELECT count(*) FROM "crm_segment"');
  console.log('\n--- CRM Segments Count ---:', segs.rows[0].count);

  await pool.end();
}

main().catch(console.error);
