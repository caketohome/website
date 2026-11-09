const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

async function inspect() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: getConnectionString().includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const res = await client.query(`
    SELECT code, name, type, subtype, is_group 
    FROM public.accounting_account 
    WHERE code LIKE '5%' 
    ORDER BY code;
  `);
  console.log("5xxx Expense Accounts (" + res.rows.length + "):");
  for (const r of res.rows) {
    console.log(`  ${r.code} | ${r.name} | ${r.type} | ${r.subtype} | group:${r.is_group}`);
  }

  const bRes = await client.query('SELECT id, code, name FROM public.branch LIMIT 5;');
  console.log("Branches:", bRes.rows);

  const fpRes = await client.query('SELECT * FROM public.accounting_fiscal_period;');
  console.log("Fiscal Periods:", fpRes.rows);

  const startCfg = await client.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date';");
  console.log("Setting accounting_start_date rows:", startCfg.rows);

  await client.end();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
