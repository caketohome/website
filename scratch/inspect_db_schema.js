const path = require('path');
let pg;
try {
  pg = require(path.join(__dirname, '../backend/node_modules/pg'));
} catch {
  pg = require(path.join(__dirname, '../frontend/node_modules/pg'));
}
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkDb() {
  try {
    const t0 = Date.now();
    const testRes = await pool.query('SELECT 1 as healthy');
    const ping = Date.now() - t0;
    
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    const tables = tablesRes.rows.map(r => r.table_name);
    const counts = {};
    for (const table of tables) {
      try {
        const c = await pool.query(`SELECT COUNT(*) as count FROM public."${table}"`);
        counts[table] = parseInt(c.rows[0].count, 10);
      } catch (err) {
        counts[table] = 'ERR: ' + err.message;
      }
    }
    
    console.log('DB_INSPECTION_RESULT:');
    console.log(JSON.stringify({
      healthy: testRes.rows[0].healthy === 1,
      pingMs: ping,
      tableCount: tables.length,
      tables: counts
    }, null, 2));
  } catch (err) {
    console.error('DB_ERROR:', err);
  } finally {
    await pool.end();
  }
}

checkDb();
