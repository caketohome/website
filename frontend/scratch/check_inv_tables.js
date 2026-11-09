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

async function check() {
  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = ['shared_inventory', 'inventory_allocation', 'inventory_reservation', 'inventory_movement'];
  for (const t of tables) {
    const res = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = $1
    `, [t]);
    console.log(`Table ${t} exists:`, res.rows.length > 0, res.rows.map(r => r.column_name));
  }
  await client.end();
}

check().catch(console.error);
