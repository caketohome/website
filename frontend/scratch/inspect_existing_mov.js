const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getDbUrl() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      return l.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

async function inspectMov() {
  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const count = await client.query(`SELECT count(*)::int as cnt FROM "inventory_movement"`);
  console.log("inventory_movement count:", count.rows[0].cnt);

  const sample = await client.query(`SELECT * FROM "inventory_movement" LIMIT 5`);
  console.log("Sample rows:", sample.rows);

  await client.end();
}

inspectMov().catch(console.error);
