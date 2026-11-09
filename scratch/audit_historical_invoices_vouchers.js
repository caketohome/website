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

  console.log("================================================================================");
  console.log("HISTORICAL INVOICES, VOUCHERS, AND LEDGER BALANCES AUDIT");
  console.log("================================================================================");

  // 1. Audit all invoices in public.invoice
  const invRes = await client.query(`
    SELECT id, invoice_number, order_id, branch_id, customer_id, customer_name,
           subtotal, tax_total, delivery_fee, discount_total, grand_total,
           paid_amount, outstanding_amount, status, voucher_id, is_corporate, created_at, metadata
    FROM public."invoice"
    ORDER BY created_at ASC;
  `);

  console.log(`\n--- ALL INVOICES IN DB (Total: ${invRes.rows.length}) ---`);
  for (const inv of invRes.rows) {
    const isLedgerEligible = inv.metadata?.is_ledger_eligible === true;
    const isLegacy = inv.metadata?.legacy_prototype === true;
    console.log(`Invoice: ${inv.invoice_number} (${inv.id}) | Order: ${inv.order_id} | Total: ₹${inv.grand_total} | Paid: ₹${inv.paid_amount} | O/S: ₹${inv.outstanding_amount} | Status: ${inv.status} | Voucher: ${inv.voucher_id || 'NONE'} | Eligible: ${isLedgerEligible} | Legacy: ${isLegacy}`);
  }

  // 2. Audit SoD test vouchers: vch_00MUR19MJGEZP9JC and vch_00MUR1BRX9F9X7J8
  console.log("\n--- HISTORICAL AR VOUCHERS AUDIT ---");
  const sodVouchers = await client.query(`
    SELECT v.id, v.voucher_no, v.voucher_type, v.total_amount, v.status, v.reference_type, v.reference_id, v.created_at, v.metadata
    FROM public."accounting_voucher" v
    WHERE v.id IN ('vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8');
  `);
  console.log(`Found ${sodVouchers.rows.length} SoD vouchers:`);
  for (const v of sodVouchers.rows) {
    console.log(`  ID: ${v.id} | No: ${v.voucher_no} | Type: ${v.voucher_type} | Amt: ₹${v.total_amount} | Status: ${v.status} | Ref: ${v.reference_type} (${v.reference_id})`);
  }

  // Check their journal lines
  if (sodVouchers.rows.length > 0) {
    const vIds = sodVouchers.rows.map(v => v.id);
    const jlRes = await client.query(`
      SELECT jl.id, jl.account_id, acc.code, acc.name, jl.debit_amount, jl.credit_amount, jl.customer_id, jl.narration
      FROM public."accounting_journal_line" jl
      JOIN public."accounting_journal_entry" je ON je.id = jl.journal_entry_id
      JOIN public."accounting_account" acc ON acc.id = jl.account_id
      WHERE je.voucher_id = ANY($1)
      ORDER BY jl.id;
    `, [vIds]);
    console.log(`  Journal Lines for SoD vouchers (${jlRes.rows.length}):`);
    for (const l of jlRes.rows) {
      console.log(`    Line ${l.id} | Acc: ${l.code} (${l.name}) | Dr: ₹${l.debit_amount} | Cr: ₹${l.credit_amount} | Cust: ${l.customer_id || 'NULL'} | Narr: ${l.narration}`);
    }
  }

  // 3. Audit expense vouchers: VCH-EXPENSE-FY2026-27-20261005-3TTZ8T and VCH-EXPENSE-FY2026-27-20261005-23MZ39
  console.log("\n--- HISTORICAL EXPENSE VOUCHERS AUDIT ---");
  const expVouchers = await client.query(`
    SELECT v.id, v.voucher_no, v.voucher_type, v.total_amount, v.status, v.reference_type, v.reference_id, v.created_at
    FROM public."accounting_voucher" v
    WHERE v.voucher_no IN ('VCH-EXPENSE-FY2026-27-20261005-3TTZ8T', 'VCH-EXPENSE-FY2026-27-20261005-23MZ39');
  `);
  console.log(`Found ${expVouchers.rows.length} expense vouchers:`);
  for (const v of expVouchers.rows) {
    console.log(`  ID: ${v.id} | No: ${v.voucher_no} | Type: ${v.voucher_type} | Amt: ₹${v.total_amount} | Status: ${v.status}`);
  }



  // 4. Audit Key Account Balances: 1111 (Cash), 1114 (Petty Cash), 1121 (Trade AR), 1122 (Undeposited COD), 2111 (AP)
  console.log("\n--- KEY GL ACCOUNT BALANCES ---");
  const glBalances = await client.query(`
    SELECT acc.code, acc.name, 
           COALESCE(SUM(jl.debit_amount), 0) AS total_debit,
           COALESCE(SUM(jl.credit_amount), 0) AS total_credit,
           COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS net_balance
    FROM public."accounting_account" acc
    LEFT JOIN public."accounting_journal_line" jl ON jl.account_id = acc.id
    LEFT JOIN public."accounting_journal_entry" je ON je.id = jl.journal_entry_id
    LEFT JOIN public."accounting_voucher" v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE acc.code IN ('1111', '1112', '1113', '1114', '1121', '1122', '2111', '4110', '4120', '4130')
    GROUP BY acc.code, acc.name
    ORDER BY acc.code;
  `);
  for (const b of glBalances.rows) {
    console.log(`  Account ${b.code} (${b.name}): Dr ₹${b.total_debit} | Cr ₹${b.total_credit} | Net: ₹${b.net_balance}`);
  }

  // 5. Audit Undeposited COD (1122) and Petty Cash (1114) source lines
  console.log("\n--- LINES POSTED TO 1122 (Undeposited COD) ---");
  const codLines = await client.query(`
    SELECT v.voucher_no, v.voucher_type, v.voucher_date, jl.debit_amount, jl.credit_amount, jl.narration
    FROM public."accounting_journal_line" jl
    JOIN public."accounting_journal_entry" je ON je.id = jl.journal_entry_id
    JOIN public."accounting_voucher" v ON v.id = je.voucher_id
    JOIN public."accounting_account" acc ON acc.id = jl.account_id
    WHERE acc.code = '1122'
    ORDER BY v.voucher_date ASC, jl.id ASC;
  `);
  for (const l of codLines.rows) {
    console.log(`  Voucher: ${l.voucher_no} (${l.voucher_type}) | Date: ${l.voucher_date} | Dr: ₹${l.debit_amount} | Cr: ₹${l.credit_amount} | Narr: ${l.narration}`);
  }

  console.log("\n--- LINES POSTED TO 1114 (Petty Cash) ---");
  const pcLines = await client.query(`
    SELECT v.voucher_no, v.voucher_type, v.voucher_date, jl.debit_amount, jl.credit_amount, jl.narration
    FROM public."accounting_journal_line" jl
    JOIN public."accounting_journal_entry" je ON je.id = jl.journal_entry_id
    JOIN public."accounting_voucher" v ON v.id = je.voucher_id
    JOIN public."accounting_account" acc ON acc.id = jl.account_id
    WHERE acc.code = '1114'
    ORDER BY v.voucher_date ASC, jl.id ASC;
  `);
  for (const l of pcLines.rows) {
    console.log(`  Voucher: ${l.voucher_no} (${l.voucher_type}) | Date: ${l.voucher_date} | Dr: ₹${l.debit_amount} | Cr: ₹${l.credit_amount} | Narr: ${l.narration}`);
  }

  await client.end();
}

run().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
