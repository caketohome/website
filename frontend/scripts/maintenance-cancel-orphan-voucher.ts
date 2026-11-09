/**
 * CakeToHome ERP — Phase 3.7 Controlled Draft Voucher Cancellation
 *
 * Narrowly scoped, evidence-gated maintenance script to cancel verified
 * unposted orphan test voucher vch_00MVTQ5KTT8HXVN2 via the authoritative
 * domain repository lifecycle.
 */

import { Pool, PoolClient } from "pg";
import { AccountingVoucherRepository } from "../src/lib/repositories/accounting-voucher.repository";

const connectionString =
  process.env.TEST_DATABASE_URL ||
  "postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test";

const pool = new Pool({ connectionString });

const TARGET_VOUCHER_ID = "vch_00MVTQ5KTT8HXVN2";
const TARGET_BRANCH_ID = "br_indiranagar_01";
const TARGET_VOUCHER_NO = "VCH-SALES-FY2026-27-20261029-YVXK7Y";
const ACTOR_IDENTITY = "audit:phase3_7_release_manager";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PHASE 3.7: CONTROLLED DRAFT VOUCHER CANCELLATION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const client: PoolClient = await pool.connect();

  try {
    // ── GATE 1: Environment & Endpoint Safety Assertions ─────────────────
    console.log("1. Checking Database Identity & Endpoint...");
    const dbInfo = (
      await client.query(
        "SELECT current_database() as db, current_user as usr, inet_server_port() as port, version() as ver"
      )
    ).rows[0];

    console.log(`   Connected to: ${dbInfo.db} on port ${dbInfo.port} as ${dbInfo.usr}`);
    if (dbInfo.db !== "cth_test" || Number(dbInfo.port) !== 5433) {
      throw new Error(
        `SAFETY ABORT: Refusing to execute on non-approved database ${dbInfo.db}:${dbInfo.port}`
      );
    }

    // ── BEGIN ATOMIC TRANSACTION ─────────────────────────────────────────
    console.log("\n2. Beginning Atomic Transaction...");
    await client.query("BEGIN;");

    // ── GATE 2: Row-Level Exclusive Lock & Precondition Validation ──────
    console.log("3. Acquiring Row-Level Lock & Asserting Voucher Preconditions...");
    const lockRes = await client.query(
      `SELECT id, voucher_no, voucher_type, branch_id, status, total_amount, currency,
              reference_type, reference_id, reference_event, narration, posted_at, cancelled_at
       FROM public.accounting_voucher
       WHERE id = $1
       FOR UPDATE;`,
      [TARGET_VOUCHER_ID]
    );

    if (lockRes.rows.length !== 1) {
      throw new Error(`Target voucher ${TARGET_VOUCHER_ID} does not exist in database.`);
    }

    const vch = lockRes.rows[0];
    if (vch.voucher_no !== TARGET_VOUCHER_NO) {
      throw new Error(`Voucher number mismatch: got ${vch.voucher_no}, expected ${TARGET_VOUCHER_NO}`);
    }
    if (vch.voucher_type !== "SALES") {
      throw new Error(`Voucher type mismatch: got ${vch.voucher_type}, expected SALES`);
    }
    if (vch.branch_id !== TARGET_BRANCH_ID) {
      throw new Error(`Branch mismatch: got ${vch.branch_id}, expected ${TARGET_BRANCH_ID}`);
    }
    if (vch.status !== "DRAFT") {
      throw new Error(`Status mismatch: voucher is ${vch.status}, expected DRAFT`);
    }
    if (Number(vch.total_amount) !== 681.46) {
      throw new Error(`Total amount mismatch: got ${vch.total_amount}, expected 681.46`);
    }
    if (vch.posted_at !== null) {
      throw new Error("Voucher is posted (posted_at is non-null). Cannot cancel.");
    }
    if (vch.cancelled_at !== null) {
      throw new Error("Voucher is already cancelled.");
    }
    console.log(`   Voucher ${vch.voucher_no} locked in DRAFT status.`);

    // ── GATE 3: Dependent Child Record Assertions ────────────────────────
    console.log("4. Verifying Zero Dependent Child Records...");
    const childCounts = (
      await client.query(
        `SELECT
          (SELECT COUNT(*) FROM public.accounting_journal_entry WHERE voucher_id = $1) as entry_count,
          (SELECT COUNT(*) FROM public.inventory_movement WHERE voucher_id = $1) as inv_count,
          (SELECT COUNT(*) FROM public.invoice WHERE voucher_id = $1) as inv_row_count;`,
        [TARGET_VOUCHER_ID]
      )
    ).rows[0];

    if (
      Number(childCounts.entry_count) !== 0 ||
      Number(childCounts.inv_count) !== 0 ||
      Number(childCounts.inv_row_count) !== 0
    ) {
      throw new Error(
        `Dependent records detected: entries=${childCounts.entry_count}, inventory=${childCounts.inv_count}, invoices=${childCounts.inv_row_count}`
      );
    }
    console.log("   Zero dependent child records verified.");

    // ── GATE 4: Invoke Authoritative Domain Lifecycle ────────────────────
    console.log(`\n5. Invoking AccountingVoucherRepository.cancel() as '${ACTOR_IDENTITY}'...`);
    const cancelledRow = await AccountingVoucherRepository.cancel(
      TARGET_VOUCHER_ID,
      ACTOR_IDENTITY,
      TARGET_BRANCH_ID,
      client
    );

    // ── GATE 5: Validate Transition Output ──────────────────────────────
    console.log("6. Verifying In-Transaction Postconditions...");
    if (cancelledRow.status !== "CANCELLED") {
      throw new Error(`Domain method failed to transition status: status is ${cancelledRow.status}`);
    }
    if (cancelledRow.cancelled_by !== ACTOR_IDENTITY) {
      throw new Error(`Domain method failed to record actor: got ${cancelledRow.cancelled_by}`);
    }
    if (!cancelledRow.cancelled_at) {
      throw new Error("Domain method failed to record cancelled_at timestamp.");
    }

    // ── GATE 6: Verify Single Row Mutation ──────────────────────────────
    const verifyQ = await client.query(
      `SELECT id, voucher_no, status, cancelled_by, cancelled_at, updated_at
       FROM public.accounting_voucher
       WHERE id = $1;`,
      [TARGET_VOUCHER_ID]
    );

    const postState = verifyQ.rows[0];
    console.log("   Committed State Preview:", {
      id: postState.id,
      voucher_no: postState.voucher_no,
      status: postState.status,
      cancelled_by: postState.cancelled_by,
      cancelled_at: postState.cancelled_at,
    });

    // ── COMMIT TRANSACTION ──────────────────────────────────────────────
    console.log("\n7. Committing Transaction...");
    await client.query("COMMIT;");
    console.log("   Transaction COMMITTED successfully.\n");

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🎉 SUCCESS: Target draft voucher cancelled with full audit integrity.");
    console.log("═══════════════════════════════════════════════════════════════\n");
  } catch (err: any) {
    console.error("\n💥 TRANSACTION ABORTED / ROLLED BACK:", err.message);
    try {
      await client.query("ROLLBACK;");
    } catch {}
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

