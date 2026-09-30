/**
 * Independent Database Verification for Phase 4D: Chart of Accounts Seeding
 * Performs comprehensive assertions against the live PostgreSQL database.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== PHASE 4D: INDEPENDENT DATABASE VERIFICATION ===");
  const results = {};
  const failures = [];

  // A. Exact Count
  const countRes = await client.query(`SELECT count(*)::int as cnt FROM public.accounting_account;`);
  results.account_count = countRes.rows[0].cnt;
  if (results.account_count !== 98) {
    failures.push(`Expected exactly 98 accounts, got ${results.account_count}`);
  }

  // B. Unique codes
  const uniqueCodeRes = await client.query(`SELECT count(DISTINCT code)::int as cnt FROM public.accounting_account;`);
  results.unique_codes = uniqueCodeRes.rows[0].cnt;
  if (results.unique_codes !== 98) {
    failures.push(`Duplicate account codes detected! Unique codes: ${results.unique_codes}`);
  }

  // C. Parent integrity (zero orphans)
  const orphanRes = await client.query(`
    SELECT count(*)::int as cnt 
    FROM public.accounting_account 
    WHERE parent_id IS NOT NULL 
      AND parent_id NOT IN (SELECT id FROM public.accounting_account);
  `);
  results.orphaned_parents = orphanRes.rows[0].cnt;
  if (results.orphaned_parents !== 0) {
    failures.push(`Found ${results.orphaned_parents} orphaned parent references!`);
  }

  // D. Hierarchy levels & parent level check
  const hierarchyCheckRes = await client.query(`
    SELECT c.code, c.level as child_level, p.code as parent_code, p.level as parent_level
    FROM public.accounting_account c
    JOIN public.accounting_account p ON c.parent_id = p.id
    WHERE c.level != p.level + 1;
  `);
  results.hierarchy_level_mismatches = hierarchyCheckRes.rows.length;
  if (results.hierarchy_level_mismatches > 0) {
    failures.push(`Found hierarchy level mismatches: ${JSON.stringify(hierarchyCheckRes.rows)}`);
  }

  // Level 1 accounts must have parent_id NULL
  const rootParentRes = await client.query(`
    SELECT code, level, parent_id 
    FROM public.accounting_account 
    WHERE level = 1 AND parent_id IS NOT NULL;
  `);
  results.root_with_parent = rootParentRes.rows.length;
  if (results.root_with_parent > 0) {
    failures.push(`Root accounts have non-null parent_id: ${JSON.stringify(rootParentRes.rows)}`);
  }

  // E. Group vs Posting account rules
  const groupRes = await client.query(`
    SELECT 
      count(*) FILTER (WHERE is_group = true)::int as group_count,
      count(*) FILTER (WHERE is_group = false)::int as posting_count
    FROM public.accounting_account;
  `);
  results.group_accounts = groupRes.rows[0].group_count;
  results.posting_accounts = groupRes.rows[0].posting_count;

  // Parents must be is_group = true
  const parentNotGroupRes = await client.query(`
    SELECT DISTINCT p.code, p.name 
    FROM public.accounting_account c
    JOIN public.accounting_account p ON c.parent_id = p.id
    WHERE p.is_group = false;
  `);
  if (parentNotGroupRes.rows.length > 0) {
    failures.push(`Parent accounts must have is_group=true: ${JSON.stringify(parentNotGroupRes.rows)}`);
  }

  // F. Account Types
  const typeRes = await client.query(`
    SELECT type, count(*)::int as cnt 
    FROM public.accounting_account 
    GROUP BY type 
    ORDER BY type;
  `);
  results.types_breakdown = typeRes.rows;
  const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
  for (const t of typeRes.rows) {
    if (!validTypes.includes(t.type)) {
      failures.push(`Invalid account type: ${t.type}`);
    }
  }

  // G. Account Subtypes
  const subtypeRes = await client.query(`
    SELECT subtype, count(*)::int as cnt 
    FROM public.accounting_account 
    GROUP BY subtype 
    ORDER BY subtype;
  `);
  results.subtypes_breakdown = subtypeRes.rows;

  // H. Required Core & Control Accounts Presence
  const requiredCodes = [
    '1111', '1112', '1113', '1114', '1119', '1121', '1122', '1131', '1132', '1133',
    '1141', '1142', '1143', '1144', '1145', '1146', '1147', '1148', '1149',
    '2111', '2121', '2122', '2123', '2124', '2125', '2126', '2127', '2128', '2129',
    '2130', '2141', '2142', '2151', '2152', '2153', '2510',
    '3110', '3120', '3210', '3220', '3300',
    '4110', '4120', '4130', '4140', '4190', '4210', '4220',
    '5110', '5120', '5130', '5140', '5190', '5210', '5220', '5230', '5240', '5250',
    '5260', '5270', '5280', '5290', '5295', '5299', '5310', '5320', '5330'
  ];

  const presentCodesRes = await client.query(`SELECT code FROM public.accounting_account;`);
  const presentCodeSet = new Set(presentCodesRes.rows.map(r => r.code));
  const missingCodes = requiredCodes.filter(c => !presentCodeSet.has(c));
  if (missingCodes.length > 0) {
    failures.push(`Missing mandatory accounts: ${missingCodes.join(', ')}`);
  }

  // I. Zero Accounting Transactions
  const voucherCount = (await client.query(`SELECT count(*)::int as cnt FROM public.accounting_voucher;`)).rows[0].cnt;
  const journalCount = (await client.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_entry;`)).rows[0].cnt;
  const lineCount = (await client.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_line;`)).rows[0].cnt;
  const periodCount = (await client.query(`SELECT count(*)::int as cnt FROM public.accounting_fiscal_period;`)).rows[0].cnt;

  results.accounting_voucher_count = voucherCount;
  results.accounting_journal_entry_count = journalCount;
  results.accounting_journal_line_count = lineCount;
  results.accounting_fiscal_period_count = periodCount;

  if (voucherCount !== 0) failures.push(`accounting_voucher must be 0, got ${voucherCount}`);
  if (journalCount !== 0) failures.push(`accounting_journal_entry must be 0, got ${journalCount}`);
  if (lineCount !== 0) failures.push(`accounting_journal_line must be 0, got ${lineCount}`);

  // J. Historical Isolation
  const orderCount = (await client.query(`SELECT count(*)::int as cnt FROM public."order";`)).rows[0].cnt;
  const paymentTxnCount = (await client.query(`SELECT count(*)::int as cnt FROM public.payment_transaction;`)).rows[0].cnt;
  results.order_count = orderCount;
  results.payment_transaction_count = paymentTxnCount;

  if (orderCount !== 173) failures.push(`Historical orders mutated! Expected 173, got ${orderCount}`);
  if (paymentTxnCount !== 53) failures.push(`Historical payment transactions mutated! Expected 53, got ${paymentTxnCount}`);

  // K. Purchase Isolation
  const purchaseCount = (await client.query(`SELECT count(*)::int as cnt FROM public.purchase;`)).rows[0].cnt;
  const purchaseItemCount = (await client.query(`SELECT count(*)::int as cnt FROM public.purchase_item;`)).rows[0].cnt;
  const purchasePaymentCount = (await client.query(`SELECT count(*)::int as cnt FROM public.purchase_payment;`)).rows[0].cnt;
  results.purchase_count = purchaseCount;
  results.purchase_item_count = purchaseItemCount;
  results.purchase_payment_count = purchasePaymentCount;

  if (purchaseCount !== 0) failures.push(`purchase table mutated! Expected 0, got ${purchaseCount}`);
  if (purchaseItemCount !== 0) failures.push(`purchase_item table mutated! Expected 0, got ${purchaseItemCount}`);
  if (purchasePaymentCount !== 0) failures.push(`purchase_payment table mutated! Expected 0, got ${purchasePaymentCount}`);

  // L. Expense Isolation
  const expenseCount = (await client.query(`SELECT count(*)::int as cnt FROM public.expense;`)).rows[0].cnt;
  results.expense_count = expenseCount;
  if (expenseCount !== 0) failures.push(`expense table mutated! Expected 0, got ${expenseCount}`);

  // M. Fleet Isolation
  const fleetFuelCount = (await client.query(`SELECT count(*)::int as cnt FROM public.fleet_fuel;`)).rows[0].cnt;
  results.fleet_fuel_count = fleetFuelCount;
  if (fleetFuelCount !== 0) failures.push(`fleet_fuel table mutated! Expected 0, got ${fleetFuelCount}`);

  // N. Inventory Isolation
  const branchInventoryCount = (await client.query(`SELECT count(*)::int as cnt FROM public.branch_inventory;`)).rows[0].cnt;
  results.branch_inventory_count = branchInventoryCount;
  if (branchInventoryCount !== 424) failures.push(`branch_inventory mutated! Expected 424, got ${branchInventoryCount}`);

  // O. Accounting Start Date
  const settingRes = await client.query(`SELECT count(*)::int as cnt FROM public.setting WHERE key = 'accounting_start_date';`);
  results.accounting_start_date_configured = settingRes.rows[0].cnt;
  if (results.accounting_start_date_configured !== 0) {
    failures.push(`accounting_start_date was unexpectedly configured!`);
  }

  console.log("INDEPENDENT VERIFICATION SUMMARY:", JSON.stringify(results, null, 2));

  if (failures.length > 0) {
    console.error("FAILURES DETECTED:", failures);
    process.exit(1);
  } else {
    console.log("ALL 15 INDEPENDENT DATABASE VERIFICATION ASSERTIONS PASSED (100%)!");
  }

  await client.end();
}

run().catch(err => {
  console.error("Verification script error:", err);
  process.exit(1);
});
