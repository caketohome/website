const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, name, metadata 
      FROM branch 
      WHERE deleted_at IS NULL;
    `);
    console.log(`Checking ${res.rows.length} branches for inventory/stock metadata...`);
    let foundAny = 0;
    for (const b of res.rows) {
      const meta = b.metadata || {};
      const keys = Object.keys(meta);
      const stockKeys = keys.filter(k => k.includes('stock') || k.includes('invent') || k.includes('accessor'));
      if (stockKeys.length > 0) {
        console.log(`Branch ${b.id} (${b.name}) has stock keys:`, stockKeys, meta[stockKeys[0]]);
        foundAny++;
      }
    }
    console.log(`Branches with existing stock metadata: ${foundAny} / ${res.rows.length}`);

    // Check setting table
    const settings = await pool.query(`SELECT id, "group", "key", value FROM setting;`);
    console.log('All settings count:', settings.rows.length);
    const relevantSettings = settings.rows.filter(s => s.key?.includes('acc') || s.group?.includes('acc') || s.group === 'catalog');
    console.log('Relevant settings:', relevantSettings);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
