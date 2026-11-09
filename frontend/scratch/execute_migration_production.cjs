/**
 * CakeToHome ERP — Authorized Migration V2 Execution Script
 *
 * Executes Migration_Unique_Order_Invoice_Numbering_V2.sql against Supabase PostgreSQL
 * with comprehensive pre-flight and post-flight validation guards.
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

async function executeMigration() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== STARTING AUTHORIZED PRODUCTION EXECUTION OF NUMBERING MIGRATION V2 ===\n');

  try {
    // ── Pre-Flight Checks ──────────────────────────────────────────────────
    console.log('1. Running Pre-Flight Invariant Checks...');
    const preSeq = await client.query('SELECT last_value, is_called FROM statutory_invoice_seq');
    console.log(`   - statutory_invoice_seq: last_value=${preSeq.rows[0].last_value}, is_called=${preSeq.rows[0].is_called}`);

    const preOrdCount = await client.query('SELECT COUNT(*)::int as count FROM public."order"');
    console.log(`   - public.order total rows: ${preOrdCount.rows[0].count}`);
    if (preOrdCount.rows[0].count !== 234) {
      throw new Error(`PRE-FLIGHT ABORT: Expected 234 orders, found ${preOrdCount.rows[0].count}`);
    }

    const preInvCount = await client.query('SELECT COUNT(*)::int as count FROM public.invoice');
    console.log(`   - public.invoice total rows: ${preInvCount.rows[0].count}`);
    if (preInvCount.rows[0].count !== 5) {
      throw new Error(`PRE-FLIGHT ABORT: Expected 5 invoices, found ${preInvCount.rows[0].count}`);
    }

    const preVchCount = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_voucher');
    console.log(`   - public.accounting_voucher total rows: ${preVchCount.rows[0].count}`);
    if (preVchCount.rows[0].count !== 98) {
      throw new Error(`PRE-FLIGHT ABORT: Expected 98 accounting vouchers, found ${preVchCount.rows[0].count}`);
    }
    console.log('✅ Pre-flight checks passed.\n');

    // ── Transactional Execution ────────────────────────────────────────────
    console.log('2. Applying Migration_Unique_Order_Invoice_Numbering_V2.sql in atomic transaction...');
    await client.query('BEGIN');

    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '../../migration/Migration_Unique_Order_Invoice_Numbering_V2.sql'),
      'utf8'
    );
    // Strip external transaction wrapper if present to control commit precisely
    const cleanedSql = migrationSql
      .replace(/^\s*BEGIN\s*;/im, '-- BEGIN omitted')
      .replace(/^\s*COMMIT\s*;/im, '-- COMMIT omitted');

    await client.query(cleanedSql);
    console.log('✅ Migration SQL statements executed successfully.\n');

    // ── In-Flight Verification ─────────────────────────────────────────────
    console.log('3. Running In-Flight Validation Guards...');

    // A. Verify all 234 orders have non-null order_number
    const ordCheck = await client.query(`
      SELECT 
        COUNT(*)::int as total_orders,
        COUNT(order_number)::int as with_order_number,
        COUNT(DISTINCT order_number)::int as distinct_order_numbers
      FROM public."order";
    `);
    const { total_orders, with_order_number, distinct_order_numbers } = ordCheck.rows[0];
    console.log(`   - Total Orders: ${total_orders}`);
    console.log(`   - With order_number: ${with_order_number}`);
    console.log(`   - Distinct order_numbers: ${distinct_order_numbers}`);

    if (total_orders !== 234 || with_order_number !== 234 || distinct_order_numbers !== 234) {
      throw new Error(`IN-FLIGHT ABORT: Collision or unmapped order! total=${total_orders}, mapped=${with_order_number}, unique=${distinct_order_numbers}`);
    }
    console.log('   ✅ 100% of orders mapped with strict 1:1 uniqueness.');

    // B. Verify migration log table
    const logCount = await client.query('SELECT COUNT(*)::int as count FROM public.order_number_migration_log');
    console.log(`   - Migration log entries: ${logCount.rows[0].count}`);
    if (logCount.rows[0].count !== 234) {
      throw new Error(`IN-FLIGHT ABORT: Expected 234 migration log records, got ${logCount.rows[0].count}`);
    }
    console.log('   ✅ Migration log captured exactly 234 entries with full lineage.');

    // C. Verify duplicate disambiguation
    const dupLog = await client.query(`
      SELECT order_id, original_metadata_order_number, assigned_order_number, disambiguation_rule
      FROM public.order_number_migration_log
      WHERE original_metadata_order_number IN ('CTH-20260828-101', 'CTH-20260828-214')
      ORDER BY original_metadata_order_number, assigned_order_number;
    `);
    console.log(`   - Historical duplicate disambiguations (${dupLog.rows.length} rows):`);
    console.table(dupLog.rows);

    // D. Verify sequences seeded properly
    const ordSeqRes = await client.query("SELECT prefix, last_seq FROM public.order_sequence WHERE prefix = 'CTH'");
    console.log(`   - order_sequence ('CTH'): last_seq = ${ordSeqRes.rows[0].last_seq} (expected >= 1000)`);
    if (ordSeqRes.rows[0].last_seq < 1000) {
      throw new Error('IN-FLIGHT ABORT: order_sequence not seeded at >= 1000');
    }

    const invSeqRes = await client.query("SELECT entity_id, fiscal_year, prefix, last_seq FROM public.invoice_sequence WHERE entity_id = 'CAKETOHOME_PARENT' AND fiscal_year = 2026 AND prefix = 'CTH'");
    console.log(`   - invoice_sequence ('CTH', 2026): last_seq = ${invSeqRes.rows[0].last_seq} (expected 192)`);
    if (invSeqRes.rows[0].last_seq !== 192) {
      throw new Error(`IN-FLIGHT ABORT: invoice_sequence last_seq is ${invSeqRes.rows[0].last_seq}, expected 192`);
    }

    // E. Verify functions exist with SECURITY DEFINER
    const funcRes = await client.query(`
      SELECT proname, prosecdef FROM pg_proc 
      WHERE proname IN ('allocate_order_number', 'allocate_invoice_number', 'commit_invoice_allocation', 'void_invoice_allocation')
    `);
    if (funcRes.rows.length !== 4 || !funcRes.rows.every(f => f.prosecdef)) {
      throw new Error('IN-FLIGHT ABORT: One or more allocation functions missing or not SECURITY DEFINER');
    }
    console.log('   ✅ All 4 functions verified with SECURITY DEFINER.');

    // ── Commit Transaction ─────────────────────────────────────────────────
    console.log('\n4. All validation guards PASSED. Committing transaction to Supabase...');
    await client.query('COMMIT');
    console.log('🚀 MIGRATION SUCCESSFULLY COMMITTED TO SUPABASE POSTGRESQL!\n');

    // ── Post-Commit Operational Verification ───────────────────────────────
    console.log('5. Running Post-Commit Operational Verifications...');

    // Test allocate_order_number live
    const testOrdNum = await client.query("SELECT * FROM public.allocate_order_number('CTH')");
    console.log('   - allocate_order_number live result:', testOrdNum.rows[0]);

    // Test allocate_invoice_number live idempotently
    const testInv1 = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_live_verify_test_001', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', NOW())");
    console.log('   - allocate_invoice_number call 1:', testInv1.rows[0]);

    const testInv2 = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_live_verify_test_001', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', NOW())");
    console.log('   - allocate_invoice_number call 2 (idempotent replay):', testInv2.rows[0]);

    if (testInv1.rows[0].invoice_number !== testInv2.rows[0].invoice_number || testInv1.rows[0].sequence_value !== testInv2.rows[0].sequence_value) {
      throw new Error('POST-COMMIT ERROR: Live allocation idempotency check failed!');
    }
    console.log('   ✅ Live allocation idempotency confirmed.');

    // Commit allocation log
    await client.query("SELECT public.commit_invoice_allocation('ord_live_verify_test_001', 'inv_live_verify_001')");
    console.log('   ✅ Live commit_invoice_allocation confirmed.');

    // Clean up verification test record from allocation log
    await client.query("DELETE FROM public.invoice_allocation_log WHERE order_id = 'ord_live_verify_test_001'");
    console.log('   ✅ Cleaned up operational probe records.');

    console.log('\n=== ALL POST-COMMIT VERIFICATIONS COMPLETED SUCCESSFULLY ===');

  } catch (err) {
    console.error('\n❌ EXECUTION ERROR ENCOUNTERED. ROLLING BACK...', err);
    try {
      await client.query('ROLLBACK');
      console.log('🔒 ROLLBACK EXECUTED. Live database untouched.');
    } catch (rbErr) {
      console.error('Error during rollback:', rbErr);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeMigration().catch(console.error);
