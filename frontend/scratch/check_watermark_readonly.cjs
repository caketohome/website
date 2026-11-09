const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let envFile = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envFile)) envFile = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envFile, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const seq = await client.query(`
    SELECT entity_id, gstin, fiscal_year, prefix, last_seq, updated_at 
    FROM public.invoice_sequence 
    WHERE entity_id = 'CAKETOHOME_PARENT' AND fiscal_year = 2026 AND prefix = 'CTH';
  `);
  console.log('Current invoice_sequence watermark:');
  console.table(seq.rows);

  const queue = await client.query('SELECT status, count(*) FROM public.invoice_generation_queue GROUP BY status;');
  console.log('Current invoice_generation_queue rows:');
  console.table(queue.rows);

  const invCount = await client.query('SELECT count(*) FROM public.invoice;');
  console.log('Total invoices in public.invoice:', invCount.rows[0].count);

  await client.end();
}
run().catch(console.error);
