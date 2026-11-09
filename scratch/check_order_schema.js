const { Pool } = require('../frontend/node_modules/pg');
const fs = require('fs');
const path = require('path');

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(__dirname, '../frontend/.env');
  if (fs.existsSync(envPath)) {
    for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
      if (m) { connectionString = m[1].trim(); break; }
    }
  }
}
if (!connectionString) throw new Error('DATABASE_URL not set');

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function main() {
  const oCols = await pool.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='order' ORDER BY ordinal_position"
  );
  console.log('ORDER COLS:');
  oCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

  const iCols = await pool.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='invoice' ORDER BY ordinal_position"
  );
  console.log('INVOICE COLS:');
  iCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

  await pool.end();
}

main().catch(console.error);
