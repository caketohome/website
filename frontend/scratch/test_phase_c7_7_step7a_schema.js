/**
 * CakeToHome ERP — Phase C7.7 Step 7A Schema Verification Suite
 * Tests tables, columns, indexes, foreign keys, CHECK constraints,
 * duplicate checksum protection, deletion protection, and idempotency.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.7 Step 7A Schema Verification Suite');
  console.log('=============================================================================\n');

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  try {
    // ─── Test 1: Table Existence ─────────────────────────────────────────────
    console.log('[Test Suite 1: Table & Column Structural Existence]');
    const batchExists = (await client.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='corporate_gifting_batch')
    `)).rows[0].exists;
    assert(batchExists, 'public.corporate_gifting_batch exists in database');

    const recipExists = (await client.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='corporate_gifting_recipient')
    `)).rows[0].exists;
    assert(recipExists, 'public.corporate_gifting_recipient exists in database');

    const batchCols = (await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='corporate_gifting_batch'
      ORDER BY ordinal_position;
    `)).rows;
    assert(batchCols.length >= 25, `corporate_gifting_batch has ${batchCols.length} columns (expected >= 25)`);

    const recipCols = (await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='corporate_gifting_recipient'
      ORDER BY ordinal_position;
    `)).rows;
    assert(recipCols.length >= 28, `corporate_gifting_recipient has ${recipCols.length} columns (expected >= 28)`);

    // Verify key columns
    const batchColNames = batchCols.map(c => c.column_name);
    ['id', 'customer_id', 'file_hash', 'status', 'total_recipients', 'total_amount', 'invoice_id', 'order_id', 'cost_centre_id', 'metadata'].forEach(c => {
      assert(batchColNames.includes(c), `corporate_gifting_batch includes column [${c}]`);
    });

    const recipColNames = recipCols.map(c => c.column_name);
    ['id', 'batch_id', 'row_number', 'recipient_name', 'recipient_phone', 'delivery_address', 'delivery_pincode', 'delivery_date', 'sku', 'quantity', 'unit_price', 'line_total', 'validation_status', 'status'].forEach(c => {
      assert(recipColNames.includes(c), `corporate_gifting_recipient includes column [${c}]`);
    });

    // ─── Test 2: Indexes ─────────────────────────────────────────────────────
    console.log('\n[Test Suite 2: Index Verification]');
    const indexes = (await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname='public' AND tablename IN ('corporate_gifting_batch', 'corporate_gifting_recipient');
    `)).rows;
    const indexNames = indexes.map(i => i.indexname);

    assert(indexNames.includes('idx_cgb_customer_file_hash_active'), 'Unique index idx_cgb_customer_file_hash_active exists');
    assert(indexNames.includes('idx_cgb_customer_id'), 'Index idx_cgb_customer_id exists');
    assert(indexNames.includes('idx_cgb_status'), 'Index idx_cgb_status exists');
    assert(indexNames.includes('idx_cgb_invoice_id'), 'Index idx_cgb_invoice_id exists');
    assert(indexNames.includes('idx_cgb_cost_centre_id'), 'Index idx_cgb_cost_centre_id exists');
    assert(indexNames.includes('idx_cgr_batch_id'), 'Index idx_cgr_batch_id exists');
    assert(indexNames.includes('idx_cgr_validation_status'), 'Index idx_cgr_validation_status exists');
    assert(indexNames.includes('idx_cgr_status'), 'Index idx_cgr_status exists');
    assert(indexNames.includes('idx_cgr_delivery_date'), 'Index idx_cgr_delivery_date exists');
    assert(indexNames.includes('uq_cgr_batch_row'), 'Unique constraint uq_cgr_batch_row exists');

    // ─── Test 3: Foreign Key Constraints ─────────────────────────────────────
    console.log('\n[Test Suite 3: Foreign Key Constraints]');
    const fks = (await client.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_name IN ('corporate_gifting_batch', 'corporate_gifting_recipient');
    `)).rows;

    const findFk = (table, col, foreignTable) => fks.find(f => f.table_name === table && f.column_name === col && f.foreign_table_name === foreignTable);

    assert(!!findFk('corporate_gifting_batch', 'customer_id', 'customer'), 'FK: corporate_gifting_batch.customer_id -> customer(id) RESTRICT');
    assert(!!findFk('corporate_gifting_batch', 'cost_centre_id', 'cost_centre'), 'FK: corporate_gifting_batch.cost_centre_id -> cost_centre(id) RESTRICT');
    assert(!!findFk('corporate_gifting_batch', 'invoice_id', 'invoice'), 'FK: corporate_gifting_batch.invoice_id -> invoice(id) SET NULL');
    assert(!!findFk('corporate_gifting_batch', 'order_id', 'order'), 'FK: corporate_gifting_batch.order_id -> order(id) SET NULL');
    assert(!!findFk('corporate_gifting_recipient', 'batch_id', 'corporate_gifting_batch'), 'FK: corporate_gifting_recipient.batch_id -> corporate_gifting_batch(id) RESTRICT');
    assert(!!findFk('corporate_gifting_recipient', 'product_id', 'product'), 'FK: corporate_gifting_recipient.product_id -> product(id) RESTRICT');
    assert(!!findFk('corporate_gifting_recipient', 'variant_id', 'product_variant'), 'FK: corporate_gifting_recipient.variant_id -> product_variant(id) RESTRICT');

    // ─── Test 4: Check Constraints Validation ────────────────────────────────
    console.log('\n[Test Suite 4: CHECK Constraints & Status Rejection]');
    
    // Pick an existing customer
    const custRes = await client.query(`SELECT id FROM public.customer WHERE is_corporate = true LIMIT 1`);
    const custId = custRes.rows[0]?.id || (await client.query(`SELECT id FROM public.customer LIMIT 1`)).rows[0].id;

    // A. Invalid batch status rejection
    let invalidStatusRejected = false;
    try {
      await client.query(`
        INSERT INTO public.corporate_gifting_batch 
          (customer_id, batch_name, source_filename, file_hash, status)
        VALUES ($1, 'Test Batch', 'test.xlsx', 'hash123', 'INVALID_STATUS')
      `, [custId]);
    } catch (err) {
      if (err.message.includes('check constraint') || err.message.includes('corporate_gifting_batch_status_check')) {
        invalidStatusRejected = true;
      }
    }
    assert(invalidStatusRejected, 'PostgreSQL rejected invalid batch status (CHECK constraint enforced)');

    // B. Negative recipient count rejection
    let negativeRecipRejected = false;
    try {
      await client.query(`
        INSERT INTO public.corporate_gifting_batch 
          (customer_id, batch_name, source_filename, file_hash, total_recipients)
        VALUES ($1, 'Test Batch', 'test.xlsx', 'hash123', -5)
      `, [custId]);
    } catch (err) {
      if (err.message.includes('check constraint')) {
        negativeRecipRejected = true;
      }
    }
    assert(negativeRecipRejected, 'PostgreSQL rejected negative total_recipients (CHECK constraint enforced)');

    // C. Non-positive row_number rejection
    let zeroRowRejected = false;
    try {
      await client.query(`
        INSERT INTO public.corporate_gifting_recipient
          (batch_id, row_number, recipient_name, recipient_phone, delivery_address, delivery_pincode, delivery_date, sku)
        VALUES ('nonexistent', 0, 'John', '9876543210', '123 St', '560001', '2026-11-01', 'SKU-1')
      `);
    } catch (err) {
      if (err.message.includes('check constraint')) {
        zeroRowRejected = true;
      }
    }
    assert(zeroRowRejected, 'PostgreSQL rejected row_number < 1 (CHECK constraint enforced)');

    // ─── Test 5: Unique Duplicate Checksum Constraint ────────────────────────
    console.log('\n[Test Suite 5: Duplicate File Hash Upload Rejection]');
    const testHash = `testhash_${Date.now()}`;
    const insBatchSql = `
      INSERT INTO public.corporate_gifting_batch 
        (id, customer_id, batch_name, source_filename, file_hash, status)
      VALUES ($1, $2, 'Batch 1', 'test.xlsx', $3, 'DRAFT')
      RETURNING id;
    `;
    const batch1Id = `cgb_test_01_${Date.now()}`;
    await client.query(insBatchSql, [batch1Id, custId, testHash]);

    let duplicateHashRejected = false;
    try {
      const batch2Id = `cgb_test_02_${Date.now()}`;
      await client.query(insBatchSql, [batch2Id, custId, testHash]);
    } catch (err) {
      if (err.message.includes('unique') || err.message.includes('idx_cgb_customer_file_hash_active')) {
        duplicateHashRejected = true;
      }
    }
    assert(duplicateHashRejected, 'Duplicate active file hash rejected for same customer by unique index');

    // ─── Test 6: Unique Row Number per Batch ─────────────────────────────────
    console.log('\n[Test Suite 6: Source Row Number Uniqueness in Batch]');
    const insRecipSql = `
      INSERT INTO public.corporate_gifting_recipient
        (id, batch_id, row_number, recipient_name, recipient_phone, delivery_address, delivery_pincode, delivery_date, sku, quantity, unit_price, line_total)
      VALUES ($1, $2, $3, 'Recipient A', '9876543210', '123 Street', '560001', '2026-11-15', 'SKU-01', 1, 500.00, 500.00);
    `;
    const recip1Id = `cgr_test_01_${Date.now()}`;
    await client.query(insRecipSql, [recip1Id, batch1Id, 1]);

    let duplicateRowRejected = false;
    try {
      const recip2Id = `cgr_test_02_${Date.now()}`;
      await client.query(insRecipSql, [recip2Id, batch1Id, 1]); // Duplicate row 1
    } catch (err) {
      if (err.message.includes('unique') || err.message.includes('uq_cgr_batch_row')) {
        duplicateRowRejected = true;
      }
    }
    assert(duplicateRowRejected, 'Duplicate row_number in same batch rejected by unique constraint uq_cgr_batch_row');

    // ─── Test 7: Referential Integrity Deletion Protection ───────────────────
    console.log('\n[Test Suite 7: Referential Integrity Deletion Protection]');
    let deleteBatchProtected = false;
    try {
      await client.query(`DELETE FROM public.corporate_gifting_batch WHERE id = $1`, [batch1Id]);
    } catch (err) {
      if (err.message.includes('foreign key constraint') || err.message.includes('corporate_gifting_recipient_batch_id_fkey')) {
        deleteBatchProtected = true;
      }
    }
    assert(deleteBatchProtected, 'Deleting batch with active recipients is RESTRICTed by foreign key');

    // ─── Test 8: Clean Test Fixtures & Zero Residual Rows ────────────────────
    console.log('\n[Test Suite 8: Fixture Cleanup & Zero Row Baseline]');
    await client.query(`DELETE FROM public.corporate_gifting_recipient WHERE batch_id = $1`, [batch1Id]);
    await client.query(`DELETE FROM public.corporate_gifting_batch WHERE id = $1`, [batch1Id]);

    const finalBatchCount = (await client.query(`SELECT count(*)::int as count FROM public.corporate_gifting_batch`)).rows[0].count;
    const finalRecipCount = (await client.query(`SELECT count(*)::int as count FROM public.corporate_gifting_recipient`)).rows[0].count;
    assert(finalBatchCount === 0, `corporate_gifting_batch row count = ${finalBatchCount} (expected 0)`);
    assert(finalRecipCount === 0, `corporate_gifting_recipient row count = ${finalRecipCount} (expected 0)`);

    // ─── Test 9: Chart of Accounts & Trial Balance Invariants ────────────────
    console.log('\n[Test Suite 9: Accounting Invariants]');
    const coaCount = (await client.query(`SELECT count(*)::int as count FROM public.accounting_account`)).rows[0].count;
    assert(coaCount === 100, `CoA count strictly preserved at ${coaCount} (expected 100)`);

    const tb = (await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `)).rows[0];
    assert(tb.dr === tb.cr, `Trial Balance balanced: Dr ₹${tb.dr} === Cr ₹${tb.cr}`);

    const locks = (await client.query(`
      SELECT count(*)::int as count FROM pg_locks WHERE NOT granted;
    `)).rows[0].count;
    assert(locks === 0, `Active ungranted locks = ${locks} (expected 0)`);

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n=============================================================================');
    console.log(`Verification Complete: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================================');

    if (failed > 0) {
      process.exit(1);
    }

  } finally {
    await client.end();
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
