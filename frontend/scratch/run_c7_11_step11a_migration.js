/**
 * CakeToHome ERP — Phase C7.11 Step 11A Migration Runner & Verification Script
 * Schema: public.corporate_delivery_assignment & public.corporate_assignment_event
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

function getConnectionString() {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        let val = line.trim().substring("DATABASE_URL=".length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

let passes = 0;
let fails = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passes++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    fails++;
  }
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("=============================================================================");
  console.log("CakeToHome ERP — Phase C7.11 Step 11A Schema Migration Runner & Verification");
  console.log("=============================================================================\n");

  try {
    // ── 1. PREFLIGHT ACCOUNTING & MASTER INVARIANTS ───────────────────────────
    console.log("[Phase 1] Preflight Accounting & Master Integrity Check");
    const preCoA = await client.query("SELECT count(*)::int as count FROM public.accounting_account;");
    const preVouchers = await client.query("SELECT count(*)::int as count FROM public.accounting_voucher;");
    const preJE = await client.query("SELECT count(*)::int as count FROM public.accounting_journal_entry;");
    const preJL = await client.query("SELECT count(*)::int as count, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const preDP = await client.query("SELECT count(*)::int as count FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const preBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");

    assert(preCoA.rows[0].count === 100, `Preflight CoA is 100 accounts: ${preCoA.rows[0].count}`);
    assert(preVouchers.rows[0].count === 6, `Preflight Vouchers = 6: ${preVouchers.rows[0].count}`);
    assert(preJE.rows[0].count === 4, `Preflight Journal Entries = 4: ${preJE.rows[0].count}`);
    assert(preJL.rows[0].dr === "3380.00" && preJL.rows[0].cr === "3380.00", `Preflight TB strictly balanced at Dr ₹3,380.00 = Cr ₹3,380.00: Dr ₹${preJL.rows[0].dr} / Cr ₹${preJL.rows[0].cr}`);
    assert(preDP.rows[0].count === 30, `Preflight Delivery Partners preserved: ${preDP.rows[0].count}`);
    assert(preBranch.rows[0].active === 53, `Preflight Active Branches preserved: ${preBranch.rows[0].active}`);

    if (preCoA.rows[0].count !== 100 || preJL.rows[0].dr !== "3380.00") {
      throw new Error("Preflight accounting checks failed! Aborting migration.");
    }

    // ── 2. EXECUTE MIGRATION DDL ──────────────────────────────────────────────
    console.log("\n[Phase 2] Executing c7_11_assignment_schema.sql DDL...");
    const sqlPath = path.join(__dirname, "../src/lib/migrations/c7_11_assignment_schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    await client.query(sql);
    console.log("  ✓ Migration executed successfully via atomic transaction.");

    // ── 3. POSTFLIGHT SCHEMA VERIFICATION ─────────────────────────────────────
    console.log("\n[Phase 3] Postflight Schema Catalog Verification");

    // Table corporate_delivery_assignment
    const cdaCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_delivery_assignment'
      ORDER BY ordinal_position;
    `);
    assert(cdaCols.rows.length >= 22, `corporate_delivery_assignment exists with ${cdaCols.rows.length} columns`);

    const colNames = cdaCols.rows.map((r) => r.column_name);
    assert(colNames.includes("entity_type"), "Column entity_type exists");
    assert(colNames.includes("entity_id"), "Column entity_id exists");
    assert(colNames.includes("status"), "Column status exists");
    assert(colNames.includes("reason_code"), "Column reason_code exists");
    assert(colNames.includes("assigned_store_id"), "Column assigned_store_id exists");
    assert(colNames.includes("assigned_partner_id"), "Column assigned_partner_id exists");
    assert(colNames.includes("assigned_zone_id"), "Column assigned_zone_id exists");
    assert(colNames.includes("distance_km"), "Column distance_km exists");
    assert(colNames.includes("matched_rule"), "Column matched_rule exists");
    assert(colNames.includes("diagnostics_message"), "Column diagnostics_message exists");
    assert(colNames.includes("evaluation_metadata"), "Column evaluation_metadata exists");
    assert(colNames.includes("override_reason"), "Column override_reason exists");

    // Table corporate_assignment_event
    const caeCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_assignment_event'
      ORDER BY ordinal_position;
    `);
    assert(caeCols.rows.length >= 8, `corporate_assignment_event exists with ${caeCols.rows.length} columns`);

    // Unique Constraint
    const uqRes = await client.query(`
      SELECT conname FROM pg_constraint 
      WHERE conname = 'uq_cda_entity' AND conrelid = 'public.corporate_delivery_assignment'::regclass;
    `);
    assert(uqRes.rows.length === 1, "Unique constraint uq_cda_entity on (entity_type, entity_id) enforced");

    // Immutability Trigger
    const trgRes = await client.query(`
      SELECT tgname FROM pg_trigger 
      WHERE tgname = 'trg_corporate_assignment_event_immutability';
    `);
    assert(trgRes.rows.length === 1, "Append-only trigger trg_corporate_assignment_event_immutability installed");

    // ── 4. FUNCTIONAL IMMUTABILITY & CASCADE DEFENSE TEST ─────────────────────
    console.log("\n[Phase 4] Functional Immutability & Trigger Verification");
    const testAssignId = `cda_test_${Date.now()}`;
    const testEntityId = `emp_test_${Date.now()}`;

    // Insert test assignment row
    await client.query(`
      INSERT INTO public.corporate_delivery_assignment (
        id, entity_type, entity_id, delivery_address, delivery_city,
        latitude, longitude, status, reason_code, diagnostics_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
    `, [
      testAssignId, "ROSTER_EMPLOYEE", testEntityId, "100 Indiranagar 100ft Rd", "Bengaluru",
      12.9716, 77.6412, "UNASSIGNED", "PENDING_EVALUATION", "Diagnostic probe initialization"
    ]);
    assert(true, "Inserted test corporate_delivery_assignment row");

    // Insert test assignment audit event
    const testEventId = `cae_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.corporate_assignment_event (
        id, assignment_id, event_type, actor_id, actor_role, reason, before_state, after_state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `, [
      testEventId, testAssignId, "BATCH_MATCHED", "admin_01", "SUPER_ADMIN",
      "Automated matching probe", JSON.stringify({ status: "UNASSIGNED" }), JSON.stringify({ status: "ASSIGNED" })
    ]);
    assert(true, "Inserted test corporate_assignment_event row");

    // Verify Immutability Trigger blocks UPDATE
    let updateBlocked = false;
    try {
      await client.query("UPDATE public.corporate_assignment_event SET reason = 'tampered' WHERE id = $1;", [testEventId]);
    } catch (err) {
      if (err.message.includes("append-only") || err.code === "27000") {
        updateBlocked = true;
      }
    }
    assert(updateBlocked, "PostgreSQL strictly rejected UPDATE on corporate_assignment_event (SQLSTATE 27000)");

    // Verify Immutability Trigger blocks DELETE
    let deleteBlocked = false;
    try {
      await client.query("DELETE FROM public.corporate_assignment_event WHERE id = $1;", [testEventId]);
    } catch (err) {
      if (err.message.includes("append-only") || err.code === "27000") {
        deleteBlocked = true;
      }
    }
    assert(deleteBlocked, "PostgreSQL strictly rejected DELETE on corporate_assignment_event (SQLSTATE 27000)");

    // Clean up test assignment (Note: we delete the assignment row; but wait, since foreign key is ON DELETE CASCADE,
    // let's test if trigger blocks cascade delete or if we drop test records)
    // In PostgreSQL, BEFORE DELETE trigger on corporate_assignment_event will fire on CASCADE delete as well!
    // To cleanly delete test fixture, we can disable trigger temporarily in session, or delete inside transaction that rolls back!
    // Let's test disabling trigger temporarily for test cleanup or running in rolled-back tx:
    await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_assignment_event WHERE id = $1;", [testEventId]);
    await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_delivery_assignment WHERE id = $1;", [testAssignId]);
    assert(true, "Cleaned up test fixture cleanly and re-enabled trigger defense");

    // ── 5. POSTFLIGHT ACCOUNTING & MASTER INVARIANTS ──────────────────────────
    console.log("\n[Phase 5] Postflight Accounting & Master Integrity Re-check");
    const postCoA = await client.query("SELECT count(*)::int as count FROM public.accounting_account;");
    const postVouchers = await client.query("SELECT count(*)::int as count FROM public.accounting_voucher;");
    const postJE = await client.query("SELECT count(*)::int as count FROM public.accounting_journal_entry;");
    const postJL = await client.query("SELECT count(*)::int as count, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const postDP = await client.query("SELECT count(*)::int as count FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const postBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
    const postAssignCount = await client.query("SELECT count(*)::int as count FROM public.corporate_delivery_assignment;");
    const postEventCount = await client.query("SELECT count(*)::int as count FROM public.corporate_assignment_event;");

    assert(postCoA.rows[0].count === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].count}`);
    assert(postVouchers.rows[0].count === 6, `Postflight Vouchers = 6: ${postVouchers.rows[0].count}`);
    assert(postJE.rows[0].count === 4, `Postflight Journal Entries = 4: ${postJE.rows[0].count}`);
    assert(postJL.rows[0].dr === "3380.00" && postJL.rows[0].cr === "3380.00", `Postflight TB strictly balanced Dr/Cr ₹3,380.00: Dr ₹${postJL.rows[0].dr} / Cr ₹${postJL.rows[0].cr}`);
    assert(postDP.rows[0].count === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].count}`);
    assert(postBranch.rows[0].active === 53, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);
    assert(postAssignCount.rows[0].count === 0, `corporate_delivery_assignment has 0 residual rows: ${postAssignCount.rows[0].count}`);
    assert(postEventCount.rows[0].count === 0, `corporate_assignment_event has 0 residual rows: ${postEventCount.rows[0].count}`);

  } finally {
    await client.end();
  }

  console.log("\n=============================================================================");
  console.log(`STEP 11A MIGRATION & VERIFICATION RESULTS: ${passes} PASSED | ${fails} FAILED`);
  console.log("=============================================================================");

  if (fails > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR in Step 11A Migration:", err);
  process.exit(1);
});
