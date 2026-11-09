const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const { Pool } = require(path.resolve(__dirname, "../node_modules/pg"));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function inspectBatchC() {
  const client = await pool.connect();
  try {
    console.log("=== BATCH C READ-ONLY DATABASE BASELINE INSPECTION ===");
    
    // Check tables presence
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'company', 'gst_registration', 'branch', 'setting',
          'bill', 'bills_payable', 'vendor_bill', 'purchase', 'purchase_order', 'purchase_invoice', 'purchase_item',
          'branch_cash_account', 'petty_cash', 'teller_session', 'teller_movement', 'bank_deposit_slip',
          'marketplace_partner', 'marketplace_order', 'marketplace_invoice', 'marketplace_reconciliation',
          'accounting_voucher', 'accounting_journal_entry', 'invoice_sequence', 'order_sequence', 'invoice', '"order"'
        )
      ORDER BY table_name;
    `;
    const tablesRes = await client.query(tableQuery);
    console.log("\nFound relevant tables:");
    for (const row of tablesRes.rows) {
      try {
        const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM public."${row.table_name}"`);
        console.log(`  - ${row.table_name}: ${countRes.rows[0].count} rows`);
      } catch (err) {
        console.log(`  - ${row.table_name}: query failed (${err.message})`);
      }
    }

    // Inspect company table specifically
    try {
      const compRes = await client.query(`SELECT id, legal_name, trade_name, state_code, pan, is_active FROM public.company LIMIT 5`);
      console.log("\nCompany Rows:", compRes.rows);
    } catch (e) {
      console.log("\nCompany query:", e.message);
    }

    // Inspect marketplace partners
    try {
      const mpCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'marketplace_partner'");
      console.log("\nMarketplace Partner Columns:", mpCols.rows.map(r => r.column_name));
      const mpRes = await client.query(`SELECT * FROM public.marketplace_partner LIMIT 10`);
      console.log("Marketplace Partner Rows:", mpRes.rows);
    } catch (e) {
      console.log("\nMarketplace query error:", e.message);
    }

    // Inspect accounting vouchers
    try {
      const avCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounting_voucher'");
      console.log("\nAccounting Voucher Columns:", avCols.rows.map(r => r.column_name));
      const vRes = await client.query(`SELECT * FROM public.accounting_voucher LIMIT 2`);
      console.log("Accounting Vouchers sample:", vRes.rows);
    } catch (e) {
      console.log("\nAccounting voucher query error:", e.message);
    }

    // Inspect Settings
    try {
      const setRes = await client.query(`SELECT * FROM public.setting LIMIT 10`);
      console.log("\nSetting Rows:", setRes.rows);
    } catch (e) {
      console.log("\nSetting query:", e.message);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

inspectBatchC().catch((e) => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});
