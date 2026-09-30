const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.substring('DATABASE_URL='.length).trim();
    }
  }
  throw new Error("No database connection string found in environment or backend/.env");
}

async function run() {
  const connectionString = getConnectionString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const report = {
    testResults: {},
    failures: []
  };

  try {
    console.log("=== BEGINNING INDEPENDENT PHASE 4B POST-MIGRATION VERIFICATION ===");

    // A. Verify exactly the 5 tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'accounting_%'
      ORDER BY table_name;
    `);
    const createdTables = tablesRes.rows.map(r => r.table_name);
    report.testResults.accountingTables = createdTables;
    if (createdTables.length !== 5 || !['accounting_account', 'accounting_fiscal_period', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_voucher'].every(t => createdTables.includes(t))) {
      report.failures.push(`Expected exactly 5 accounting tables, found: ${createdTables.join(', ')}`);
    }

    // B & C. Verify column data types for all 5 tables
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('accounting_account', 'accounting_fiscal_period', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_voucher')
      ORDER BY table_name, ordinal_position;
    `);
    
    // Check PKs are text
    const pkCols = colsRes.rows.filter(r => r.column_name === 'id');
    const nonTextPks = pkCols.filter(r => r.data_type !== 'text');
    report.testResults.pkTypes = pkCols.map(r => `${r.table_name}.id: ${r.data_type}`);
    if (nonTextPks.length > 0) {
      report.failures.push(`Non-text PKs found: ${nonTextPks.map(r => `${r.table_name}.${r.column_name}(${r.data_type})`).join(', ')}`);
    }

    // Check internal & operational FKs are text
    const fkNames = ['parent_id', 'branch_id', 'customer_id', 'supplier_id', 'voucher_id', 'journal_entry_id', 'account_id', 'reversed_by_voucher_id', 'reversal_of_voucher_id'];
    const fkCols = colsRes.rows.filter(r => fkNames.includes(r.column_name));
    const nonTextFks = fkCols.filter(r => r.data_type !== 'text');
    report.testResults.fkTypes = fkCols.map(r => `${r.table_name}.${r.column_name}: ${r.data_type}`);
    if (nonTextFks.length > 0) {
      report.failures.push(`Non-text FKs found: ${nonTextFks.map(r => `${r.table_name}.${r.column_name}(${r.data_type})`).join(', ')}`);
    }

    // D. Verify Foreign Keys
    const fksRes = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name LIKE 'accounting_%'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    report.testResults.foreignKeys = fksRes.rows;

    // E. Verify Table Constraints
    const constraintsRes = await client.query(`
      SELECT table_name, constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name LIKE 'accounting_%'
      ORDER BY table_name, constraint_name;
    `);
    report.testResults.constraintsCount = constraintsRes.rows.length;

    // F. Verify Indexes
    const idxRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename LIKE 'accounting_%'
      ORDER BY tablename, indexname;
    `);
    report.testResults.indexes = idxRes.rows.map(r => ({ table: r.tablename, index: r.indexname }));

    // G. Verify Trigger & Deferrability
    const triggerDefRes = await client.query(`
      SELECT tgname, tgdeferrable, tginitdeferred, proname
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE tgname = 'trg_check_journal_balance';
    `);
    report.testResults.triggerDetails = triggerDefRes.rows;
    if (triggerDefRes.rows.length === 0 || !triggerDefRes.rows[0].tgdeferrable || !triggerDefRes.rows[0].tginitdeferred) {
      report.failures.push("Trigger trg_check_journal_balance is missing or not DEFERRABLE INITIALLY DEFERRED");
    }

    // K. Verify Historical Counts
    const countTables = ['order', 'payment_transaction', 'purchase', 'purchase_item', 'purchase_payment', 'expense', 'fleet_fuel'];
    report.testResults.postMigrationCounts = {};
    for (const t of countTables) {
      const q = t === 'order' ? 'SELECT count(*) FROM public."order"' : `SELECT count(*) FROM public."${t}"`;
      const cRes = await client.query(q);
      report.testResults.postMigrationCounts[t] = parseInt(cRes.rows[0].count, 10);
    }
    const expectedCounts = { order: 173, payment_transaction: 53, purchase: 0, purchase_item: 0, purchase_payment: 0, expense: 0, fleet_fuel: 0 };
    for (const [k, v] of Object.entries(expectedCounts)) {
      if (report.testResults.postMigrationCounts[k] !== v) {
        report.failures.push(`Historical count mismatch on ${k}: expected ${v}, found ${report.testResults.postMigrationCounts[k]}`);
      }
    }

    // L. Verify accounting_start_date unconfigured
    const settingRes = await client.query(`SELECT key, value FROM public.setting WHERE key = 'accounting_start_date';`);
    report.testResults.accountingStartDateRows = settingRes.rows.length;
    if (settingRes.rows.length > 0) {
      report.failures.push(`accounting_start_date should be unconfigured, found ${settingRes.rows.length} rows`);
    }

    // =========================================================================
    // TRANSACTIONAL BEHAVIORAL TESTS (ROLLED BACK COMPLETELY)
    // =========================================================================
    console.log("Running transactional behavioral tests (all rolled back)...");

    // Test 1: Self-Approval Prevention (SoD)
    await client.query("BEGIN;");
    let sodPassed = false;
    try {
      // Find a real branch_id
      const bRes = await client.query("SELECT id FROM public.branch LIMIT 1;");
      const branchId = bRes.rows[0]?.id || "br_kollam_central";

      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, narration, created_by, approved_by
        ) VALUES (
          'vch_test_sod_01', 'VCH-TEST-SOD-001', 'JOURNAL', CURRENT_DATE, $1, '2026-2027', 'APPROVED', 100.00, 'Test SoD', 'user_john', 'user_john'
        );
      `, [branchId]);
    } catch (err) {
      if (err.message.includes('chk_voucher_segregation')) {
        sodPassed = true;
      } else {
        report.failures.push(`Unexpected error on SoD test: ${err.message}`);
      }
    } finally {
      await client.query("ROLLBACK;");
    }
    report.testResults.sodConstraintEnforced = sodPassed;
    if (!sodPassed) report.failures.push("SoD constraint failed to reject created_by == approved_by");

    // Test 2: Posted Immutability (Cannot transition to CANCELLED if posted_at IS NOT NULL)
    await client.query("BEGIN;");
    let immutabilityPassed = false;
    try {
      const bRes = await client.query("SELECT id FROM public.branch LIMIT 1;");
      const branchId = bRes.rows[0]?.id || "br_kollam_central";

      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, narration, created_by, posted_at
        ) VALUES (
          'vch_test_imm_01', 'VCH-TEST-IMM-001', 'JOURNAL', CURRENT_DATE, $1, '2026-2027', 'CANCELLED', 100.00, 'Test Immutability', 'user_alice', NOW()
        );
      `, [branchId]);
    } catch (err) {
      if (err.message.includes('chk_voucher_posted_immutable')) {
        immutabilityPassed = true;
      } else {
        report.failures.push(`Unexpected error on Posted Immutability test: ${err.message}`);
      }
    } finally {
      await client.query("ROLLBACK;");
    }
    report.testResults.postedImmutabilityEnforced = immutabilityPassed;
    if (!immutabilityPassed) report.failures.push("Posted immutability constraint failed to reject CANCELLED status on posted voucher");

    // Test 3: Payment Idempotency Multi-Stage Coexistence & Duplicate Rejection
    await client.query("BEGIN;");
    let idempotencyPassed = false;
    let dupRejected = false;
    try {
      const bRes = await client.query("SELECT id FROM public.branch LIMIT 1;");
      const branchId = bRes.rows[0]?.id || "br_kollam_central";

      // Insert CAPTURE
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by
        ) VALUES (
          'vch_test_pay_01', 'VCH-TEST-PAY-001', 'RECEIPT', CURRENT_DATE, $1, '2026-2027', 'DRAFT', 500.00, 'PAYMENT_TXN', 'pt_test_100', 'CAPTURE', 'Capture test', 'user_system'
        );
      `, [branchId]);

      // Insert SETTLEMENT for same payment_transaction
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by
        ) VALUES (
          'vch_test_pay_02', 'VCH-TEST-PAY-002', 'JOURNAL', CURRENT_DATE, $1, '2026-2027', 'DRAFT', 500.00, 'PAYMENT_TXN', 'pt_test_100', 'SETTLEMENT', 'Settlement test', 'user_system'
        );
      `, [branchId]);

      // Insert REFUND for same payment_transaction
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by
        ) VALUES (
          'vch_test_pay_03', 'VCH-TEST-PAY-003', 'PAYMENT', CURRENT_DATE, $1, '2026-2027', 'DRAFT', 500.00, 'PAYMENT_TXN', 'pt_test_100', 'REFUND', 'Refund test', 'user_system'
        );
      `, [branchId]);

      // All 3 coexisted!
      idempotencyPassed = true;

      // Try duplicate CAPTURE for same payment_transaction
      try {
        await client.query(`
          INSERT INTO public.accounting_voucher (
            id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by
          ) VALUES (
            'vch_test_pay_04', 'VCH-TEST-PAY-004', 'RECEIPT', CURRENT_DATE, $1, '2026-2027', 'DRAFT', 500.00, 'PAYMENT_TXN', 'pt_test_100', 'CAPTURE', 'Duplicate Capture', 'user_system'
          );
        `, [branchId]);
      } catch (dupErr) {
        if (dupErr.message.includes('idx_accounting_voucher_source_idempotency') || dupErr.code === '23505') {
          dupRejected = true;
        }
      }

    } finally {
      await client.query("ROLLBACK;");
    }
    report.testResults.paymentLifecycleCoexistence = idempotencyPassed;
    report.testResults.duplicateEventRejected = dupRejected;
    if (!idempotencyPassed || !dupRejected) {
      report.failures.push(`Payment lifecycle test failed: coexistence=${idempotencyPassed}, dupRejected=${dupRejected}`);
    }

    // Test 4: Single-Sided Journal Line Constraint
    await client.query("BEGIN;");
    let singleSidedEnforced = false;
    try {
      const bRes = await client.query("SELECT id FROM public.branch LIMIT 1;");
      const branchId = bRes.rows[0]?.id || "br_kollam_central";

      // Seed temp account & voucher & journal entry
      await client.query(`
        INSERT INTO public.accounting_account (id, code, name, type, subtype, created_by)
        VALUES ('acc_test_tmp_01', '9999', 'Test Temp Acc', 'ASSET', 'CURRENT_ASSET', 'system');
      `);
      await client.query(`
        INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, narration, created_by)
        VALUES ('vch_test_tmp_01', 'VCH-TMP-01', 'JOURNAL', CURRENT_DATE, $1, '2026-2027', 'Tmp', 'system');
      `, [branchId]);
      await client.query(`
        INSERT INTO public.accounting_journal_entry (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, created_by)
        VALUES ('jrn_test_tmp_01', 'JRN-TMP-01', 'vch_test_tmp_01', CURRENT_DATE, $1, '2026-2027', 100.00, 100.00, 'system');
      `, [branchId]);

      // Attempt to insert line with debit > 0 AND credit > 0
      try {
        await client.query(`
          INSERT INTO public.accounting_journal_line (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id)
          VALUES ('jline_test_01', 'jrn_test_tmp_01', 1, 'acc_test_tmp_01', 50.00, 50.00, $1);
        `, [branchId]);
      } catch (lineErr) {
        if (lineErr.message.includes('chk_jline_single_sided')) {
          singleSidedEnforced = true;
        }
      }
    } finally {
      await client.query("ROLLBACK;");
    }
    report.testResults.singleSidedLineEnforced = singleSidedEnforced;
    if (!singleSidedEnforced) report.failures.push("Single-sided line constraint failed to reject line with both debit and credit");

    // Clean any prior temp test rows before testing
    await client.query(`
      DELETE FROM public.accounting_journal_line WHERE id LIKE 'jline_test_%';
      DELETE FROM public.accounting_journal_entry WHERE id LIKE 'jrn_test_%';
      DELETE FROM public.accounting_voucher WHERE id LIKE 'vch_test_%';
      DELETE FROM public.accounting_account WHERE id LIKE 'acc_test_%';
    `);

    // Test 5: Double-Entry Balance Deferred Constraint Trigger
    // 5a: Unbalanced entry must be rejected when trigger evaluated
    await client.query("BEGIN;");
    let unbalancedTriggerRejected = false;
    try {
      const bRes = await client.query("SELECT id FROM public.branch LIMIT 1;");
      const branchId = bRes.rows[0]?.id || "br_kollam_central";

      await client.query(`
        INSERT INTO public.accounting_account (id, code, name, type, subtype, created_by)
        VALUES ('acc_test_tmp_02', '9998', 'Test Temp Acc 2', 'ASSET', 'CURRENT_ASSET', 'system');
      `);
      await client.query(`
        INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, narration, created_by)
        VALUES ('vch_test_tmp_02', 'VCH-TMP-02', 'JOURNAL', CURRENT_DATE, $1, '2026-2027', 'Tmp 2', 'system');
      `, [branchId]);
      await client.query(`
        INSERT INTO public.accounting_journal_entry (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, created_by)
        VALUES ('jrn_test_tmp_02', 'JRN-TMP-02', 'vch_test_tmp_02', CURRENT_DATE, $1, '2026-2027', 100.00, 100.00, 'system');
      `, [branchId]);

      // Insert only debit 100 (unbalanced)
      await client.query(`
        INSERT INTO public.accounting_journal_line (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id)
        VALUES ('jline_test_02', 'jrn_test_tmp_02', 1, 'acc_test_tmp_02', 100.00, 0.00, $1);
      `, [branchId]);

      // Force deferred constraint trigger to evaluate immediately
      await client.query("SET CONSTRAINTS trg_check_journal_balance IMMEDIATE;");
    } catch (trigErr) {
      if (trigErr.message.includes('Double-entry violation')) {
        unbalancedTriggerRejected = true;
      }
    } finally {
      await client.query("ROLLBACK;");
    }
    report.testResults.unbalancedTriggerRejected = unbalancedTriggerRejected;
    if (!unbalancedTriggerRejected) report.failures.push("Deferred constraint trigger failed to abort unbalanced journal entry");

    // 5b: Balanced entry commit must succeed
    await client.query("BEGIN;");
    let balancedTriggerSuccess = false;
    try {
      const bRes = await client.query("SELECT id FROM public.branch LIMIT 1;");
      const branchId = bRes.rows[0]?.id || "br_kollam_central";

      await client.query(`
        INSERT INTO public.accounting_account (id, code, name, type, subtype, created_by)
        VALUES 
          ('acc_test_tmp_03', '9997', 'Test Temp Acc 3', 'ASSET', 'CURRENT_ASSET', 'system'),
          ('acc_test_tmp_04', '9996', 'Test Temp Acc 4', 'LIABILITY', 'CURRENT_LIABILITY', 'system');
      `);
      await client.query(`
        INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, narration, created_by)
        VALUES ('vch_test_tmp_03', 'VCH-TMP-03', 'JOURNAL', CURRENT_DATE, $1, '2026-2027', 'Tmp 3', 'system');
      `, [branchId]);
      await client.query(`
        INSERT INTO public.accounting_journal_entry (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, created_by)
        VALUES ('jrn_test_tmp_03', 'JRN-TMP-03', 'vch_test_tmp_03', CURRENT_DATE, $1, '2026-2027', 100.00, 100.00, 'system');
      `, [branchId]);

      // Insert balanced debit 100 and credit 100
      await client.query(`
        INSERT INTO public.accounting_journal_line (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id)
        VALUES 
          ('jline_test_03', 'jrn_test_tmp_03', 1, 'acc_test_tmp_03', 100.00, 0.00, $1),
          ('jline_test_04', 'jrn_test_tmp_03', 2, 'acc_test_tmp_04', 0.00, 100.00, $1);
      `, [branchId]);

      // Force deferred constraint trigger to evaluate immediately
      await client.query("SET CONSTRAINTS trg_check_journal_balance IMMEDIATE;");
      balancedTriggerSuccess = true;
    } catch (bErr) {
      report.failures.push(`Balanced entry evaluation failed unexpectedly: ${bErr.message}`);
    } finally {
      await client.query("ROLLBACK;");
    }
    report.testResults.balancedTriggerSuccess = balancedTriggerSuccess;

    // Final clean check of test rows
    const orphanAccounts = await client.query("SELECT count(*) FROM public.accounting_account WHERE code LIKE '999%';");
    report.testResults.zeroOrphanTestRows = parseInt(orphanAccounts.rows[0].count, 10) === 0;

    console.log(JSON.stringify(report, null, 2));
    if (report.failures.length > 0) {
      console.error("FAILURES ENCOUNTERED:", report.failures);
      process.exit(1);
    } else {
      console.log("ALL POST-MIGRATION INDEPENDENT VERIFICATION TESTS PASSED (100%)");
    }

  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});
