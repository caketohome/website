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
    const cCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company'");
    console.log('company columns:', cCols.rows.map(r => r.column_name));
    const cRows = await client.query('SELECT * FROM public.company');
    console.log('company rows:', cRows.rows);

    const gCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'gst_registration'");
    console.log('gst_registration columns:', gCols.rows.map(r => r.column_name));
    const gRows = await client.query('SELECT * FROM public.gst_registration');
    console.log('gst_registration rows:', gRows.rows);

    const gstRepo = await client.query("SELECT * FROM public.gst_registration WHERE is_active = true ORDER BY state_code, created_at");
    console.log('Active gst registrations:', gstRepo.rows);

  } finally {
    await client.end();
  }
}

run().catch(console.error);
