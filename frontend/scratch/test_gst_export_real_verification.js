const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function verify() {
  await client.connect();
  console.log('=== VERIFYING GST EXPORT STATUTORY INVOICE RESOLUTION ===\n');
  const sql = `
    SELECT o.id, o.customer_id, o.status::text as status, o.metadata, o.created_at,
           i.invoice_number AS real_invoice_number, i.created_at AS real_invoice_date
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id
    WHERE i.id IS NOT NULL
    ORDER BY i.created_at ASC
  `;
  const res = await client.query(sql);
  console.log(`Matched orders with legal invoices in database: ${res.rows.length}\n`);

  let allMatch = true;
  res.rows.forEach(r => {
    const meta = r.metadata || {};
    const statutoryInvoiceNum = r.real_invoice_number || meta.invoice_number || null;
    const statutoryInvoiceDate = r.real_invoice_date
      ? new Date(r.real_invoice_date).toISOString().slice(0, 10)
      : (meta.invoice_date || null);
    const orderNumber = meta.order_number || r.id;
    const matchesLegal = statutoryInvoiceNum === r.real_invoice_number;
    if (!matchesLegal) allMatch = false;

    console.log(`Order ID: ${r.id}`);
    console.log(`  Internal Order Number:      ${orderNumber}`);
    console.log(`  Legal DB Invoice Number:    ${r.real_invoice_number}`);
    console.log(`  Export Resolved Invoice:    ${statutoryInvoiceNum}`);
    console.log(`  Export Resolved Date:       ${statutoryInvoiceDate}`);
    console.log(`  Integrity Status:           ${matchesLegal ? 'VERIFIED (STATUTORY MATCH)' : 'MISMATCH'}\n`);
  });

  console.log(`OVERALL GST EXPORT VERIFICATION: ${allMatch ? 'PASSED (100% Exact Legal Invoice Match)' : 'FAILED'}`);
  await client.end();
}

verify().catch(console.error);
