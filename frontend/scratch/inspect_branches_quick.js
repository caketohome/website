const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envLines = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8').split('\n');
let dbUrl = '';
for (const l of envLines) {
  if (l.trim().startsWith('DATABASE_URL=')) {
    dbUrl = l.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
client.connect().then(async () => {
  const r = await client.query('SELECT id, name, deleted_at FROM public.branch ORDER BY id;');
  console.log('Total count:', r.rows.length);
  console.log('Active count (deleted_at IS NULL):', r.rows.filter(b => !b.deleted_at).length);
  console.log('Deleted count (deleted_at IS NOT NULL):', r.rows.filter(b => b.deleted_at).length);
  console.log('All branches:', r.rows);
  await client.end();
}).catch(console.error);
