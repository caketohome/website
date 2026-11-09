/**
 * CakeToHome ERP — Phase C7.11 Step 11D: Comprehensive Forensic Database Verification
 * Run purely inside `BEGIN READ ONLY; ... ROLLBACK;`
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

async function runForensicAudit() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("==================================================================");
  console.log("PHASE C7.11 STEP 11D: FORENSIC POSTGRESQL READ-ONLY AUDIT");
  console.log("==================================================================");

  await client.query("BEGIN READ ONLY;");

  // 1. Accounting Invariants
  const coa = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
  const vouchers = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
  const je = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
  const jl = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");

  // 2. Delivery & Branch Master Baseline
  const dp = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
  const branches = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");

  // 3. Routing Residuals
  const assignments = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
  const events = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

  // 4. Trigger State
  const trigger = await client.query(`
    SELECT tgname, tgenabled, relname 
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE tgname = 'trg_corporate_assignment_event_immutability';
  `);

  // 5. Foreign Key Constraints
  const fks = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_name IN ('corporate_delivery_assignment', 'corporate_assignment_event')
    ORDER BY tc.table_name, kcu.column_name;
  `);

  // 6. Check Constraints
  const checks = await client.query(`
    SELECT conname, relname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    WHERE cl.relname IN ('corporate_delivery_assignment', 'corporate_assignment_event')
      AND c.contype = 'c'
    ORDER BY cl.relname, conname;
  `);

  // 7. Unique Constraints
  const uniques = await client.query(`
    SELECT conname, relname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    WHERE cl.relname IN ('corporate_delivery_assignment', 'corporate_assignment_event')
      AND c.contype = 'u'
    ORDER BY cl.relname, conname;
  `);

  // 8. Advisory Transaction Locks
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
  console.log(`Trial Balance: Dr ₹${jl.rows[0].dr} / Cr ₹${jl.rows[0].cr} -> ${jl.rows[0].dr === "3380.00" && jl.rows[0].cr === "3380.00" ? "PASS" : "FAIL"}`);

  console.log("\n--- MASTER DATA INVARIANTS ---");
  console.log(`Active Delivery Partners: ${dp.rows[0].cnt} (Expected: 30) -> ${dp.rows[0].cnt === 30 ? "PASS" : "FAIL"}`);
  console.log(`Active Branches: ${branches.rows[0].active} (Expected: 53) -> ${branches.rows[0].active === 53 ? "PASS" : "FAIL"}`);

  console.log("\n--- ROUTING RESIDUALS ---");
  console.log(`Corporate Delivery Assignments: ${assignments.rows[0].cnt} (Expected: 0) -> ${assignments.rows[0].cnt === 0 ? "PASS" : "FAIL"}`);
  console.log(`Corporate Assignment Events: ${events.rows[0].cnt} (Expected: 0) -> ${events.rows[0].cnt === 0 ? "PASS" : "FAIL"}`);

  console.log("\n--- IMMUTABILITY TRIGGER ---");
  const trg = trigger.rows[0];
  const trgStatus = trg && trg.tgenabled === "O" ? "PASS" : "FAIL";
  console.log(`Trigger: ${trg ? trg.tgname : "MISSING"} on ${trg ? trg.relname : "N/A"} (tgenabled = ${trg ? trg.tgenabled : "N/A"}) -> ${trgStatus}`);

  console.log("\n--- FOREIGN KEYS ---");
  for (const fk of fks.rows) {
    console.log(`FK: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE ${fk.delete_rule})`);
  }

  console.log("\n--- CHECK CONSTRAINTS ---");
  for (const chk of checks.rows) {
    console.log(`CHECK: ${chk.relname} -> ${chk.conname}: ${chk.def}`);
  }

  console.log("\n--- UNIQUE CONSTRAINTS ---");
  for (const u of uniques.rows) {
    console.log(`UNIQUE: ${u.relname} -> ${u.conname}: ${u.def}`);
  }

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
    branches.rows[0].active === 53 &&
    assignments.rows[0].cnt === 0 &&
    events.rows[0].cnt === 0 &&
    trgStatus === "PASS" &&
    locks.rows[0].cnt === 0;

  console.log("\n==================================================================");
  console.log(`FINAL DATABASE INVARIANT STATUS: ${allPassed ? "ALL INVARIANTS PASS" : "FAILURES DETECTED"}`);
  console.log("==================================================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runForensicAudit().catch(err => {
  console.error("Forensic audit error:", err);
  process.exit(1);
});
