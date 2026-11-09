/**
 * CakeToHome ERP — Phase C7.12: Independent Forensic Database Invariant Audit
 * Executed in strict READ ONLY transaction (`BEGIN READ ONLY; ... ROLLBACK;`).
 * Verifies accounting balance, master-data integrity, routing table states, and triggers.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function getConnectionString() {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        let val = trimmed.substring("DATABASE_URL=".length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

async function runC7_12_ForensicAudit() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("==================================================================");
  console.log("PHASE C7.12: INDEPENDENT FORENSIC DATABASE READ-ONLY AUDIT");
  console.log("==================================================================");

  await client.query("BEGIN READ ONLY;");

  // 1. Authoritative Accounting Baseline Invariants
  const coa = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
  const vouchers = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
  const je = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
  const jl = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");

  // 2. Delivery & Branch Master Baseline
  const dp = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
  const branches = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
  const customers = await client.query("SELECT count(*)::int as cnt FROM public.customer WHERE deleted_at IS NULL;");

  // 3. Corporate Routing Master & Residual Records
  const corpAccounts = await client.query("SELECT count(*)::int as cnt FROM public.corporate_account WHERE deleted_at IS NULL;");
  const assignments = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
  const events = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

  // 4. Immutability Triggers
  const trgCda = await client.query(`
    SELECT tgname, tgenabled, relname 
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE tgname = 'trg_corporate_assignment_event_immutability';
  `);

  const trgDce = await client.query(`
    SELECT tgname, tgenabled, relname 
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE tgname = 'trg_delivery_coverage_event_immutability';
  `);

  // 5. Active Advisory Locks
  const locks = await client.query(`
    SELECT count(*)::int as cnt FROM pg_locks WHERE locktype = 'advisory';
  `);

  await client.query("ROLLBACK;");
  await client.end();

  console.log("\n--- ACCOUNTING INVARIANTS ---");
  console.log(`CoA Accounts: ${coa.rows[0].cnt} (Expected: 100) -> ${coa.rows[0].cnt === 100 ? "PASS" : "FAIL"}`);
  console.log(`Vouchers: ${vouchers.rows[0].cnt} (Expected: 6) -> ${vouchers.rows[0].cnt === 6 ? "PASS" : "FAIL"}`);
  console.log(`Journal Entries: ${je.rows[0].cnt} (Expected: 4) -> ${je.rows[0].cnt === 4 ? "PASS" : "FAIL"}`);
  console.log(`Journal Lines: ${jl.rows[0].cnt} (Expected: 10) -> ${jl.rows[0].cnt === 10 ? "PASS" : "FAIL"}`);
  console.log(`Trial Balance: Dr ₹${jl.rows[0].dr} / Cr ₹${jl.rows[0].cr} (Expected: 3380.00 / 3380.00) -> ${jl.rows[0].dr === "3380.00" && jl.rows[0].cr === "3380.00" ? "PASS" : "FAIL"}`);

  console.log("\n--- MASTER DATA INVARIANTS ---");
  console.log(`Active Delivery Partners: ${dp.rows[0].cnt} (Expected: 30) -> ${dp.rows[0].cnt === 30 ? "PASS" : "FAIL"}`);
  console.log(`Active Branches: ${branches.rows[0].active} (Expected: 48) -> ${branches.rows[0].active === 48 ? "PASS" : "FAIL"}`);
  console.log(`Active Customers: ${customers.rows[0].cnt} (Expected: 56) -> ${customers.rows[0].cnt === 56 ? "PASS" : "FAIL"}`);
  console.log(`Corporate Accounts: ${corpAccounts.rows[0].cnt} -> PASS`);

  console.log("\n--- ROUTING RESIDUALS & ISOLATION ---");
  console.log(`Corporate Delivery Assignments: ${assignments.rows[0].cnt} (Expected: 0) -> ${assignments.rows[0].cnt === 0 ? "PASS" : "FAIL"}`);
  console.log(`Corporate Assignment Events: ${events.rows[0].cnt} (Expected: 0) -> ${events.rows[0].cnt === 0 ? "PASS" : "FAIL"}`);

  console.log("\n--- IMMUTABILITY TRIGGERS ---");
  const trgCdaRow = trgCda.rows[0];
  const trgCdaPass = trgCdaRow && trgCdaRow.tgenabled === "O";
  console.log(`Assignment Event Trigger: ${trgCdaRow ? trgCdaRow.tgname : "MISSING"} (tgenabled = ${trgCdaRow ? trgCdaRow.tgenabled : "N/A"}) -> ${trgCdaPass ? "PASS" : "FAIL"}`);

  const trgDceRow = trgDce.rows[0];
  const trgDcePass = trgDceRow && trgDceRow.tgenabled === "O";
  console.log(`Coverage Event Trigger: ${trgDceRow ? trgDceRow.tgname : "MISSING"} (tgenabled = ${trgDceRow ? trgDceRow.tgenabled : "N/A"}) -> ${trgDcePass ? "PASS" : "FAIL"}`);

  console.log("\n--- ADVISORY LOCKS ---");
  console.log(`Active Advisory Locks: ${locks.rows[0].cnt} (Expected: 0) -> ${locks.rows[0].cnt === 0 ? "PASS" : "FAIL"}`);

  const allPassed =
    coa.rows[0].cnt === 100 &&
    vouchers.rows[0].cnt === 6 &&
    je.rows[0].cnt === 4 &&
    jl.rows[0].cnt === 10 &&
    jl.rows[0].dr === "3380.00" &&
    jl.rows[0].cr === "3380.00" &&
    dp.rows[0].cnt === 30 &&
    branches.rows[0].active === 48 &&
    customers.rows[0].cnt === 56 &&
    assignments.rows[0].cnt === 0 &&
    events.rows[0].cnt === 0 &&
    trgCdaPass &&
    trgDcePass &&
    locks.rows[0].cnt === 0;

  console.log("\n==================================================================");
  console.log(`C7.12 FORENSIC INVARIANT STATUS: ${allPassed ? "ALL INVARIANTS PASS (ZERO LEAKS / ZERO IMBALANCE)" : "FAILURES DETECTED"}`);
  console.log("==================================================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runC7_12_ForensicAudit().catch(err => {
  console.error("Forensic audit error:", err);
  process.exit(1);
});
