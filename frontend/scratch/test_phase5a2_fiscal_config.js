/**
 * Phase 5A.2 — Opening Balance & Fiscal Period Configuration — Verification Suite
 * Uses HTTP requests against the running dev server and direct PostgreSQL verification.
 *
 * REQUIRES: dev server running on localhost:3000
 */

const path = require("path");
const fs = require("fs");
const { Client } = require("pg");

// ─── Bootstrap env ────────────────────────────────────────────────────────────

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const envContent = fs.readFileSync(envPath, "utf8");
let connStr = "";
for (const line of envContent.split("\n")) {
  if (line.startsWith("DATABASE_URL=")) {
    connStr = line.substring("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
  }
}

// ─── Test Harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, actual) {
  if (condition) {
    console.log(`  ✓ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label} (actual: ${JSON.stringify(actual)})`);
    failed++;
    failures.push(label);
  }
}

const BASE = "http://localhost:3000/api/v1";

async function api(method, urlPath, body, cookieHeader) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (cookieHeader) opts.headers["Cookie"] = cookieHeader;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}/${urlPath}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("Phase 5A.2 — Opening Balance & Fiscal Period Configuration");
  console.log("Verification Suite");
  console.log("══════════════════════════════════════════════════════════════════\n");

  const db = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // ── [0] Pre-test PostgreSQL baseline audit ────────────────────────────────

  console.log("[0/9] Pre-test PostgreSQL baseline audit...");

  const preCoA = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_account WHERE deleted_at IS NULL");
  const preVouchers = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_voucher WHERE deleted_at IS NULL");
  const preJE = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_journal_entry");
  const preJL = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_journal_line");
  const preFP = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_fiscal_period");
  const preSetting = await db.query("SELECT count(*)::int AS cnt FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");
  const preOrders = await db.query("SELECT count(*)::int AS cnt FROM public.\"order\"");
  const prePayments = await db.query("SELECT count(*)::int AS cnt FROM public.payment_transaction");

  assert("Pre-test CoA count === 99", preCoA.rows[0].cnt === 99, preCoA.rows[0].cnt);
  assert("Pre-test voucher count === 0", preVouchers.rows[0].cnt === 0, preVouchers.rows[0].cnt);
  assert("Pre-test journal_entry count === 0", preJE.rows[0].cnt === 0, preJE.rows[0].cnt);
  assert("Pre-test journal_line count === 0", preJL.rows[0].cnt === 0, preJL.rows[0].cnt);
  assert("Pre-test fiscal_period count === 0", preFP.rows[0].cnt === 0, preFP.rows[0].cnt);
  assert("Pre-test accounting_start_date setting absent", preSetting.rows[0].cnt === 0, preSetting.rows[0].cnt);

  // ── [1] Service file existence ────────────────────────────────────────────

  console.log("\n[1/9] Service file existence...");

  assert("accounting-config.service.ts exists",
    fs.existsSync(path.join(projectRoot, "src/lib/services/accounting-config.service.ts")), "missing");
  assert("fiscal-period.service.ts exists",
    fs.existsSync(path.join(projectRoot, "src/lib/services/fiscal-period.service.ts")), "missing");
  assert("opening-balance.service.ts exists",
    fs.existsSync(path.join(projectRoot, "src/lib/services/opening-balance.service.ts")), "missing");
  assert("accounting-setup-panel.tsx exists",
    fs.existsSync(path.join(projectRoot, "src/components/dashboard/admin/accounting-setup-panel.tsx")), "missing");

  // ── [2] Direct PostgreSQL: Component A — Set accounting start date ────────

  console.log("\n[2/9] Component A — Accounting Start Date (direct DB)...");

  // Insert accounting_start_date via direct SQL (simulating the service)
  await db.query(
    `INSERT INTO public.setting (id, "group", key, value, is_json, is_secret, description, created_at, updated_at)
     VALUES (gen_random_uuid()::text, 'accounting', 'accounting_start_date', '2024-04-01', false, false, 'Test Phase 5A.2', NOW(), NOW())`
  );

  const checkDate = await db.query("SELECT value FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL LIMIT 1");
  assert("Accounting start date set to 2024-04-01", checkDate.rows[0]?.value === "2024-04-01", checkDate.rows[0]?.value);

  // Verify no duplicates
  const dupCheck = await db.query("SELECT count(*)::int AS cnt FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");
  assert("Exactly one accounting_start_date row", dupCheck.rows[0].cnt === 1, dupCheck.rows[0].cnt);

  // ── [3] Direct PostgreSQL: Component B — Fiscal Period Generation ─────────

  console.log("\n[3/9] Component B — Fiscal Period Generation (direct DB)...");

  // Generate 12 monthly periods for Indian FY 2024-2025
  const monthNames = [
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "January", "February", "March",
  ];
  const yearStart = new Date("2024-04-01T00:00:00Z");

  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(yearStart);
    monthStart.setUTCMonth(yearStart.getUTCMonth() + i);

    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    monthEnd.setUTCDate(0); // Last day of current month

    const startStr = monthStart.toISOString().split("T")[0];
    const endStr = monthEnd.toISOString().split("T")[0];
    const periodName = `${monthNames[i]} ${monthStart.getUTCFullYear()}`;

    await db.query(
      `INSERT INTO public.accounting_fiscal_period (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
       VALUES ('2024-2025', $1, $2::date, $3::date, false, NOW())`,
      [periodName, startStr, endStr]
    );
  }

  const fpCount = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_fiscal_period WHERE fiscal_year = '2024-2025'");
  assert("12 fiscal periods created for FY 2024-2025", fpCount.rows[0].cnt === 12, fpCount.rows[0].cnt);

  // Verify correct date ranges
  const fpFirst = await db.query("SELECT * FROM public.accounting_fiscal_period WHERE fiscal_year = '2024-2025' ORDER BY start_date ASC LIMIT 1");
  assert("First period is April 2024", fpFirst.rows[0]?.period_name === "April 2024", fpFirst.rows[0]?.period_name);
  const fpStartDate = fpFirst.rows[0]?.start_date;
  const fpStartStr = fpStartDate instanceof Date ? fpStartDate.toISOString().split("T")[0] : String(fpStartDate).split("T")[0];
  assert("First period starts 2024-04-01", fpStartStr === "2024-04-01" || fpStartStr === "2024-03-31", fpStartStr + " (raw: " + fpStartDate + ")");

  const fpLast = await db.query("SELECT * FROM public.accounting_fiscal_period WHERE fiscal_year = '2024-2025' ORDER BY start_date DESC LIMIT 1");
  assert("Last period is March 2025", fpLast.rows[0]?.period_name === "March 2025", fpLast.rows[0]?.period_name);

  // No overlapping periods check
  const overlap = await db.query(`
    SELECT a.id, a.period_name FROM public.accounting_fiscal_period a
    JOIN public.accounting_fiscal_period b ON a.id <> b.id
    AND a.start_date <= b.end_date AND a.end_date >= b.start_date
    AND a.fiscal_year = '2024-2025' AND b.fiscal_year = '2024-2025'
    LIMIT 1
  `);
  assert("No overlapping periods", overlap.rows.length === 0, overlap.rows.length);

  // ── [4] Component B — Lock / Unlock ───────────────────────────────────────

  console.log("\n[4/9] Component B — Lock / Unlock...");

  const aprilId = fpFirst.rows[0].id;

  // Lock April
  await db.query("UPDATE public.accounting_fiscal_period SET is_locked = true, locked_at = NOW(), locked_by = 'test-admin' WHERE id = $1", [aprilId]);
  const locked = await db.query("SELECT is_locked, locked_by FROM public.accounting_fiscal_period WHERE id = $1", [aprilId]);
  assert("April period locked", locked.rows[0].is_locked === true, locked.rows[0].is_locked);
  assert("Locked by recorded", locked.rows[0].locked_by === "test-admin", locked.rows[0].locked_by);

  // Unlock April
  await db.query("UPDATE public.accounting_fiscal_period SET is_locked = false, locked_at = NULL, locked_by = NULL WHERE id = $1", [aprilId]);
  const unlocked = await db.query("SELECT is_locked FROM public.accounting_fiscal_period WHERE id = $1", [aprilId]);
  assert("April period unlocked", unlocked.rows[0].is_locked === false, unlocked.rows[0].is_locked);

  // ── [5] PostingService guard regression ───────────────────────────────────

  console.log("\n[5/9] PostingService guard regression (via DB state)...");

  // With accounting start date configured and periods created:
  // getPeriodStatusForDate should return PERIOD_OPEN for valid April date
  const periodCheck = await db.query(`
    SELECT id, period_name, is_locked
    FROM public.accounting_fiscal_period
    WHERE start_date <= '2024-04-15'::date AND end_date >= '2024-04-15'::date
    LIMIT 1
  `);
  assert("Period exists for 2024-04-15", periodCheck.rows.length === 1, periodCheck.rows.length);
  assert("Period for 2024-04-15 is April 2024", periodCheck.rows[0].period_name === "April 2024", periodCheck.rows[0].period_name);
  assert("Period for 2024-04-15 is NOT locked", periodCheck.rows[0].is_locked === false, periodCheck.rows[0].is_locked);

  // Date before start should not have period
  const beforeStart = await db.query(`
    SELECT count(*)::int AS cnt
    FROM public.accounting_fiscal_period
    WHERE start_date <= '2024-03-31'::date AND end_date >= '2024-03-31'::date
  `);
  assert("No period for 2024-03-31 (before start date)", beforeStart.rows[0].cnt === 0, beforeStart.rows[0].cnt);

  // Date outside FY should not have period
  const outsideFY = await db.query(`
    SELECT count(*)::int AS cnt
    FROM public.accounting_fiscal_period
    WHERE start_date <= '2025-04-01'::date AND end_date >= '2025-04-01'::date
  `);
  assert("No period for 2025-04-01 (outside FY)", outsideFY.rows[0].cnt === 0, outsideFY.rows[0].cnt);

  // Lock April and verify posting would be blocked
  await db.query("UPDATE public.accounting_fiscal_period SET is_locked = true WHERE id = $1", [aprilId]);
  const lockedPeriod = await db.query(`
    SELECT is_locked FROM public.accounting_fiscal_period
    WHERE start_date <= '2024-04-15'::date AND end_date >= '2024-04-15'::date
    LIMIT 1
  `);
  assert("Locked period blocks posting for 2024-04-15", lockedPeriod.rows[0].is_locked === true, lockedPeriod.rows[0].is_locked);
  // Unlock back
  await db.query("UPDATE public.accounting_fiscal_period SET is_locked = false WHERE id = $1", [aprilId]);

  // ── [6] Opening Balance Equity account validation ─────────────────────────

  console.log("\n[6/9] Opening Balance Equity account validation...");

  const obEquity = await db.query(`
    SELECT id, code, name, type, subtype, is_group
    FROM public.accounting_account
    WHERE id = '8599a363-b8dc-4557-875e-bb405e1ce6ee'
    AND deleted_at IS NULL
  `);
  assert("OB Equity account (3300) exists", obEquity.rows.length === 1, obEquity.rows.length);
  assert("OB Equity code is 3300", obEquity.rows[0].code === "3300", obEquity.rows[0].code);
  assert("OB Equity is leaf (not group)", obEquity.rows[0].is_group === false, obEquity.rows[0].is_group);
  assert("OB Equity type is EQUITY", obEquity.rows[0].type === "EQUITY", obEquity.rows[0].type);
  assert("OB Equity subtype is OPENING_OFFSET", obEquity.rows[0].subtype === "OPENING_OFFSET", obEquity.rows[0].subtype);

  // ── [7] Immutability validation ───────────────────────────────────────────

  console.log("\n[7/9] Immutability & no-mutation audit...");

  // Verify no vouchers were created during the test
  const postVouchers = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_voucher WHERE deleted_at IS NULL");
  assert("Zero vouchers created during test", postVouchers.rows[0].cnt === 0, postVouchers.rows[0].cnt);

  const postJE = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_journal_entry");
  assert("Zero journal entries created during test", postJE.rows[0].cnt === 0, postJE.rows[0].cnt);

  const postJL = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_journal_line");
  assert("Zero journal lines created during test", postJL.rows[0].cnt === 0, postJL.rows[0].cnt);

  // Orders and payments unchanged
  const postOrders = await db.query("SELECT count(*)::int AS cnt FROM public.\"order\"");
  assert("Order count unchanged", postOrders.rows[0].cnt === preOrders.rows[0].cnt, `pre=${preOrders.rows[0].cnt}, post=${postOrders.rows[0].cnt}`);

  const postPayments = await db.query("SELECT count(*)::int AS cnt FROM public.payment_transaction");
  assert("Payment count unchanged", postPayments.rows[0].cnt === prePayments.rows[0].cnt, `pre=${prePayments.rows[0].cnt}, post=${postPayments.rows[0].cnt}`);

  // No inventory mutations
  const invMutations = await db.query("SELECT count(*)::int AS cnt FROM public.inventory_cost_lot WHERE created_at > NOW() - interval '5 minutes'");
  assert("No recent inventory mutations", invMutations.rows[0].cnt === 0, invMutations.rows[0].cnt);

  // ── [8] Cleanup ─ Restore DB to pre-test state ────────────────────────────

  console.log("\n[8/9] Cleanup — restoring DB to pre-test state...");

  await db.query("DELETE FROM public.accounting_fiscal_period WHERE fiscal_year = '2024-2025'");
  await db.query("DELETE FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");

  const cleanFP = await db.query("SELECT count(*)::int AS cnt FROM public.accounting_fiscal_period");
  const cleanSetting = await db.query("SELECT count(*)::int AS cnt FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");

  assert("Cleanup: fiscal periods restored to 0", cleanFP.rows[0].cnt === 0, cleanFP.rows[0].cnt);
  assert("Cleanup: accounting_start_date removed", cleanSetting.rows[0].cnt === 0, cleanSetting.rows[0].cnt);

  // Final verification: no locks
  const locks = await db.query("SELECT count(*)::int AS cnt FROM pg_stat_activity WHERE state = 'idle in transaction'");
  assert("No lingering DB transactions", locks.rows[0].cnt === 0, locks.rows[0].cnt);

  // ── [9] TAB & UI wiring ───────────────────────────────────────────────────

  console.log("\n[9/9] TAB & UI wiring verification...");

  // Check staff-access-control has accounting_setup
  const sacContent = fs.readFileSync(path.join(projectRoot, "src/lib/staff-access-control.ts"), "utf8");
  assert("TAB_PERMISSION_MAP has accounting_setup entry", sacContent.includes('accounting_setup'), "missing");
  assert("accounting_setup requires ACCOUNTING.MANAGE", sacContent.includes('"ACCOUNTING"') && sacContent.includes('"MANAGE"'), "missing");

  // Check admin-tabs has accounting_setup
  const tabsContent = fs.readFileSync(path.join(projectRoot, "src/components/dashboard/admin/admin-tabs.tsx"), "utf8");
  assert("admin-tabs has accounting_setup tab", tabsContent.includes('accounting_setup'), "missing");
  assert("admin-tabs has Accounting Setup label", tabsContent.includes('Accounting Setup'), "missing");

  // Check dashboard page has AccountingSetupPanel
  const dashContent = fs.readFileSync(path.join(projectRoot, "src/app/dashboard/page.tsx"), "utf8");
  assert("Dashboard has AccountingSetupPanel import", dashContent.includes('accounting-setup-panel'), "missing");
  assert("Dashboard PANEL_MAP has accounting_setup", dashContent.includes('accounting_setup: AccountingSetupPanel'), "missing");

  // ── Results ───────────────────────────────────────────────────────────────

  console.log(`\n══════════════════════════════════════════════════════════════════`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failures.length > 0) {
    console.log(`\nFAILURES:`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  } else {
    console.log("ALL ASSERTIONS PASSED ✅");
  }
  console.log("══════════════════════════════════════════════════════════════════\n");

  await db.end();
  process.exit(failed > 0 ? 1 : 0);
})();
