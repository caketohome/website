const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
let connStr = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connStr = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}
(async () => {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const r = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%order%' ORDER BY table_name");
  console.log("Order-like tables:", r.rows.map(r => r.table_name));
  const r2 = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%payment%' ORDER BY table_name");
  console.log("Payment-like tables:", r2.rows.map(r => r.table_name));
  await client.end();
})();
