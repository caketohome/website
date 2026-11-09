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

  const branches = await c.query(`
    SELECT id, code, name, deleted_at, metadata
    FROM public.branch
    WHERE id LIKE 'br_01KYWH%' 
       OR id LIKE 'br_conc%' 
       OR id LIKE 'br_tc%' 
       OR id IN ('br_indiranagar', 'br_koramangala', 'br_whitefield');
  `);
  console.log('Sample branches:\n', branches.rows);
  await c.end();
}
run();
