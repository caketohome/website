const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let connStr = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connStr = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

(async () => {
  const db = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const res = await db.query(
    "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'audit_log' ORDER BY ordinal_position"
  );
  console.log('--- AUDIT_LOG SCHEMA ---');
  console.log(res.rows);
  await db.end();
})();
