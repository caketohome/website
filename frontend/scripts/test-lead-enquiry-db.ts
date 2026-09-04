import { persistLeadEnquiryToDb } from '../src/lib/db-persistence';
import { dbQuery, closeDbPool } from '../src/lib/db';

async function testLeadEnquiryDb() {
  const timeout = setTimeout(() => {
    console.error('FATAL: Lead enquiry DB test exceeded 15s hard timeout.');
    process.exit(1);
  }, 15000);
  timeout.unref();

  console.log('[Phase 1] Starting deterministic Lead Enquiry PostgreSQL verification...');
  const t0 = Date.now();

  try {
    // 1. Verify schema existence
    console.log('[Phase 2] Verifying table schema in PostgreSQL information_schema...');
    const tableCheck = await dbQuery(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'lead_enquiry'`
    );
    console.log(`[Phase 2 Result] table_name count: ${tableCheck.rows.length}`);

    // 2. Insert test enquiry
    const testId = `test_enq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const enquiry = {
      id: testId,
      type: 'custom_cake_enquiry',
      name: 'Aishwarya Rai',
      phone: '9876543210',
      email: 'aishwarya@example.com',
      details: '3-tier royal blue fondant cake for anniversary celebration on Saturday',
    };

    console.log(`[Phase 3] Inserting lead enquiry with ID: ${testId}...`);
    const savedId = await persistLeadEnquiryToDb(enquiry);
    console.log(`[Phase 3 Result] Insert successful. Returned ID: ${savedId}`);

    // 3. Read back & assert field-by-field
    console.log(`[Phase 4] Querying PostgreSQL row for ID: ${savedId}...`);
    const res = await dbQuery('SELECT * FROM "lead_enquiry" WHERE "id" = $1', [savedId]);
    if (res.rows.length === 0) {
      throw new Error(`Assertion failed: Row with id ${savedId} not found in database!`);
    }

    const row = res.rows[0];
    console.log('[Phase 4 Result] Found row:', row);

    if (row.name !== enquiry.name) throw new Error(`Name mismatch: expected ${enquiry.name}, got ${row.name}`);
    if (row.phone !== enquiry.phone) throw new Error(`Phone mismatch: expected ${enquiry.phone}, got ${row.phone}`);
    if (row.type !== enquiry.type) throw new Error(`Type mismatch: expected ${enquiry.type}, got ${row.type}`);
    if (row.email !== enquiry.email) throw new Error(`Email mismatch: expected ${enquiry.email}, got ${row.email}`);

    // 4. Update test
    console.log('[Phase 5] Testing status update in PostgreSQL...');
    await dbQuery('UPDATE "lead_enquiry" SET "status" = $1 WHERE "id" = $2', ['contacted', savedId]);
    const updated = await dbQuery('SELECT status FROM "lead_enquiry" WHERE "id" = $1', [savedId]);
    if (updated.rows[0]?.status !== 'contacted') {
      throw new Error('Status update failed');
    }
    console.log('[Phase 5 Result] Status updated to: contacted');

    // 5. Clean up
    console.log('[Phase 6] Cleaning up test row...');
    await dbQuery('DELETE FROM "lead_enquiry" WHERE "id" = $1', [savedId]);
    const verifyDeleted = await dbQuery('SELECT 1 FROM "lead_enquiry" WHERE "id" = $1', [savedId]);
    if (verifyDeleted.rows.length !== 0) {
      throw new Error('Cleanup deletion failed');
    }
    console.log('[Phase 6 Result] Test row deleted cleanly.');

    console.log(`\n========================================`);
    console.log(`✅ LEAD ENQUIRY DB TEST: 100% PASS (${Date.now() - t0}ms)`);
    console.log(`========================================\n`);
  } finally {
    console.log('[Phase 7] Closing PostgreSQL pool connection...');
    await closeDbPool();
    clearTimeout(timeout);
    console.log('[Phase 7 Result] PostgreSQL pool closed cleanly.');
  }
}

testLeadEnquiryDb()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Lead enquiry DB test failed with error:', err);
    process.exit(1);
  });
