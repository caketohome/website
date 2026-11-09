process.env.TEST_DATABASE_URL = 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';
process.env.DATABASE_URL = 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';
process.env.NODE_ENV = 'test';

import { Client } from 'pg';
import { DeliveryInvoicingService } from '../src/lib/services/delivery-invoicing.service';
import { closeDbPool, dbTransaction } from '../src/lib/db';

async function runPersistenceProof() {
  const tStart = Date.now();
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('CAKETOHOME ERP — CONTROLLED PERSISTENCE PROOF & VERIFICATION');
  console.log('Target: Isolated Localhost PostgreSQL 16 (127.0.0.1:5433/cth_test)');
  console.log('Start Time:', new Date(tStart).toISOString());
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const setupClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await setupClient.connect();

  const testId = `ord_proof_${tStart}`;
  const testOrderNumber = `ORD-PROOF-${tStart}`;
  const CTH_GSTIN = '29AAACC1234F1Z5';
  const CTH_LEGAL_NAME = 'CakeToHome Retail India Private Limited';

  // 1. Setup synthetic test fixture
  console.log('▶ STEP 1: Insert Synthetic Test Order Fixture');
  await setupClient.query(`
    INSERT INTO public.order (
      id, order_number, branch_id, status, grand_total, metadata, created_at
    ) VALUES (
      $1, $2, 'br_indiranagar_01', 'delivered', 1450.50, '{"is_ledger_eligible": true}'::jsonb, NOW()
    )
  `, [testId, testOrderNumber]);
  console.log(`  [OK] Order fixture created: id=${testId}, order_number=${testOrderNumber}`);

  // 2. Execute supported invoice-commit flow
  console.log('\n▶ STEP 2: Execute Supported Invoice-Commit Flow (generateInvoiceOnDelivery)');
  const genRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
    id: testId,
    order_number: testOrderNumber,
    status: 'delivered',
    branch_id: 'br_indiranagar_01',
    seller_gstin: CTH_GSTIN,
    seller_legal_name: CTH_LEGAL_NAME,
    seller_state_code: '29',
    items: [
      { title: 'Dutch Truffle Cake 1kg', quantity: 1, unit_price: 1200, hsn_code: '19059010', taxable_value: 1200, tax_amount: 216, total: 1416 },
      { title: 'Birthday Candles Pack', quantity: 1, unit_price: 100, hsn_code: '34060010', taxable_value: 100, tax_amount: 18, total: 118 },
    ],
  });

  console.log('  [OK] Generation result:', {
    success: genRes.success,
    invoice_number: genRes.invoice_number,
    invoice_id: genRes.invoice_id,
  });

  if (!genRes.success || !genRes.invoice_number) {
    throw new Error(`Invoice generation failed: ${genRes.error} (${genRes.code})`);
  }

  // Close setup client and connection pool
  await setupClient.end();
  await closeDbPool();

  // 3 & 4. Fresh physical PostgreSQL connection verification
  console.log('\n▶ STEP 3 & 4: Open Fresh PostgreSQL Connection & Independently Query Rows');
  const freshClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await freshClient.connect();

  const invQuery = await freshClient.query(
    'SELECT id, invoice_number, order_id, seller_gstin, seller_legal_name, grand_total, status, created_at FROM public.invoice WHERE order_id = $1',
    [testId]
  );
  const allocQuery = await freshClient.query(
    'SELECT entity_id, gstin, fiscal_year, prefix, sequence_value, invoice_number, status, order_id FROM public.invoice_allocation_log WHERE order_id = $1',
    [testId]
  );
  const seqQuery = await freshClient.query(
    "SELECT prefix, last_seq, gstin, fiscal_year FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026"
  );

  const invRow = invQuery.rows[0];
  const allocRow = allocQuery.rows[0];
  const seqRow = seqQuery.rows[0];

  console.log('  Fresh query public.invoice:', invRow);
  console.log('  Fresh query public.invoice_allocation_log:', allocRow);
  console.log('  Fresh query public.invoice_sequence:', seqRow);

  // 5. Confirm attributes
  console.log('\n▶ STEP 5: Confirm Persistence Integrity Attributes');
  const step5Valid =
    invRow !== undefined &&
    invRow.invoice_number === genRes.invoice_number &&
    invRow.order_id === testId &&
    invRow.seller_gstin === CTH_GSTIN &&
    invRow.seller_legal_name === CTH_LEGAL_NAME &&
    allocRow !== undefined &&
    allocRow.invoice_number === genRes.invoice_number &&
    allocRow.status === 'COMMITTED' &&
    allocRow.fiscal_year === 2026;

  console.log(`  [${step5Valid ? 'PASS' : 'FAIL'}] Persistence attributes verified:`, {
    invoice_number_match: invRow?.invoice_number === genRes.invoice_number,
    order_linkage_match: invRow?.order_id === testId,
    seller_gstin_match: invRow?.seller_gstin === CTH_GSTIN,
    fiscal_year_scope: allocRow?.fiscal_year === 2026,
    allocation_status: allocRow?.status,
  });

  if (!step5Valid) {
    throw new Error('Step 5 verification failed: database rows do not match expected attributes.');
  }

  // 6. Verify duplicate request does not consume another number
  console.log('\n▶ STEP 6: Duplicate Request Idempotency Check');
  const seqBeforeDuplicate = seqRow.last_seq;
  const dupRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
    id: testId,
    order_number: testOrderNumber,
    status: 'delivered',
    branch_id: 'br_indiranagar_01',
    seller_gstin: CTH_GSTIN,
    seller_legal_name: CTH_LEGAL_NAME,
    seller_state_code: '29',
    items: [
      { title: 'Dutch Truffle Cake 1kg', quantity: 1, unit_price: 1200, hsn_code: '19059010' },
    ],
  });

  const seqAfterDupQuery = await freshClient.query(
    "SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026"
  );
  const seqAfterDuplicate = seqAfterDupQuery.rows[0].last_seq;

  const step6Valid =
    dupRes.success === true &&
    dupRes.invoice_number === genRes.invoice_number &&
    dupRes.idempotent_replay === true &&
    seqBeforeDuplicate === seqAfterDuplicate;

  console.log(`  [${step6Valid ? 'PASS' : 'FAIL'}] Duplicate request verification:`, {
    same_invoice_number: dupRes.invoice_number === genRes.invoice_number,
    idempotent_replay_flag: dupRes.idempotent_replay,
    counter_unchanged: seqBeforeDuplicate === seqAfterDuplicate,
    seqBefore: seqBeforeDuplicate,
    seqAfter: seqAfterDuplicate,
  });

  if (!step6Valid) {
    throw new Error('Step 6 verification failed: duplicate request consumed counter or failed.');
  }

  // 7. Verify forced transaction failure rolls back invoice, counter, and allocation log
  console.log('\n▶ STEP 7: Forced Transaction Failure Rollback Verification');
  const rollbackPrefix = 'RBTEST';
  const rbOrderId = `ord_rb_${Date.now()}`;
  let rolledBackSuccessfully = false;

  const seqBeforeRbQuery = await freshClient.query(
    "SELECT last_seq FROM public.invoice_sequence WHERE prefix = $1 AND fiscal_year = 2026",
    [rollbackPrefix]
  );
  const seqBeforeRb = seqBeforeRbQuery.rows[0]?.last_seq ?? 0;

  try {
    await dbTransaction(async (txClient) => {
      // Allocate inside transaction
      await txClient.query(
        "SELECT * FROM public.allocate_invoice_number($1, $2, 'CAKETOHOME_PARENT', $3, NOW())",
        [rollbackPrefix, rbOrderId, CTH_GSTIN]
      );
      // Force an intentional abort
      throw new Error('FORCED_SIMULATED_TRANSACTION_FAILURE');
    });
  } catch (txErr: any) {
    if (txErr.message.includes('FORCED_SIMULATED_TRANSACTION_FAILURE')) {
      rolledBackSuccessfully = true;
    }
  }

  const seqAfterRbQuery = await freshClient.query(
    "SELECT last_seq FROM public.invoice_sequence WHERE prefix = $1 AND fiscal_year = 2026",
    [rollbackPrefix]
  );
  const seqAfterRb = seqAfterRbQuery.rows[0]?.last_seq ?? 0;

  const logRbQuery = await freshClient.query(
    "SELECT count(*)::int as count FROM public.invoice_allocation_log WHERE order_id = $1",
    [rbOrderId]
  );
  const invRbQuery = await freshClient.query(
    "SELECT count(*)::int as count FROM public.invoice WHERE order_id = $1",
    [rbOrderId]
  );

  const step7Valid =
    rolledBackSuccessfully &&
    seqBeforeRb === seqAfterRb &&
    logRbQuery.rows[0].count === 0 &&
    invRbQuery.rows[0].count === 0;

  console.log(`  [${step7Valid ? 'PASS' : 'FAIL'}] Forced rollback verification:`, {
    transaction_aborted: rolledBackSuccessfully,
    counter_preserved: seqBeforeRb === seqAfterRb,
    orphaned_logs_count: logRbQuery.rows[0].count,
    orphaned_invoice_count: invRbQuery.rows[0].count,
  });

  if (!step7Valid) {
    throw new Error('Step 7 verification failed: forced failure did not cleanly roll back.');
  }

  await freshClient.end();
  await closeDbPool();

  const tEnd = Date.now();
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`ALL 7 PERSISTENCE PROOF STEPS COMPLETED IN ${tEnd - tStart}ms`);
  console.log('Finish Time:', new Date(tEnd).toISOString());
  console.log('VERDICT: 100% PASS — DURABLE POSTGRESQL PERSISTENCE & MVCC ROLLBACK VERIFIED');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

runPersistenceProof().catch(err => {
  console.error('PERSISTENCE PROOF FATAL ERROR:', err);
  process.exit(1);
});
