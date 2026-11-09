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
    const dCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery'");
    console.log('delivery columns:', dCols.rows.map(r => `${r.column_name} (${r.data_type})`));

    const dpCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery_partner'");
    console.log('delivery_partner columns:', dpCols.rows.map(r => `${r.column_name} (${r.data_type})`));

    const sampleD = await client.query("SELECT * FROM public.delivery LIMIT 2");
    console.log('\nsample delivery rows:', sampleD.rows);

    const sampleDP = await client.query("SELECT * FROM public.delivery_partner LIMIT 2");
    console.log('\nsample delivery_partner rows:', sampleDP.rows);

    const orderDlp = await client.query(`
      SELECT id, status, metadata->>'delivery_partner_id' as dlp_id, metadata->>'delivery_status' as d_status 
      FROM public.order 
      WHERE metadata->>'delivery_partner_id' IS NOT NULL 
      LIMIT 5
    `);
    console.log('\nOrders with delivery_partner_id in metadata:', orderDlp.rows);

  } finally {
    await client.end();
  }
}

run().catch(console.error);
