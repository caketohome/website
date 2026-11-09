const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const dbUrl = match ? match[1].trim() : '';

const { Pool } = require('../frontend/node_modules/pg');
const pool = new Pool({ connectionString: dbUrl });

async function run() {
  const indexes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'teller'
  `);
  console.log('--- teller indexes ---');
  indexes.rows.forEach(r => console.log(r.indexname, '|', r.indexdef));
  await pool.end();
}

run().catch(console.error);
