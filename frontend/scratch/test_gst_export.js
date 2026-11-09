const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function checkGstExportBehavior() {
  await client.connect();
  console.log("=== CHECKING GST EXPORT INVOICE NUMBER ACCURACY ===\n");

  // Query actual invoices from public.invoice
  const actualInvoices = await client.query(`
    SELECT i.invoice_number, i.created_at, i.order_id, i.customer_name, i.grand_total,
           o.metadata->>'order_number' as order_number, o.created_at as order_created_at
    FROM public.invoice i
    JOIN public."order" o ON o.id = i.order_id
    ORDER BY i.created_at ASC;
  `);

  console.log("1. Actual Invoices in Database (public.invoice):");
  actualInvoices.rows.forEach(r => {
    console.log(`  Invoice: ${r.invoice_number} | Inv Date: ${r.created_at.toISOString().slice(0, 10)} | Order: ${r.order_number} (${r.order_id})`);
  });

  // Check what report.repository.ts getOrderRegister query produces for these orders
  const reportRows = await client.query(`
    SELECT o.id, o.metadata->>'order_number' as meta_order_number, o.metadata->>'invoice_number' as meta_inv_number,
           o.created_at, i.invoice_number as real_inv_number, i.created_at as real_inv_date
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id
    WHERE i.id IS NOT NULL;
  `);

  console.log("\n2. Comparison of Order Data vs Invoice Data:");
  reportRows.rows.forEach(r => {
    console.log(`  Order: ${r.id}`);
    console.log(`    meta_order_number: ${r.meta_order_number}`);
    console.log(`    meta_inv_number:   ${r.meta_inv_number}`);
    console.log(`    real_inv_number:   ${r.real_inv_number}`);
    console.log(`    real_inv_date:     ${r.real_inv_date ? r.real_inv_date.toISOString().slice(0, 10) : 'NULL'}`);
  });

  await client.end();
}

checkGstExportBehavior().catch(console.error);
