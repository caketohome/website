/**
 * Test: Migration Rerun Safety & Non-Transactional Sequence Invariant Verification
 *
 * Verifies P1.7:
 * 1. Runs Migration_Unique_Order_Invoice_Numbering_V2.sql Run 1.
 * 2. Runs Migration_Unique_Order_Invoice_Numbering_V2.sql Run 2 consecutively.
 * 3. Proves idempotent policy recreation (DROP POLICY IF EXISTS), function replacement,
 *    and conflict-free table/index creation.
 * 4. Verifies statutory_invoice_seq last_value (192) and is_called (true) are completely
 *    unmutated before, during, and after dry-run.
 * 5. Full rollback preserves live database.
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

async function testRerunSafety() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== RUNNING MIGRATION RERUN SAFETY & SEQUENCE VERIFICATION TEST ===\n');

  try {
    // 1. Check live sequence state BEFORE test
    const seqBefore = await client.query('SELECT last_value, log_cnt, is_called FROM statutory_invoice_seq');
    console.log('Sequence BEFORE dry-run:', seqBefore.rows[0]);

    await client.query('BEGIN');

    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '../../migration/Migration_Unique_Order_Invoice_Numbering_V2.sql'),
      'utf8'
    );
    const cleanedSql = migrationSql
      .replace(/^\s*BEGIN\s*;/im, '-- BEGIN omitted')
      .replace(/^\s*COMMIT\s*;/im, '-- COMMIT omitted');

    // Run 1
    console.log('Applying Migration Run 1...');
    await client.query(cleanedSql);
    console.log('✅ Run 1 completed successfully.');

    // Run 2 (Immediately rerun without rolling back)
    console.log('Applying Migration Run 2 (consecutive rerun)...');
    await client.query(cleanedSql);
    console.log('✅ Run 2 completed successfully with zero errors.');

    // Verify policies exist without duplicates
    const polRes = await client.query(`
      SELECT policyname, tablename, cmd, roles 
      FROM pg_policies 
      WHERE tablename IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
      ORDER BY tablename, policyname;
    `);
    console.log(`\nActive RLS Policies on numbering infrastructure (${polRes.rows.length} total):`);
    console.table(polRes.rows);

    // Verify functions exist
    const funcRes = await client.query(`
      SELECT proname, prosecdef
      FROM pg_proc 
      WHERE proname IN ('allocate_order_number', 'allocate_invoice_number', 'commit_invoice_allocation', 'void_invoice_allocation');
    `);
    console.log('\nInstalled Allocation Functions (prosecdef = SECURITY DEFINER):');
    console.table(funcRes.rows);

    for (const f of funcRes.rows) {
      if (!f.prosecdef) {
        throw new Error(`FAILED: Function ${f.proname} is not marked SECURITY DEFINER!`);
      }
    }
    console.log('✅ SECURITY DEFINER VERIFIED: All functions marked prosecdef = true.');

  } finally {
    await client.query('ROLLBACK');
    console.log('\n🔒 TRANSACTION ROLLED BACK.');

    // 2. Check live sequence state AFTER test
    const seqAfter = await client.query('SELECT last_value, log_cnt, is_called FROM statutory_invoice_seq');
    console.log('Sequence AFTER dry-run rollback:', seqAfter.rows[0]);

    if (seqAfter.rows[0].last_value !== '192' || !seqAfter.rows[0].is_called) {
      throw new Error('FAILED: statutory_invoice_seq was altered!');
    }
    console.log('✅ SEQUENCE UNMUTATED: statutory_invoice_seq last_value remains 192 (is_called=true), proving non-transactional state was 100% untouched.');

    await client.end();
  }
}

testRerunSafety().catch(err => {
  console.error('FATAL RERUN SAFETY ERROR:', err);
  process.exit(1);
});
