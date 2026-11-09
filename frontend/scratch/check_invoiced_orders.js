const fs = require('fs');
const { Client } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function check() {
  await client.connect();
  const orderIds = ['test_ord_verify', 'ord_1790948674384_ca5j', 'ord_1790949006248_szsc', 'ord_1790949088062_8qcl', 'ord_1790949168876_fq8p'];
  const res = await client.query(`
    SELECT id, display_id, metadata->>'order_number' as order_number, metadata->>'invoice_number' as inv_num, status, created_at
    FROM public."order"
    WHERE id = ANY($1::text[])
  `, [orderIds]);
  console.log("Invoiced orders:", res.rows);
  await client.end();
}
check().catch(console.error);
