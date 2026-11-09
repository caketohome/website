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

async function checkAudit() {
  const conn = getConnectionString();
  const client = new Client({ connectionString: conn, ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false });
  await client.connect();

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND (table_name LIKE '%audit%' OR table_name LIKE '%log%')
    ORDER BY table_name;
  `);
  console.log("Audit / Log tables in DB:", res.rows.map(r => r.table_name));

  await client.end();
}

checkAudit();
