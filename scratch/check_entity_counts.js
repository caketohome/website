const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  console.log(`Total public tables: ${res.rows.length}`);
  
  for (const row of res.rows) {
    const t = row.table_name;
    try {
      const cRes = await client.query(`SELECT count(*)::int as count FROM public."${t}"`);
      console.log(`${t.padEnd(35)} : ${cRes.rows[0].count}`);
    } catch (e) {
      console.log(`${t.padEnd(35)} : Error - ${e.message}`);
    }
  }

  await client.end();
}
run().catch(console.error);
