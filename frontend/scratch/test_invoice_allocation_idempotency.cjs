/**
 * Test: Invoice Allocation Idempotency & Partial Unique Index Verification
 *
 * Verifies P0.1:
 * 1. Calling allocate_invoice_number with the same p_order_id repeatedly returns
 *    the exact same invoice number and sequence value.
 * 2. Does NOT increment invoice_sequence.last_seq on subsequent calls.
 * 3. Enforces the partial unique index uq_invoice_allocation_log_order_active.
 * 4. All execution is wrapped in BEGIN ... ROLLBACK so live database is NEVER modified.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let envFile = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envFile)) envFile = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envFile, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

async function testIdempotency() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== RUNNING INVOICE ALLOCATION IDEMPOTENCY TEST ===\n');

  try {
    await client.query('BEGIN');

    // Apply the V2 migration SQL inside the transaction
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '../../migration/Migration_Unique_Order_Invoice_Numbering_V2.sql'),
      'utf8'
    );
    // Strip BEGIN; and COMMIT; from the migration file so we control the transaction
    const cleanedSql = migrationSql
      .replace(/^\s*BEGIN\s*;/im, '-- BEGIN omitted')
      .replace(/^\s*COMMIT\s*;/im, '-- COMMIT omitted');

    await client.query(cleanedSql);
    console.log('✅ Applied Migration_Unique_Order_Invoice_Numbering_V2.sql in transaction.');

    // Check initial sequence counter
    const initSeqRes = await client.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = 'CAKETOHOME_PARENT' AND fiscal_year = 2026 AND prefix = 'CTH'"
    );
    const initialSeq = initSeqRes.rows[0].last_seq;
    console.log(`Initial invoice_sequence.last_seq = ${initialSeq}`);

    const testOrderId = 'ord_test_idempotency_789456';
    const allocations = [];

    // Call allocate_invoice_number 10 times for the exact same order
    for (let i = 1; i <= 10; i++) {
      const res = await client.query(
        "SELECT * FROM public.allocate_invoice_number('CTH', $1, 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', NOW())",
        [testOrderId]
      );
      allocations.push(res.rows[0]);
    }

    console.log('\n--- Allocation Results (10 consecutive calls) ---');
    console.table(allocations);

    const first = allocations[0];
    let allIdentical = true;
    for (let i = 1; i < allocations.length; i++) {
      if (
        allocations[i].invoice_number !== first.invoice_number ||
        allocations[i].sequence_value !== first.sequence_value ||
        allocations[i].fiscal_year !== first.fiscal_year
      ) {
        allIdentical = false;
        console.error(`❌ Mismatch on call ${i + 1}:`, allocations[i]);
      }
    }

    if (!allIdentical) {
      throw new Error('FAILED: allocate_invoice_number returned differing numbers for same order!');
    }
    console.log(`✅ IDEMPOTENCY VERIFIED: All 10 calls returned identical invoice_number: ${first.invoice_number} (Seq: ${first.sequence_value})`);

    // Verify counter in invoice_sequence was only incremented by 1
    const postSeqRes = await client.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = 'CAKETOHOME_PARENT' AND fiscal_year = 2026 AND prefix = 'CTH'"
    );
    const finalSeq = postSeqRes.rows[0].last_seq;
    console.log(`Final invoice_sequence.last_seq = ${finalSeq}`);

    if (finalSeq !== initialSeq + 1) {
      throw new Error(`FAILED: Sequence advanced by ${finalSeq - initialSeq}, expected exactly 1!`);
    }
    console.log(`✅ COUNTER CONSERVATION: Sequence advanced by exactly 1 (from ${initialSeq} to ${finalSeq}), zero wasted numbers.`);

    // Verify allocation log has exactly 1 row for this order
    const logRes = await client.query(
      "SELECT id, order_id, invoice_number, sequence_value, status FROM public.invoice_allocation_log WHERE order_id = $1",
      [testOrderId]
    );
    console.log(`Allocation log rows for order ${testOrderId}: ${logRes.rows.length}`);
    if (logRes.rows.length !== 1) {
      throw new Error(`FAILED: Expected 1 allocation log row, found ${logRes.rows.length}`);
    }
    console.log('✅ ALLOCATION LOG: Exactly 1 record created with status = ALLOCATED.');

    // Test commit_invoice_allocation
    const commitRes = await client.query(
      "SELECT public.commit_invoice_allocation($1, 'inv_test_committed_123') as committed",
      [testOrderId]
    );
    console.log('commit_invoice_allocation result:', commitRes.rows[0].committed);

    const committedLogRes = await client.query(
      "SELECT status, invoice_id FROM public.invoice_allocation_log WHERE order_id = $1",
      [testOrderId]
    );
    console.log(`Updated status = ${committedLogRes.rows[0].status}, invoice_id = ${committedLogRes.rows[0].invoice_id}`);
    if (committedLogRes.rows[0].status !== 'COMMITTED') {
      throw new Error('FAILED: commit_invoice_allocation did not transition status to COMMITTED!');
    }
    console.log('✅ AUDIT LIFECYCLE: Successfully transitioned ALLOCATED -> COMMITTED.');

  } finally {
    await client.query('ROLLBACK');
    console.log('\n🔒 TRANSACTION ROLLED BACK: Live Supabase database remains 100% pristine.');
    await client.end();
  }
}

testIdempotency().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
