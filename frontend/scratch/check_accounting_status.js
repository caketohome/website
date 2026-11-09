// check_accounting_status.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function getConnectionString() {
  const envFiles = [
    path.join(__dirname, '../.env.local'),
    path.join(__dirname, '../.env')
  ];
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
          let val = trimmed.substring('DATABASE_URL='.length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          return val;
        }
      }
    }
  }
  return process.env.DATABASE_URL;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const settingRes = await pool.query(`SELECT * FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL;`);
  console.log('accounting_start_date setting:', settingRes.rows);

  const fpRes = await pool.query(`SELECT * FROM public.accounting_fiscal_period;`);
  console.log('accounting_fiscal_period rows:', fpRes.rows);

  // Check how posting guard works:
  // Is posting blocked if date is before accounting_start_date or fiscal period is locked/missing?
  await pool.end();
}

main().catch(console.error);
