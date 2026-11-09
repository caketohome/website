const { Client } = require('../frontend/node_modules/pg');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../frontend/.env');
let conn = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      conn = trimmed.slice('DATABASE_URL='.length).trim();
    }
  }
}

async function run() {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const indexes = await c.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'teller_movement';
  `);
  console.log('teller_movement indexes:\n', indexes.rows);
  await c.end();
}
run();
