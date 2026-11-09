const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const envPath = path.join(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

const pool = new Pool({ connectionString: dbUrl });

async function main() {
  console.log('--- TRIGGER FUNCTION fn_teller_movement_immutability ---');
  const fn = await pool.query(`SELECT prosrc FROM pg_proc WHERE proname = 'fn_teller_movement_immutability'`);
  console.log(fn.rows[0]?.prosrc);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });

main().catch(err => { console.error(err); process.exit(1); });
