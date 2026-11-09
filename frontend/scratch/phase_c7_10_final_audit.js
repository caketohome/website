/**
 * CakeToHome ERP — Phase C7.10 Final Forensic Baseline Audit Script
 * Verifies all 5 approved design decisions (D1-D5 Option A), safeguards, and accounting invariants.
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, "../.env"), "utf8");
  for (const line of envContent.split("\n")) {
    if (line.trim().startsWith("DATABASE_URL=")) {
      let val = line.trim().substring("DATABASE_URL=".length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
});

async function runAudit() {
  const client = await pool.connect();
  console.log("==================================================================");
  console.log("   CAKETOHOME ERP — PHASE C7.10 FINAL FORENSIC AUDIT REPORT       ");
  console.log("==================================================================\n");

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

  try {
    // ── 1. ACCOUNTING & LEDGER INVARIANTS ──────────────────────────────────────
    console.log("[INVARIANT 1] Chart of Accounts & General Ledger Integrity");
    const coaRes = await client.query("SELECT COUNT(*)::int as count FROM public.accounting_account;");
    assert(coaRes.rows[0].count === 100, `CoA is exactly 100 accounts: ${coaRes.rows[0].count}`);

    const voucherRes = await client.query("SELECT COUNT(*)::int as count FROM public.accounting_voucher;");
    assert(voucherRes.rows[0].count === 6, `Accounting Vouchers = 6: ${voucherRes.rows[0].count}`);

    const journalRes = await client.query("SELECT COUNT(*)::int as count FROM public.accounting_journal_entry;");
    assert(journalRes.rows[0].count === 4, `Journal Entries = 4: ${journalRes.rows[0].count}`);

    const journalLineRes = await client.query("SELECT COUNT(*)::int as count FROM public.accounting_journal_line;");
    assert(journalLineRes.rows[0].count === 10, `Journal Lines = 10: ${journalLineRes.rows[0].count}`);

    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(12, 2) as total_debit,
        COALESCE(SUM(credit_amount), 0)::numeric(12, 2) as total_credit,
        (COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0))::numeric(12, 2) as net_diff
      FROM public.accounting_journal_line;
    `);
    const totalDebit = Number(tbRes.rows[0].total_debit);
    const totalCredit = Number(tbRes.rows[0].total_credit);
    const netDiff = Number(tbRes.rows[0].net_diff);
    assert(totalDebit === 3380.00 && totalCredit === 3380.00 && netDiff === 0.00,
      `Trial Balance strictly balanced at Dr ₹${totalDebit.toFixed(2)} = Cr ₹${totalCredit.toFixed(2)} (Net ₹${netDiff.toFixed(2)})`
    );

    // ── 2. DECISION D1: DELIVERY-PARTNER DATA MODEL (OPTION A) ────────────────
    console.log("\n[INVARIANT 2] Decision D1: Delivery-Partner Relational Data Model");
    const partnerRes = await client.query("SELECT COUNT(*)::int as count FROM public.delivery_partner WHERE deleted_at IS NULL;");
    assert(partnerRes.rows[0].count === 30, `All 30 delivery partner records preserved: ${partnerRes.rows[0].count}`);

    const profileTableRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'delivery_partner_profile'
      ORDER BY ordinal_position;
    `);
    assert(profileTableRes.rows.length >= 8, `delivery_partner_profile table exists with ${profileTableRes.rows.length} columns`);

    const coverageTableRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'delivery_partner_coverage'
      ORDER BY ordinal_position;
    `);
    assert(coverageTableRes.rows.length >= 10, `delivery_partner_coverage table exists with ${coverageTableRes.rows.length} columns`);

    // ── 3. DECISION D2: BRANCH COORDINATES & ALLOW-LIST (OPTION A) ─────────────
    console.log("\n[INVARIANT 3] Decision D2: Branch Coordinates & Corporate Routing Allow-List");
    const branchRes = await client.query("SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
    assert(branchRes.rows[0].active === 53, `All 53 active branch records preserved (total ${branchRes.rows[0].total}): active = ${branchRes.rows[0].active}`);

    const eligibilityColRes = await client.query(`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'branch' AND column_name = 'is_corporate_routing_eligible';
    `);
    assert(eligibilityColRes.rows.length === 1, "is_corporate_routing_eligible column exists on public.branch");
    assert(eligibilityColRes.rows[0].column_default.includes("false"), `is_corporate_routing_eligible defaults to false: ${eligibilityColRes.rows[0].column_default}`);

    const blrClusterRes = await client.query(`
      SELECT COUNT(*)::int as count FROM public.branch 
      WHERE latitude = 12.9716 AND longitude = 77.6412;
    `);
    assert(blrClusterRes.rows[0].count === 29, `Historical branch coordinates untouched (29 branches at 12.9716, 77.6412 preserved): ${blrClusterRes.rows[0].count}`);

    // ── 4. DECISION D3: SPATIAL STORAGE & EXCLUSIONS (OPTION A) ───────────────
    console.log("\n[INVARIANT 4] Decision D3: Relational JSONB Spatial Storage & Exclusions");
    const zoneColRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'delivery_zone' 
        AND column_name IN ('polygon_coordinates', 'exclusion_polygons', 'radius_km', 'center_latitude', 'center_longitude');
    `);
    assert(zoneColRes.rows.length === 5, `delivery_zone has all 5 spatial columns (JSONB polygons + exclusions + radius + center): ${zoneColRes.rows.length}/5`);

    // ── 5. DECISION D4: FAIL-CLOSED CORPORATE ROUTING SAFEGUARDS ──────────────
    console.log("\n[INVARIANT 5] Decision D4: Fail-Closed Corporate Routing Service Isolation");
    const immutabilityTriggerRes = await client.query(`
      SELECT tgname, proname 
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE tgname = 'trg_delivery_coverage_event_immutability';
    `);
    assert(immutabilityTriggerRes.rows.length === 1, "Append-only trigger trg_delivery_coverage_event_immutability installed on delivery_coverage_event");

    // Test immutability enforcement on actual row
    let updateBlocked = false;
    let deleteBlocked = false;
    const sampleEvent = await client.query("SELECT id FROM public.delivery_coverage_event LIMIT 1;");
    if (sampleEvent.rows.length > 0) {
      try {
        await client.query("UPDATE public.delivery_coverage_event SET reason = 'tampered' WHERE id = $1;", [sampleEvent.rows[0].id]);
      } catch (err) {
        if (err.message.includes("append-only") || err.code === "27000") {
          updateBlocked = true;
        }
      }
      try {
        await client.query("DELETE FROM public.delivery_coverage_event WHERE id = $1;", [sampleEvent.rows[0].id]);
      } catch (err) {
        if (err.message.includes("append-only") || err.code === "27000") {
          deleteBlocked = true;
        }
      }
    }
    assert(updateBlocked, "PostgreSQL strictly rejected UPDATE on delivery_coverage_event via SQL trigger (SQLSTATE 27000)");
    assert(deleteBlocked, "PostgreSQL strictly rejected DELETE on delivery_coverage_event via SQL trigger (SQLSTATE 27000)");

    // ── 6. DECISION D5: CORPORATE ACCOUNT BOUNDARY (OPTION A) ─────────────────
    console.log("\n[INVARIANT 6] Decision D5: Corporate Accounts Kept Unseeded");
    const corpAccRes = await client.query("SELECT COUNT(*)::int as count FROM public.corporate_account;");
    assert(corpAccRes.rows[0].count === 0, `corporate_account is unseeded (0 rows): ${corpAccRes.rows[0].count}`);

    const corpEmpRes = await client.query("SELECT COUNT(*)::int as count FROM public.corporate_employee;");
    assert(corpEmpRes.rows[0].count === 0, `corporate_employee is unseeded (0 rows): ${corpEmpRes.rows[0].count}`);

    // ── 7. PERMISSION CATALOG REGISTRATION ────────────────────────────────────
    console.log("\n[INVARIANT 7] Permission Catalog Registration");
    const staffAccessFile = fs.readFileSync(path.join(__dirname, "../src/lib/staff-access-control.ts"), "utf8");
    const hasViewPerm = staffAccessFile.includes('"DELIVERY_COVERAGE.VIEW"');
    const hasManagePerm = staffAccessFile.includes('"DELIVERY_COVERAGE.MANAGE"');
    assert(hasViewPerm, "DELIVERY_COVERAGE.VIEW registered in PERMISSION_CATALOG");
    assert(hasManagePerm, "DELIVERY_COVERAGE.MANAGE registered in PERMISSION_CATALOG");

  } finally {
    client.release();
    await pool.end();
  }

  console.log("\n==================================================================");
  console.log(`   FINAL AUDIT SUMMARY: ${passes} PASSED | ${fails} FAILED         `);
  console.log("==================================================================");

  if (fails > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
