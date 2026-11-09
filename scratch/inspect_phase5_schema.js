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

const { Client } = require("../frontend/node_modules/pg");

async function run() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("Connected to PostgreSQL successfully.");

  // 1. List all tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log("\n--- PUBLIC TABLES ---");
  const tableNames = tablesRes.rows.map(r => r.table_name);
  console.log(tableNames.join(", "));

  // 2. Filter for invoice, order, payment, purchase, receipt, voucher tables
  const targetTables = tableNames.filter(t => 
    t.includes("invoice") || 
    t.includes("order") || 
    t.includes("payment") || 
    t.includes("purchase") || 
    t.includes("receipt") || 
    t.includes("voucher") || 
    t.includes("journal") || 
    t.includes("ar") || 
    t.includes("ap") || 
    t.includes("bill") || 
    t.includes("supplier") || 
    t.includes("customer") ||
    t.includes("inventory") ||
    t.includes("grn")
  );
  console.log("\n--- TARGET TABLES ---");
  console.log(targetTables.join(", "));

  // 3. Count rows in target tables
  console.log("\n--- ROW COUNTS ---");
  for (const t of targetTables) {
    try {
      const c = await client.query(`SELECT COUNT(*) FROM public."${t}"`);
      console.log(`  ${t}: ${c.rows[0].count}`);
    } catch (err) {
      console.log(`  ${t}: ERROR (${err.message})`);
    }
  }

  // 4. Check schema of invoice table
  if (tableNames.includes("invoice")) {
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invoice'
      ORDER BY ordinal_position;
    `);
    console.log("\n--- INVOICE COLUMNS ---");
    console.log(colRes.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`).join("\n"));
  }

  // 5. Check schema of purchase table if exists, or any purchase related tables
  const purchaseTables = targetTables.filter(t => t.includes("purchase"));
  for (const pt of purchaseTables) {
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${pt}'
      ORDER BY ordinal_position;
    `);
    console.log(`\n--- ${pt.toUpperCase()} COLUMNS ---`);
    console.log(colRes.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`).join("\n"));
  }

  // 6. Inspect recent invoices
  if (tableNames.includes("invoice")) {
    const invRes = await client.query(`
      SELECT id, invoice_number, order_id, customer_id, grand_total, paid_amount, outstanding_amount, status, voucher_id, created_at
      FROM public."invoice"
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    console.log("\n--- RECENT INVOICES (count: " + invRes.rows.length + ") ---");
    console.log(JSON.stringify(invRes.rows, null, 2));
  }

  // 7. Check suppliers
  if (tableNames.includes("supplier")) {
    const supRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'supplier'
      ORDER BY ordinal_position;
    `);
    console.log("\n--- SUPPLIER COLUMNS ---");
    console.log(supRes.rows.map(r => `${r.column_name} (${r.data_type})`).join("\n"));

    const sups = await client.query(`SELECT id, name, gstin FROM public."supplier" LIMIT 5;`);
    console.log("\n--- SUPPLIER RECORDS ---");
    console.log(JSON.stringify(sups.rows, null, 2));
  }

  // 8. Check payment_transaction columns
  if (tableNames.includes("payment_transaction")) {
    const ptCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_transaction'
      ORDER BY ordinal_position;
    `);
    console.log("\n--- PAYMENT_TRANSACTION COLUMNS ---");
    console.log(ptCols.rows.map(r => `${r.column_name} (${r.data_type})`).join("\n"));

    const ptRes = await client.query(`
      SELECT *
      FROM public."payment_transaction"
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    console.log("\n--- RECENT PAYMENT TRANSACTIONS ---");
    console.log(JSON.stringify(ptRes.rows, null, 2));
  }

  // 9. Check accounting_voucher for sales & purchase
  const vchRes = await client.query(`
    SELECT id, voucher_number, voucher_type, total_amount, status, source_event_type, source_event_id, is_posted
    FROM public."accounting_voucher"
    WHERE voucher_type IN ('SALES', 'PURCHASE') OR source_event_type LIKE '%SALES%' OR source_event_type LIKE '%INVOICE%' OR source_event_type LIKE '%PURCHASE%'
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.log("\n--- RECENT SALES / PURCHASE VOUCHERS ---");
  console.log(JSON.stringify(vchRes.rows, null, 2));



  await client.end();
}

run().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
