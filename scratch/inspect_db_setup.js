const fs = require('fs');
const { Client } = require('../frontend/node_modules/pg');

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- ACCOUNTING / DATE SETTINGS ---');
  const s = await client.query("SELECT id, key, value, \"group\" FROM public.setting WHERE key ILIKE '%account%' OR key ILIKE '%date%' OR key ILIKE '%fiscal%' OR \"group\" = 'accounting'");
  console.log(s.rows);

  console.log('--- ALL SETTING KEYS ---');
  const allS = await client.query("SELECT key, \"group\" FROM public.setting ORDER BY \"group\", key");
  console.log(allS.rows.map(r => `${r.group}: ${r.key}`).join('\n'));

  console.log('--- COMPANY COLUMNS & DATA ---');
  const c = await client.query('SELECT * FROM public.company');
  console.log(c.rows);

  console.log('--- BANK ACCOUNTS ---');
  const b = await client.query('SELECT * FROM public.bank_account');
  console.log(b.rows);

  await client.end();
}

run().catch(console.error);
