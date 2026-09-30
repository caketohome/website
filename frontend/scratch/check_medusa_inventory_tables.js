const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function checkMedusaTables() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  for (const t of ['inventory_item', 'inventory_level', 'inventory_transfer']) {
    try {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${t}"`);
      console.log(`Table ${t}: ${res.rows[0].cnt} rows`);
      const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`);
      console.log(`  Columns: ${cols.rows.map(c => c.column_name).join(', ')}`);
    } catch (e) {
      console.log(`Table ${t} error: ${e.message}`);
    }
  }
  await client.end();
}
checkMedusaTables().catch(console.error);
