const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      let v = l.trim().substring('DATABASE_URL='.length).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoice'");
    console.log('Columns of invoice:', cols.rows);
    const sample = await client.query('SELECT * FROM public.invoice LIMIT 1');
    console.log('Sample invoice:', sample.rows[0]);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
