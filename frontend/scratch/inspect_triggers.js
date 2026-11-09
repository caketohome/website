const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
      if (m) { connectionString = m[1].trim(); break; }
    }
  }
}
if (!connectionString) throw new Error('DATABASE_URL not set');
const pool = new Pool({ connectionString, ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : false });
async function check() {
  const res = await pool.query(`
    SELECT tgname, tgtype, tgdeferrable, tginitdeferred, tgconstraint, tgisinternal
    FROM pg_trigger
    WHERE tgname = 'trg_check_journal_balance'
  `);
  console.log(res.rows);
  await pool.end();
}
check().catch(console.error);
