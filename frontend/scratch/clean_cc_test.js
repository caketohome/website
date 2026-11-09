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
  throw new Error("DATABASE_URL not found");
}

async function clean() {
  const conn = getConnectionString();
  const client = new Client({ connectionString: conn, ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false });
  await client.connect();
  const res = await client.query("DELETE FROM public.cost_centre WHERE code LIKE 'CC_TEST_%';");
  console.log('Deleted lingering test rows:', res.rowCount);
  await client.end();
  process.exit(0);
}

clean().catch(console.error);
