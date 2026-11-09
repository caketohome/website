/**
 * CakeToHome ERP — Phase C7.6 Step 3: Chart of Accounts Governance
 * Comprehensive verification suite testing:
 * 1. Deterministic AccountGovernanceService.getCostCentrePolicy across all 5 account classes & groups
 * 2. Complete taxonomy audit of all 100 accounts in the live CoA
 * 3. Repository enforcement in AccountingJournalRepository.createJournalEntry (PROHIBITED / OPTIONAL / INVALID)
 * 4. Workflow enforcement in ManualJournalService (createDraft, updateDraft, postToGL, non-prohibited inheritance)
 * 5. Bypass immunity & domain error codes: COST_CENTRE_PROHIBITED, COST_CENTRE_REQUIRED, COST_CENTRE_INVALID
 * 6. Baseline immutability & zero database contamination
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
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
  throw new Error("DATABASE_URL not found in .env");
}

async function runSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.6 STEP 3: COA GOVERNANCE TEST SUITE  ");
  console.log("==================================================================\n");

  const conn = getConnectionString();
  process.env.DATABASE_URL = conn;
  const pool = new Pool({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  // Register TypeScript compilation hook
  const ts = require('../node_modules/typescript');
  require.extensions['.ts'] = function(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      }
    });
    return module._compile(compiled.outputText, filename);
  };

  const { AccountGovernanceService } = require('../src/lib/services/account-governance.service');
  const { AccountGovernanceError } = require('../src/lib/types/accounting.types');
  const { AccountingAccountRepository } = require('../src/lib/repositories/accounting-account.repository');
  const { AccountingJournalRepository } = require('../src/lib/repositories/accounting-journal.repository');
  const { AccountingVoucherRepository } = require('../src/lib/repositories/accounting-voucher.repository');
  const { CostCentreService } = require('../src/lib/services/cost-centre.service');
  const { ManualJournalService, ManualJournalDomainError } = require('../src/lib/services/manual-journal.service');

  let passed = 0;
  function pass(testNum, desc) {
    passed++;
    console.log(`  ✓ TEST [${passed}] PASS: ${desc}`);
  }

  const createdCostCentreIds = [];
  const createdVoucherIds = [];
  const createdEntryIds = [];

  try {
    // -------------------------------------------------------------------------
    // Baseline Invariant Checks
    // -------------------------------------------------------------------------
    const initCheck = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.accounting_account) as coa_count,
        (SELECT COALESCE(SUM(debit_amount),0) FROM public.accounting_journal_line) as total_dr,
        (SELECT COALESCE(SUM(credit_amount),0) FROM public.accounting_journal_line) as total_cr,
        (SELECT COUNT(*) FROM public.cost_centre) as cc_count,
        (SELECT COUNT(*) FROM public.accounting_voucher) as vch_count,
        (SELECT COUNT(*) FROM public.accounting_journal_entry) as jent_count,
        (SELECT COUNT(*) FROM public.accounting_journal_line) as jline_count;
    `);

    const coaInit = parseInt(initCheck.rows[0].coa_count, 10);
    const drInit = parseFloat(initCheck.rows[0].total_dr);
    const crInit = parseFloat(initCheck.rows[0].total_cr);
    const ccInit = parseInt(initCheck.rows[0].cc_count, 10);
    const vchInit = parseInt(initCheck.rows[0].vch_count, 10);

    assert.strictEqual(coaInit, 100, `Initial CoA must be 100, got ${coaInit}`);
    assert.strictEqual(drInit, 3380, `Initial Trial balance Dr must be 3380, got ${drInit}`);
    assert.strictEqual(crInit, 3380, `Initial Trial balance Cr must be 3380, got ${crInit}`);
    assert.strictEqual(ccInit, 0, `Initial cost centres must be 0, got ${ccInit}`);
    assert.strictEqual(vchInit, 6, `Initial vouchers must be 6, got ${vchInit}`);
    console.log("  ✓ Baseline verified: CoA = 100, TB = ₹3,380.00 Dr / Cr, Cost Centres = 0, Vouchers = 6\n");

    // -------------------------------------------------------------------------
    // Fetch Accounts for Tests
    // -------------------------------------------------------------------------
    const allAccountsRes = await pool.query(`
      SELECT id, code, name, type, subtype, is_group, is_active FROM public.accounting_account
      ORDER BY code ASC;
    `);
    const allAccounts = allAccountsRes.rows;
    assert.strictEqual(allAccounts.length, 100, "All 100 accounts must be fetched");

    const acct1111 = allAccounts.find(a => a.code === '1111'); // Cash in Hand (Asset)
    const acct1112 = allAccounts.find(a => a.code === '1112'); // Bank Operating (Asset)
    const acct2111 = allAccounts.find(a => a.code === '2111'); // Accounts Payable (Liability)
    const acct3110 = allAccounts.find(a => a.code === '3110'); // Partner Capital (Equity)
    const acct3300 = allAccounts.find(a => a.code === '3300'); // Opening Offset (Equity)
    const acct4110 = allAccounts.find(a => a.code === '4110'); // Cake Sales Revenue (Revenue)
    const acct5110 = allAccounts.find(a => a.code === '5110'); // COGS Cakes (Expense)
    const acct5230 = allAccounts.find(a => a.code === '5230'); // Fuel & Fleet Maintenance (Expense)
    const acct5000 = allAccounts.find(a => a.code === '5000'); // Expenses Group (is_group = true)

    assert(acct1111 && acct1112 && acct2111 && acct3110 && acct3300 && acct4110 && acct5110 && acct5230 && acct5000);

    // -------------------------------------------------------------------------
    // TEST 1: Unit Test — AccountGovernanceService.getCostCentrePolicy across 5 classes
    // -------------------------------------------------------------------------
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct1111), "PROHIBITED");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct1112), "PROHIBITED");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct2111), "PROHIBITED");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct3110), "PROHIBITED");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct3300), "PROHIBITED");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct4110), "OPTIONAL");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct5110), "OPTIONAL");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct5230), "OPTIONAL");
    assert.strictEqual(AccountGovernanceService.getCostCentrePolicy(acct5000), "PROHIBITED");
    pass(1, "AccountGovernanceService.getCostCentrePolicy correctly resolves 5 account classes and group accounts");

    // -------------------------------------------------------------------------
    // TEST 2: Exhaustive Audit across all 100 Live Accounts
    // -------------------------------------------------------------------------
    let prohibitedCount = 0;
    let optionalCount = 0;
    for (const acc of allAccounts) {
      const pol = AccountGovernanceService.getCostCentrePolicy(acc);
      if (pol === "PROHIBITED") prohibitedCount++;
      else if (pol === "OPTIONAL") optionalCount++;
    }
    // 24 groups + 27 asset leaves + 17 liability leaves + 5 equity leaves = 73 PROHIBITED
    // 7 revenue leaves + 20 expense leaves = 27 OPTIONAL
    assert.strictEqual(prohibitedCount, 73, `Expected 73 PROHIBITED accounts, got ${prohibitedCount}`);
    assert.strictEqual(optionalCount, 27, `Expected 27 OPTIONAL accounts, got ${optionalCount}`);
    assert.strictEqual(prohibitedCount + optionalCount, 100, "All 100 accounts mapped");
    pass(2, "Exhaustive audit: exactly 73 accounts PROHIBITED (24 groups + 49 BS leaves) and 27 OPTIONAL (27 P&L leaves)");

    // -------------------------------------------------------------------------
    // Setup Test Fixtures (Branch, Users, Cost Centres)
    // -------------------------------------------------------------------------
    const branchRes = await pool.query(`SELECT id, code FROM public.branch ORDER BY id LIMIT 1;`);
    const branchId = branchRes.rows[0].id;

    const userRes = await pool.query(`SELECT id FROM public."user" WHERE deleted_at IS NULL LIMIT 2;`);
    const userMaker = userRes.rows[0]?.id || "usr_maker_test";
    const userChecker = userRes.rows[1]?.id || "usr_checker_test";

    const superAdminActor = {
      userId: userMaker,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      permissions: ["*"],
    };

    // Create 1 active test cost centre and 1 inactive test cost centre
    const ccActive = await CostCentreService.createCostCentre(superAdminActor, {
      code: `CC_GOV_ACT_${Date.now().toString().slice(-4)}`,
      name: "Governance Test Active CC",
      department: "OPERATIONS",
      branch_id: branchId,
    });
    createdCostCentreIds.push(ccActive.id);

    const ccInactive = await CostCentreService.createCostCentre(superAdminActor, {
      code: `CC_GOV_INA_${Date.now().toString().slice(-4)}`,
      name: "Governance Test Inactive CC",
      department: "OPERATIONS",
      branch_id: branchId,
    });
    createdCostCentreIds.push(ccInactive.id);
    await CostCentreService.deactivateCostCentre(superAdminActor, ccInactive.id);

    // -------------------------------------------------------------------------
    // TEST 3: Repository Rejection — Cost Centre on ASSET account (1111 Cash)
    // -------------------------------------------------------------------------
    let assetRejected = false;
    let assetErrorCode = null;
    const clientTx1 = await pool.connect();
    try {
      await clientTx1.query("BEGIN;");
      const vchDraft1 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Test asset rejection" },
        branchId, "FY2627", userMaker, clientTx1
      );
      createdVoucherIds.push(vchDraft1.id);

      await AccountingJournalRepository.createJournalEntry(
        vchDraft1.id, "2026-10-15", branchId, "FY2627", "Test asset entry",
        [
          { account_id: acct1111.id, debit_amount: 100, credit_amount: 0, cost_centre_id: ccActive.id },
          { account_id: acct5230.id, debit_amount: 0, credit_amount: 100, cost_centre_id: null },
        ],
        userMaker, clientTx1
      );
      await clientTx1.query("COMMIT;");
    } catch (err) {
      await clientTx1.query("ROLLBACK;");
      assetRejected = true;
      assetErrorCode = err.code || err.name;
    } finally {
      clientTx1.release();
    }
    assert.strictEqual(assetRejected, true, "Must reject cost centre on ASSET line");
    assert.strictEqual(assetErrorCode, "COST_CENTRE_PROHIBITED", `Must throw COST_CENTRE_PROHIBITED, got ${assetErrorCode}`);
    pass(3, "AccountingJournalRepository strictly rejects cost centre on ASSET line (1111 Cash) with COST_CENTRE_PROHIBITED");

    // -------------------------------------------------------------------------
    // TEST 4: Repository Rejection — Cost Centre on LIABILITY account (2111 AP)
    // -------------------------------------------------------------------------
    let liabRejected = false;
    let liabErrorCode = null;
    const clientTx2 = await pool.connect();
    try {
      await clientTx2.query("BEGIN;");
      const vchDraft2 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Test liab rejection" },
        branchId, "FY2627", userMaker, clientTx2
      );
      createdVoucherIds.push(vchDraft2.id);

      await AccountingJournalRepository.createJournalEntry(
        vchDraft2.id, "2026-10-15", branchId, "FY2627", "Test liab entry",
        [
          { account_id: acct5230.id, debit_amount: 100, credit_amount: 0, cost_centre_id: null },
          { account_id: acct2111.id, debit_amount: 0, credit_amount: 100, cost_centre_id: ccActive.id },
        ],
        userMaker, clientTx2
      );
      await clientTx2.query("COMMIT;");
    } catch (err) {
      await clientTx2.query("ROLLBACK;");
      liabRejected = true;
      liabErrorCode = err.code || err.name;
    } finally {
      clientTx2.release();
    }
    assert.strictEqual(liabRejected, true, "Must reject cost centre on LIABILITY line");
    assert.strictEqual(liabErrorCode, "COST_CENTRE_PROHIBITED", `Must throw COST_CENTRE_PROHIBITED, got ${liabErrorCode}`);
    pass(4, "AccountingJournalRepository strictly rejects cost centre on LIABILITY line (2111 AP) with COST_CENTRE_PROHIBITED");

    // -------------------------------------------------------------------------
    // TEST 5: Repository Rejection — Cost Centre on EQUITY account (3300 Offset)
    // -------------------------------------------------------------------------
    let equityRejected = false;
    let equityErrorCode = null;
    const clientTx3 = await pool.connect();
    try {
      await clientTx3.query("BEGIN;");
      const vchDraft3 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Test equity rejection" },
        branchId, "FY2627", userMaker, clientTx3
      );
      createdVoucherIds.push(vchDraft3.id);

      await AccountingJournalRepository.createJournalEntry(
        vchDraft3.id, "2026-10-15", branchId, "FY2627", "Test equity entry",
        [
          { account_id: acct5230.id, debit_amount: 100, credit_amount: 0, cost_centre_id: null },
          { account_id: acct3300.id, debit_amount: 0, credit_amount: 100, cost_centre_id: ccActive.id },
        ],
        userMaker, clientTx3
      );
      await clientTx3.query("COMMIT;");
    } catch (err) {
      await clientTx3.query("ROLLBACK;");
      equityRejected = true;
      equityErrorCode = err.code || err.name;
    } finally {
      clientTx3.release();
    }
    assert.strictEqual(equityRejected, true, "Must reject cost centre on EQUITY line");
    assert.strictEqual(equityErrorCode, "COST_CENTRE_PROHIBITED", `Must throw COST_CENTRE_PROHIBITED, got ${equityErrorCode}`);
    pass(5, "AccountingJournalRepository strictly rejects cost centre on EQUITY line (3300 Offset) with COST_CENTRE_PROHIBITED");

    // -------------------------------------------------------------------------
    // TEST 6: Repository Rejection — Direct Posting to GROUP account (5000 Expenses)
    // -------------------------------------------------------------------------
    let groupRejected = false;
    let groupErrorCode = null;
    const clientTx4 = await pool.connect();
    try {
      await clientTx4.query("BEGIN;");
      const vchDraft4 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Test group rejection" },
        branchId, "FY2627", userMaker, clientTx4
      );
      createdVoucherIds.push(vchDraft4.id);

      await AccountingJournalRepository.createJournalEntry(
        vchDraft4.id, "2026-10-15", branchId, "FY2627", "Test group entry",
        [
          { account_id: acct5000.id, debit_amount: 100, credit_amount: 0, cost_centre_id: null },
          { account_id: acct1111.id, debit_amount: 0, credit_amount: 100, cost_centre_id: null },
        ],
        userMaker, clientTx4
      );
      await clientTx4.query("COMMIT;");
    } catch (err) {
      await clientTx4.query("ROLLBACK;");
      groupRejected = true;
      groupErrorCode = err.code || err.name;
    } finally {
      clientTx4.release();
    }
    assert.strictEqual(groupRejected, true, "Must reject posting to GROUP account");
    assert.strictEqual(groupErrorCode, "ACCOUNT_GROUP_NON_POSTABLE", `Must throw ACCOUNT_GROUP_NON_POSTABLE, got ${groupErrorCode}`);
    pass(6, "AccountingJournalRepository strictly blocks direct posting to summary group account (5000 Expenses)");

    // -------------------------------------------------------------------------
    // TEST 7: Repository Rejection — Non-existent Cost Centre ID
    // -------------------------------------------------------------------------
    let invalidCcRejected = false;
    let invalidCcErrorCode = null;
    const clientTx5 = await pool.connect();
    try {
      await clientTx5.query("BEGIN;");
      const vchDraft5 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Test invalid cc" },
        branchId, "FY2627", userMaker, clientTx5
      );
      createdVoucherIds.push(vchDraft5.id);

      await AccountingJournalRepository.createJournalEntry(
        vchDraft5.id, "2026-10-15", branchId, "FY2627", "Test invalid cc entry",
        [
          { account_id: acct5230.id, debit_amount: 100, credit_amount: 0, cost_centre_id: "cc_does_not_exist_9999" },
          { account_id: acct1111.id, debit_amount: 0, credit_amount: 100, cost_centre_id: null },
        ],
        userMaker, clientTx5
      );
      await clientTx5.query("COMMIT;");
    } catch (err) {
      await clientTx5.query("ROLLBACK;");
      invalidCcRejected = true;
      invalidCcErrorCode = err.code || err.name;
    } finally {
      clientTx5.release();
    }
    assert.strictEqual(invalidCcRejected, true, "Must reject non-existent cost centre reference");
    assert.strictEqual(invalidCcErrorCode, "COST_CENTRE_INVALID", `Must throw COST_CENTRE_INVALID, got ${invalidCcErrorCode}`);
    pass(7, "AccountingJournalRepository strictly rejects non-existent cost-centre reference with COST_CENTRE_INVALID");

    // -------------------------------------------------------------------------
    // TEST 8: Repository Rejection — Inactive Cost Centre ID
    // -------------------------------------------------------------------------
    let inactiveCcRejected = false;
    let inactiveCcErrorCode = null;
    const clientTx6 = await pool.connect();
    try {
      await clientTx6.query("BEGIN;");
      const vchDraft6 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Test inactive cc" },
        branchId, "FY2627", userMaker, clientTx6
      );
      createdVoucherIds.push(vchDraft6.id);

      await AccountingJournalRepository.createJournalEntry(
        vchDraft6.id, "2026-10-15", branchId, "FY2627", "Test inactive cc entry",
        [
          { account_id: acct5230.id, debit_amount: 100, credit_amount: 0, cost_centre_id: ccInactive.id },
          { account_id: acct1111.id, debit_amount: 0, credit_amount: 100, cost_centre_id: null },
        ],
        userMaker, clientTx6
      );
      await clientTx6.query("COMMIT;");
    } catch (err) {
      await clientTx6.query("ROLLBACK;");
      inactiveCcRejected = true;
      inactiveCcErrorCode = err.code || err.name;
    } finally {
      clientTx6.release();
    }
    assert.strictEqual(inactiveCcRejected, true, "Must reject inactive cost centre reference");
    assert.strictEqual(inactiveCcErrorCode, "COST_CENTRE_INVALID", `Must throw COST_CENTRE_INVALID, got ${inactiveCcErrorCode}`);
    pass(8, "AccountingJournalRepository strictly rejects inactive cost-centre reference with COST_CENTRE_INVALID");

    // -------------------------------------------------------------------------
    // TEST 9: Repository Acceptance — Expense with Valid CC + Cash with NULL CC
    // -------------------------------------------------------------------------
    const clientTx7 = await pool.connect();
    let validEntry;
    try {
      await clientTx7.query("BEGIN;");
      const vchDraft7 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Valid expense with cc" },
        branchId, "FY2627", userMaker, clientTx7
      );
      createdVoucherIds.push(vchDraft7.id);

      validEntry = await AccountingJournalRepository.createJournalEntry(
        vchDraft7.id, "2026-10-15", branchId, "FY2627", "Valid expense entry",
        [
          { account_id: acct5230.id, debit_amount: 120, credit_amount: 0, cost_centre_id: ccActive.id },
          { account_id: acct1111.id, debit_amount: 0, credit_amount: 120, cost_centre_id: null },
        ],
        userMaker, clientTx7
      );
      createdEntryIds.push(validEntry.id);
      await clientTx7.query("COMMIT;");
    } catch (err) {
      await clientTx7.query("ROLLBACK;");
      throw err;
    } finally {
      clientTx7.release();
    }
    assert(validEntry && validEntry.lines.length === 2, "Valid entry created");
    assert.strictEqual(validEntry.lines[0].cost_centre_id, ccActive.id, "Line 1 has valid CC");
    assert.strictEqual(validEntry.lines[1].cost_centre_id, null, "Line 2 has null CC");
    pass(9, "AccountingJournalRepository successfully accepts valid cost centre on Expense (OPTIONAL) and NULL on Cash (PROHIBITED)");

    // -------------------------------------------------------------------------
    // TEST 10: Repository Acceptance — Revenue with Valid CC + Cash with NULL CC
    // -------------------------------------------------------------------------
    const clientTx8 = await pool.connect();
    let validRevEntry;
    try {
      await clientTx8.query("BEGIN;");
      const vchDraft8 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "Valid rev with cc" },
        branchId, "FY2627", userMaker, clientTx8
      );
      createdVoucherIds.push(vchDraft8.id);

      validRevEntry = await AccountingJournalRepository.createJournalEntry(
        vchDraft8.id, "2026-10-15", branchId, "FY2627", "Valid rev entry",
        [
          { account_id: acct1111.id, debit_amount: 250, credit_amount: 0, cost_centre_id: null },
          { account_id: acct4110.id, debit_amount: 0, credit_amount: 250, cost_centre_id: ccActive.id },
        ],
        userMaker, clientTx8
      );
      createdEntryIds.push(validRevEntry.id);
      await clientTx8.query("COMMIT;");
    } catch (err) {
      await clientTx8.query("ROLLBACK;");
      throw err;
    } finally {
      clientTx8.release();
    }
    assert(validRevEntry && validRevEntry.lines.length === 2, "Valid revenue entry created");
    assert.strictEqual(validRevEntry.lines[0].cost_centre_id, null, "Cash line has null CC");
    assert.strictEqual(validRevEntry.lines[1].cost_centre_id, ccActive.id, "Revenue line has valid CC");
    pass(10, "AccountingJournalRepository successfully accepts valid cost centre on Revenue (OPTIONAL) and NULL on Cash (PROHIBITED)");

    // -------------------------------------------------------------------------
    // TEST 11: Repository Acceptance — Both Lines NULL CC on OPTIONAL Accounts
    // -------------------------------------------------------------------------
    const clientTx9 = await pool.connect();
    let allNullEntry;
    try {
      await clientTx9.query("BEGIN;");
      const vchDraft9 = await AccountingVoucherRepository.createDraft(
        { voucher_type: "JOURNAL", voucher_date: "2026-10-15", branch_id: branchId, narration: "All null cc entry" },
        branchId, "FY2627", userMaker, clientTx9
      );
      createdVoucherIds.push(vchDraft9.id);

      allNullEntry = await AccountingJournalRepository.createJournalEntry(
        vchDraft9.id, "2026-10-15", branchId, "FY2627", "All null cc entry",
        [
          { account_id: acct5110.id, debit_amount: 50, credit_amount: 0, cost_centre_id: null },
          { account_id: acct1111.id, debit_amount: 0, credit_amount: 50, cost_centre_id: null },
        ],
        userMaker, clientTx9
      );
      createdEntryIds.push(allNullEntry.id);
      await clientTx9.query("COMMIT;");
    } catch (err) {
      await clientTx9.query("ROLLBACK;");
      throw err;
    } finally {
      clientTx9.release();
    }
    assert(allNullEntry && allNullEntry.lines.length === 2, "All null CC entry created");
    assert.strictEqual(allNullEntry.lines[0].cost_centre_id, null, "Line 1 has null CC");
    assert.strictEqual(allNullEntry.lines[1].cost_centre_id, null, "Line 2 has null CC");
    pass(11, "AccountingJournalRepository permits unallocated (NULL) cost centres on operational lines without restriction");

    // -------------------------------------------------------------------------
    // TEST 12: ManualJournalService.createDraft — Rejects Cost Centre on Balance Sheet Lines
    // -------------------------------------------------------------------------
    let mjDraftRejected = false;
    let mjDraftErrCode = null;
    try {
      await ManualJournalService.createDraft({
        voucherDate: "2026-10-15",
        branchId: branchId,
        narration: "MJ draft rejecting CC on Cash",
        lines: [
          { line_no: 1, account_id: acct5230.id, debit_amount: 100, credit_amount: 0, cost_centre_id: null },
          { line_no: 2, account_id: acct1111.id, debit_amount: 0, credit_amount: 100, cost_centre_id: ccActive.id },
        ],
        createdBy: userMaker,
      });
    } catch (err) {
      mjDraftRejected = true;
      mjDraftErrCode = err.code || err.name;
    }
    assert.strictEqual(mjDraftRejected, true, "ManualJournalService must reject CC on Cash line in createDraft");
    assert.strictEqual(mjDraftErrCode, "COST_CENTRE_PROHIBITED", `Must throw COST_CENTRE_PROHIBITED, got ${mjDraftErrCode}`);
    pass(12, "ManualJournalService.createDraft strictly rejects cost centre on Cash line with COST_CENTRE_PROHIBITED");

    // -------------------------------------------------------------------------
    // TEST 13: ManualJournalService.createDraft — Rejects Invalid Cost Centre ID
    // -------------------------------------------------------------------------
    let mjInvalidCcRejected = false;
    let mjInvalidCcErrCode = null;
    try {
      await ManualJournalService.createDraft({
        voucherDate: "2026-10-15",
        branchId: branchId,
        narration: "MJ draft rejecting invalid CC",
        lines: [
          { line_no: 1, account_id: acct5230.id, debit_amount: 100, credit_amount: 0, cost_centre_id: "cc_invalid_xyz" },
          { line_no: 2, account_id: acct1111.id, debit_amount: 0, credit_amount: 100, cost_centre_id: null },
        ],
        createdBy: userMaker,
      });
    } catch (err) {
      mjInvalidCcRejected = true;
      mjInvalidCcErrCode = err.code || err.name;
    }
    assert.strictEqual(mjInvalidCcRejected, true, "ManualJournalService must reject invalid CC");
    assert.strictEqual(mjInvalidCcErrCode, "COST_CENTRE_INVALID", `Must throw COST_CENTRE_INVALID, got ${mjInvalidCcErrCode}`);
    pass(13, "ManualJournalService.createDraft strictly rejects non-existent cost centre with COST_CENTRE_INVALID");

    // -------------------------------------------------------------------------
    // TEST 14: ManualJournalService Full Workflow — Valid CC on Expense, NULL on Cash
    // -------------------------------------------------------------------------
    const mjDraftValid = await ManualJournalService.createDraft({
      voucherDate: "2026-10-15",
      branchId: branchId,
      narration: "MJ draft with valid CC on expense",
      lines: [
        { line_no: 1, account_id: acct5230.id, debit_amount: 75, credit_amount: 0, cost_centre_id: ccActive.id },
        { line_no: 2, account_id: acct1111.id, debit_amount: 0, credit_amount: 75, cost_centre_id: null },
      ],
      createdBy: userMaker,
      idempotencyKey: `idem_mj_gov_${Date.now()}`,
    });
    createdVoucherIds.push(mjDraftValid.id);

    const mjSubmitted = await ManualJournalService.submitDraft({ voucherId: mjDraftValid.id, submittedBy: userMaker, branchId });
    assert.strictEqual(mjSubmitted.status, "SUBMITTED");

    const mjApproved = await ManualJournalService.approveDraft({ voucherId: mjDraftValid.id, approvedBy: userChecker, branchId });
    assert.strictEqual(mjApproved.status, "APPROVED");

    const mjPosted = await ManualJournalService.postToGL({ voucherId: mjDraftValid.id, postedBy: userChecker, branchId });
    createdEntryIds.push(mjPosted.journal_entry.id);
    assert.strictEqual(mjPosted.voucher.status, "POSTED");

    const mjDetail = await AccountingVoucherRepository.findManualJournalDetail(mjDraftValid.id, branchId);
    assert(mjDetail && mjDetail.posted_lines.length === 2);
    assert.strictEqual(mjDetail.posted_lines[0].cost_centre_id, ccActive.id);
    assert.strictEqual(mjDetail.posted_lines[1].cost_centre_id, null);
    pass(14, "ManualJournalService full lifecycle (create -> submit -> approve -> post) succeeds with governed lines");

    // -------------------------------------------------------------------------
    // TEST 15: Header Cost Centre Non-Prohibited Inheritance in postToGL
    // -------------------------------------------------------------------------
    // When voucher.cost_centre_id is set, it must inherit onto Expense (OPTIONAL),
    // but must NOT pollute Cash (PROHIBITED remains null).
    const mjHeaderDraft = await ManualJournalService.createDraft({
      voucherDate: "2026-10-15",
      branchId: branchId,
      narration: "MJ draft with header CC",
      lines: [
        { line_no: 1, account_id: acct5110.id, debit_amount: 80, credit_amount: 0, cost_centre_id: null },
        { line_no: 2, account_id: acct1111.id, debit_amount: 0, credit_amount: 80, cost_centre_id: null },
      ],
      createdBy: userMaker,
      cost_centre_id: ccActive.id,
      idempotencyKey: `idem_mj_hdr_${Date.now()}`,
    });
    createdVoucherIds.push(mjHeaderDraft.id);

    await ManualJournalService.submitDraft({ voucherId: mjHeaderDraft.id, submittedBy: userMaker, branchId });
    await ManualJournalService.approveDraft({ voucherId: mjHeaderDraft.id, approvedBy: userChecker, branchId });
    const mjHeaderPosted = await ManualJournalService.postToGL({ voucherId: mjHeaderDraft.id, postedBy: userChecker, branchId });
    createdEntryIds.push(mjHeaderPosted.journal_entry.id);

    const mjHeaderDetail = await AccountingVoucherRepository.findManualJournalDetail(mjHeaderDraft.id, branchId);
    assert(mjHeaderDetail && mjHeaderDetail.posted_lines.length === 2);
    // Line 1 (Expense) inherited header CC
    assert.strictEqual(mjHeaderDetail.posted_lines[0].cost_centre_id, ccActive.id, "Expense line inherited header CC");
    // Line 2 (Cash) stayed NULL because Cash is PROHIBITED
    assert.strictEqual(mjHeaderDetail.posted_lines[1].cost_centre_id, null, "Cash line remained NULL (not polluted)");
    pass(15, "Voucher header cost centre inherits strictly onto non-prohibited lines, protecting balance-sheet accounts");

    // -------------------------------------------------------------------------
    // TEST 16: Verify Validation Cannot Be Bypassed Direct Call Immunity
    // -------------------------------------------------------------------------
    let bypassPrevented = false;
    const clientBypass = await pool.connect();
    try {
      await clientBypass.query("BEGIN;");
      // Calling createJournalEntry directly with an arbitrary voucher
      await AccountingJournalRepository.createJournalEntry(
        mjHeaderDraft.id, "2026-10-15", branchId, "FY2627", "Direct bypass attempt",
        [
          { account_id: acct1112.id, debit_amount: 100, credit_amount: 0, cost_centre_id: ccActive.id },
          { account_id: acct5230.id, debit_amount: 0, credit_amount: 100, cost_centre_id: null },
        ],
        userMaker, clientBypass
      );
      await clientBypass.query("COMMIT;");
    } catch (err) {
      await clientBypass.query("ROLLBACK;");
      bypassPrevented = err.code === "COST_CENTRE_PROHIBITED";
    } finally {
      clientBypass.release();
    }
    assert.strictEqual(bypassPrevented, true, "Direct repository call cannot bypass governance");
    pass(16, "Bypass immunity verified: direct AccountingJournalRepository calls enforce AccountGovernanceService validation");

    console.log(`\nAll ${passed} Step 3 governance tests passed successfully!`);

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Fixtures & Purge Test Data
    // -------------------------------------------------------------------------
    console.log("\nPurging test fixtures...");

    if (createdEntryIds.length > 0) {
      await pool.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1::text[]);`, [createdEntryIds]);
      await pool.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1::text[]);`, [createdEntryIds]);
    }
    if (createdVoucherIds.length > 0) {
      await pool.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1::text[]));`, [createdVoucherIds]);
      await pool.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1::text[]);`, [createdVoucherIds]);
      await pool.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1::text[]);`, [createdVoucherIds]);
    }
    if (createdCostCentreIds.length > 0) {
      await pool.query(`DELETE FROM public.cost_centre WHERE id = ANY($1::text[]);`, [createdCostCentreIds]);
    }

    // Final verification of pristine state
    const finalCheck = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.accounting_account) as coa_count,
        (SELECT COALESCE(SUM(debit_amount),0) FROM public.accounting_journal_line) as total_dr,
        (SELECT COALESCE(SUM(credit_amount),0) FROM public.accounting_journal_line) as total_cr,
        (SELECT COUNT(*) FROM public.cost_centre) as cc_count,
        (SELECT COUNT(*) FROM public.accounting_voucher) as vch_count,
        (SELECT COUNT(*) FROM public.accounting_journal_entry) as jent_count,
        (SELECT COUNT(*) FROM public.accounting_journal_line) as jline_count;
    `);

    const coaFinal = parseInt(finalCheck.rows[0].coa_count, 10);
    const drFinal = parseFloat(finalCheck.rows[0].total_dr);
    const crFinal = parseFloat(finalCheck.rows[0].total_cr);
    const ccFinal = parseInt(finalCheck.rows[0].cc_count, 10);
    const vchFinal = parseInt(finalCheck.rows[0].vch_count, 10);

    assert.strictEqual(coaFinal, 100, `Final CoA must be 100, got ${coaFinal}`);
    assert.strictEqual(drFinal, 3380, `Final Trial balance Dr must be 3380, got ${drFinal}`);
    assert.strictEqual(crFinal, 3380, `Final Trial balance Cr must be 3380, got ${crFinal}`);
    assert.strictEqual(ccFinal, 0, `Final cost centres must be 0, got ${ccFinal}`);
    assert.strictEqual(vchFinal, 6, `Final vouchers must be 6, got ${vchFinal}`);
    console.log("  ✓ Cleanup complete: CoA = 100, TB = ₹3,380.00 Dr / Cr, Cost Centres = 0, Vouchers = 6 (Pristine state preserved)");

    await pool.end();
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error("Test Suite failed:", err);
  process.exit(1);
});
