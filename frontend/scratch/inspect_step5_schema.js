const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found in .env");
}

async function run() {
  const c = new Client({ connectionString: getConnectionString() });
  await c.connect();

  console.log('=== EQUITY & SPECIAL ACCOUNTS IN COA ===');
  const res = await c.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account 
    WHERE code LIKE '3%' OR code IN ('4190', '5190', '1590', '1118', '1119')
    ORDER BY code
  `);
  console.table(res.rows);

  console.log('\n=== REVENUE & EXPENSE SUMMARY ===');
  const revExp = await c.query(`
    SELECT type, count(*) as count, count(*) FILTER (WHERE NOT is_group) as leaf_count
    FROM public.accounting_account
    WHERE type IN ('REVENUE', 'EXPENSE')
    GROUP BY type
  `);
  console.table(revExp.rows);

  await c.end();
}

run().catch(console.error);
