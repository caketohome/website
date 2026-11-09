/**
 * CakeToHome ERP — Phase C7.11 Step 11C: Independent Read-Only PostgreSQL Invariant Audit
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

async function runAudit() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("=== INDEPENDENT POSTGRESQL READ-ONLY AUDIT: PHASE C7.11 STEP 11C ===");

  await client.query("BEGIN READ ONLY;");

  const coa = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
  const vouchers = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
  const je = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
  const jl = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
  const dp = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
  const branches = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
  const assignments = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
  const events = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");
  const triggerCheck = await client.query(`
    SELECT tgname, tgenabled FROM pg_trigger
    WHERE tgname = 'trg_corporate_assignment_event_immutability';
  `);

  await client.query("ROLLBACK;");
  await client.end();

  console.log(`CoA Accounts: ${coa.rows[0].cnt} (Expected: 100)`);
  console.log(`Vouchers: ${vouchers.rows[0].cnt} (Expected: 6)`);
  console.log(`Journal Entries: ${je.rows[0].cnt} (Expected: 4)`);
  console.log(`Journal Lines: ${jl.rows[0].cnt} (Expected: 10)`);
  console.log(`Trial Balance: Dr ₹${jl.rows[0].dr} / Cr ₹${jl.rows[0].cr} (Expected: ₹3,380.00 / ₹3,380.00)`);
  console.log(`Active Delivery Partners: ${dp.rows[0].cnt} (Expected: 30)`);
  console.log(`Active Branches: ${branches.rows[0].active} (Expected: 53)`);
  console.log(`Corporate Delivery Assignments: ${assignments.rows[0].cnt} (Expected: 0 residual)`);
  console.log(`Corporate Assignment Events: ${events.rows[0].cnt} (Expected: 0 residual)`);
  console.log(`Immutability Trigger: ${triggerCheck.rows[0]?.tgname} (Enabled: ${triggerCheck.rows[0]?.tgenabled === 'O' ? 'YES' : triggerCheck.rows[0]?.tgenabled})`);
}

runAudit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
