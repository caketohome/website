const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
let dbUrl = '';
for (const l of lines) {
  if (l.trim().startsWith('DATABASE_URL=')) {
    let v = l.trim().substring('DATABASE_URL='.length).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    dbUrl = v;
  }
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
client.connect().then(async () => {
  const r = await client.query('SELECT id, batch_id, recipient_name, status, deleted_at FROM public.corporate_gifting_recipient ORDER BY row_number ASC;');
  console.log('Recipients in DB:', r.rows);
  const b = await client.query('SELECT id, batch_name, deleted_at FROM public.corporate_gifting_batch;');
  console.log('Batches in DB:', b.rows);
  await client.end();
}).catch(console.error);
