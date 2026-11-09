const { Client } = require("../frontend/node_modules/pg");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function auditTestDbWrites() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("=== AUDIT OF TEST DATABASE WRITES ===");

    // 1. Products
    const prods = await client.query(
      `SELECT id, title, created_at FROM public.product 
       WHERE id LIKE '%test%' OR id LIKE '%tax%' OR title LIKE '%Test%' ORDER BY created_at DESC LIMIT 20`
    );
    console.log(`\n1. Test Products Found: ${prods.rows.length}`);
    prods.rows.forEach(r => console.log(`   - [${r.id}] "${r.title}" (created: ${r.created_at})`));

    // 2. Tax Rate Rules
    const rules = await client.query(
      `SELECT id, tax_rate_id, reference, reference_id, created_at, deleted_at FROM public.tax_rate_rule 
       WHERE reference_id LIKE '%test%' OR id LIKE '%test%' OR id LIKE 'txrr_%' ORDER BY created_at DESC LIMIT 20`
    );
    console.log(`\n2. Test Tax Rate Rules Found: ${rules.rows.length}`);
    rules.rows.forEach(r => console.log(`   - [${r.id}] ref=${r.reference}:${r.reference_id} -> tax_rate=${r.tax_rate_id} (deleted: ${r.deleted_at})`));

    // 3. Orders
    const orders = await client.query(
      `SELECT id, display_id, created_at FROM public.order 
       WHERE id LIKE '%test%' OR id LIKE 'ord_test%' ORDER BY created_at DESC LIMIT 20`
    );
    console.log(`\n3. Test Orders Found: ${orders.rows.length}`);
    orders.rows.forEach(r => console.log(`   - [${r.id}] display=${r.display_id} (created: ${r.created_at})`));

    // 4. Invoices / Vouchers
    const vouchers = await client.query(
      `SELECT id, voucher_type, reference_type, reference_id, total_amount, status, created_at 
       FROM public.accounting_voucher 
       WHERE reference_id LIKE '%test%' OR id LIKE 'vch_00MVC83%'
       ORDER BY created_at DESC LIMIT 20`
    );
    console.log(`\n4. Test Vouchers Found: ${vouchers.rows.length}`);
    vouchers.rows.forEach(r => console.log(`   - [${r.id}] (${r.voucher_type}/${r.status}) ref=${r.reference_type}:${r.reference_id} total=${r.total_amount} (created: ${r.created_at})`));

    // 5. Invoices
    const invoices = await client.query(
      `SELECT id, invoice_number, invoice_type, reference_id, created_at 
       FROM public.invoice 
       WHERE reference_id LIKE '%test%' OR id LIKE '%test%'
       ORDER BY created_at DESC LIMIT 20`
    );
    console.log(`\n5. Test Invoices Found: ${invoices.rows.length}`);
    invoices.rows.forEach(r => console.log(`   - [${r.id}] ${r.invoice_number} ref=${r.reference_id}`));

  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    await client.end();
  }
}

auditTestDbWrites();
