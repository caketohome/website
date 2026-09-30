/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-B Test Suite
 * Bank Statement Import, Parsing & Ingestion Service
 *
 * TEST DOMAINS:
 * 1. Pre-test PostgreSQL baseline audit (pristine verification).
 * 2. Bank Account & Ingestion Validation Guards (existence, status, required fields).
 * 3. Standard CSV Parsing & Ingestion (separate Debit/Credit columns, value dates, running balance).
 * 4. Indian Banking Formats & Single Amount Column (HDFC/ICICI, DR/CR indicators, signed amounts).
 * 5. SWIFT MT940 & OFX / QFX File Parsers.
 * 6. Cryptographic Replay & Deduplication Protection (file SHA-256 and composite line hashes).
 * 7. Invariant Enforcement & Constraint Validation (negative amounts, double-sided, zero amounts).
 * 8. Atomic Transactional Rollback (all-or-nothing guarantee on invalid records).
 * 9. Repository Querying, Filtering & Import Lifecycle (listing, pagination, cancellation).
 * 10. Evidence-Only Accounting Verification & 100% Post-Test Teardown.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
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
  throw new Error("No database connection string found in environment or .env files");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-B Test Suite');
  console.log('Bank Statement Import, Parsing & Ingestion Service Verification');
  console.log('=============================================================================\n');

  // Register TypeScript transpile hook for .ts imports
  const ts = require('../node_modules/typescript');
  require.extensions['.ts'] = function(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      }
    });
    return module._compile(compiled.outputText, filename);
  };

  const { BankAccountRepository } = require('../src/lib/repositories/bank-account.repository');
  const { BankStatementImportRepository, BankStatementImportError } = require('../src/lib/repositories/bank-statement-import.repository');
  const { BankStatementImportService, BankStatementServiceError } = require('../src/lib/services/bank-statement-import.service');
  const { closeDbPool } = require('../src/lib/db');

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  // Fixture tracking for cleanup
  const createdBankAccountIds = [];
  const createdImportIds = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 0: Pre-test PostgreSQL Baseline Audit
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[0/10] Auditing pre-test PostgreSQL baseline...');

    const baselineChecks = {
      accounting_account: 99,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      bank_statement_import: 0,
      bank_statement_line: 0,
      bank_reconciliation_session: 0,
      bank_reconciliation_match: 0,
      bank_account: 0,
      order: 173,
      payment_transaction: 53,
    };

    for (const [table, expected] of Object.entries(baselineChecks)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM "order"' : `SELECT COUNT(*) FROM "${table}"`;
      const res = await client.query(q);
      const actual = parseInt(res.rows[0].count, 10);
      assert(actual === expected, `Pre-test ${table} === ${expected} (actual: ${actual})`);
    }

    // Create an ACTIVE test bank account
    const activeAccount = await BankAccountRepository.create({
      id: `ba_test_4105b_act_${Date.now()}`,
      bank_name: "HDFC Bank Operating",
      account_number_masked: "XXXX5678",
      ifsc_code: "HDFC0001234",
      status: "ACTIVE",
    }, client);
    createdBankAccountIds.push(activeAccount.id);

    // Create an INACTIVE test bank account
    const inactiveAccount = await BankAccountRepository.create({
      id: `ba_test_4105b_ina_${Date.now()}`,
      bank_name: "Old Closed Bank",
      account_number_masked: "XXXX9999",
      ifsc_code: "SBIN0004321",
      status: "INACTIVE",
    }, client);
    createdBankAccountIds.push(inactiveAccount.id);

    // Create a Second ACTIVE test bank account (for cross-account replay tests)
    const activeAccount2 = await BankAccountRepository.create({
      id: `ba_test_4105b_act2_${Date.now()}`,
      bank_name: "ICICI Bank Operating",
      account_number_masked: "XXXX7777",
      ifsc_code: "ICIC0005555",
      status: "ACTIVE",
    }, client);
    createdBankAccountIds.push(activeAccount2.id);

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 1: Bank Account & Ingestion Validation Guards
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[1/10] Verifying Bank Account & Ingestion Validation Guards...');

    // 1. Missing bankAccountId
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: "",
        sourceFilename: "statement.csv",
        fileContent: "Date,Description,Debit,Credit\n2026-09-01,Deposit,0,100",
        importedBy: "staff_01",
      });
      assert(false, "Missing bankAccountId should have been rejected");
    } catch (err) {
      assert(err instanceof BankStatementServiceError && err.code === "BANK_ACCOUNT_REQUIRED", "Missing bankAccountId rejected with BANK_ACCOUNT_REQUIRED");
    }

    // 2. Non-existent bankAccountId
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: "ba_non_existent_id",
        sourceFilename: "statement.csv",
        fileContent: "Date,Description,Debit,Credit\n2026-09-01,Deposit,0,100",
        importedBy: "staff_01",
      });
      assert(false, "Non-existent bankAccountId should have been rejected");
    } catch (err) {
      assert(err instanceof BankStatementServiceError && err.code === "BANK_ACCOUNT_NOT_FOUND", "Non-existent bankAccountId rejected with BANK_ACCOUNT_NOT_FOUND");
    }

    // 3. Inactive bank account
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: inactiveAccount.id,
        sourceFilename: "statement.csv",
        fileContent: "Date,Description,Debit,Credit\n2026-09-01,Deposit,0,100",
        importedBy: "staff_01",
      });
      assert(false, "Inactive bank account should have been rejected");
    } catch (err) {
      assert(err instanceof BankStatementServiceError && err.code === "BANK_ACCOUNT_NOT_ACTIVE", "Inactive bank account rejected with BANK_ACCOUNT_NOT_ACTIVE");
    }

    // 4. Empty file content
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "empty.csv",
        fileContent: "   \n\r  ",
        importedBy: "staff_01",
      });
      assert(false, "Empty file content should have been rejected");
    } catch (err) {
      assert(err instanceof BankStatementServiceError && err.code === "EMPTY_FILE_CONTENT", "Empty file content rejected with EMPTY_FILE_CONTENT");
    }

    // 5. Missing importedBy
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "statement.csv",
        fileContent: "Date,Description,Debit,Credit\n2026-09-01,Deposit,0,100",
        importedBy: "   ",
      });
      assert(false, "Missing importedBy should have been rejected");
    } catch (err) {
      assert(err instanceof BankStatementServiceError && err.code === "IMPORTED_BY_REQUIRED", "Missing importedBy rejected with IMPORTED_BY_REQUIRED");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 2: Standard CSV Parsing & Ingestion (Separate Debit/Credit Columns)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[2/10] Verifying Standard CSV Parsing & Ingestion...');

    const standardCsv = `Date,Value Date,Description,Reference,Debit,Credit,Balance
2026-09-01,2026-09-01,Opening Cash Deposit,REF-DEP-001,,50000.00,50000.00
2026-09-03,2026-09-03,Razorpay Payout Net,RZP-PAY-001,,15400.00,65400.00
2026-09-05,2026-09-06,Supplier Flour Payment,CHQ-1001,12000.00,,53400.00
2026-09-10,2026-09-10,Electricity Bill Debit,NEFT-ELEC-01,4500.00,,48900.00
2026-09-15,2026-09-15,Cash Deposit Branch B,REF-DEP-002,,25000.00,73900.00`;

    const resStandard = await BankStatementImportService.ingestStatement({
      bankAccountId: activeAccount.id,
      sourceFilename: "hdfc_september_2026.csv",
      fileContent: standardCsv,
      sourceFormat: "CSV",
      importedBy: "staff_fin_01",
    });

    createdImportIds.push(resStandard.importRecord.id);

    assert(resStandard.importRecord.status === "COMPLETED", "Import status initialized to COMPLETED");
    assert(resStandard.linesCount === 5, `Imported exactly 5 lines (actual: ${resStandard.linesCount})`);
    assert(resStandard.totalDebitAmount === 16500.00, `Total debit calculated correctly: 16500.00 (actual: ${resStandard.totalDebitAmount})`);
    assert(resStandard.totalCreditAmount === 90400.00, `Total credit calculated correctly: 90400.00 (actual: ${resStandard.totalCreditAmount})`);
    assert(resStandard.statementPeriodStart === "2026-09-01", `Period start identified as 2026-09-01 (actual: ${resStandard.statementPeriodStart})`);
    assert(resStandard.statementPeriodEnd === "2026-09-15", `Period end identified as 2026-09-15 (actual: ${resStandard.statementPeriodEnd})`);

    // Verify DB lines
    const { lines: dbLines } = await BankStatementImportRepository.getLinesByImportId(resStandard.importRecord.id);
    assert(dbLines.length === 5, `Database contains 5 statement lines (actual: ${dbLines.length})`);

    // Check value date preservation
    const formatDate = (d) => {
      if (!d) return null;
      if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return String(d).substring(0, 10);
    };
    const line3 = dbLines.find(l => l.line_number === 3);
    assert(line3 && formatDate(line3.transaction_date) === '2026-09-05', "Line 3 transaction_date preserved faithfully (2026-09-05)");
    assert(line3 && formatDate(line3.value_date) === '2026-09-06', "Line 3 value_date preserved separately (2026-09-06)");
    assert(line3 && Number(line3.debit_amount) === 12000.00, "Line 3 debit_amount is 12000.00");
    assert(line3 && Number(line3.credit_amount) === 0.00, "Line 3 credit_amount is 0.00");
    assert(line3 && line3.reconciliation_status === 'UNMATCHED', "Line 3 reconciliation_status is UNMATCHED");
    assert(line3 && line3.line_hash && line3.line_hash.length === 64, "Line 3 has valid SHA-256 line_hash");

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 3: Indian Banking Formats & Single Amount Column Handling
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[3/10] Verifying Indian Banking Formats & Single Amount Handling...');

    // 1. Indian Bank layout (Withdrawal Amt. / Deposit Amt.)
    const indianBankCsv = `Date,Narration,Chq./Ref.No.,Withdrawal Amt.,Deposit Amt.,Closing Balance
02/09/2026,UPI-SWIGGY-ORDERS,UPI-98765,,8400.50,8400.50
04/09/2026,CHQ DEP CLEARING,CLR-1234,,15000.00,23400.50
06/09/2026,ANNUAL SMS CHARGES,CHG-999,59.00,,23341.50`;

    const resIndian = await BankStatementImportService.ingestStatement({
      bankAccountId: activeAccount.id,
      sourceFilename: "sbi_account_statement.csv",
      fileContent: indianBankCsv,
      importedBy: "staff_fin_02",
    });
    createdImportIds.push(resIndian.importRecord.id);

    assert(resIndian.linesCount === 3, `Indian bank format parsed 3 lines (actual: ${resIndian.linesCount})`);
    assert(resIndian.totalCreditAmount === 23400.50, `Indian bank total credit is 23400.50 (actual: ${resIndian.totalCreditAmount})`);
    assert(resIndian.totalDebitAmount === 59.00, `Indian bank total debit is 59.00 (actual: ${resIndian.totalDebitAmount})`);
    assert(resIndian.statementPeriodStart === "2026-09-02", `Date 02/09/2026 parsed to ISO 2026-09-02 (actual: ${resIndian.statementPeriodStart})`);

    // 2. Single Amount Column with Type Indicator (DR / CR)
    const singleColTypeCsv = `Date,Description,Reference,Amount,Type
2026-09-18,Flour Vendor Payment,VEND-1,10000.00,DR
2026-09-19,Customer Online Payout,CUST-1,5000.00,CR`;

    const resType = await BankStatementImportService.ingestStatement({
      bankAccountId: activeAccount.id,
      sourceFilename: "type_indicator_statement.csv",
      fileContent: singleColTypeCsv,
      importedBy: "staff_fin_02",
    });
    createdImportIds.push(resType.importRecord.id);

    assert(resType.linesCount === 2, `Single amount + DR/CR type parsed 2 lines (actual: ${resType.linesCount})`);
    assert(resType.totalDebitAmount === 10000.00, "DR indicator correctly mapped to debit");
    assert(resType.totalCreditAmount === 5000.00, "CR indicator correctly mapped to credit");

    // 3. Single Signed Amount Column (-ve = debit, +ve = credit)
    const signedAmountCsv = `Date,Description,Reference,Amount
2026-09-20,Monthly Maintenance Fee,CHG-MMF,-250.00
2026-09-21,Savings Interest Credited,INT-EARN,125.50`;

    const resSigned = await BankStatementImportService.ingestStatement({
      bankAccountId: activeAccount.id,
      sourceFilename: "signed_amount_statement.csv",
      fileContent: signedAmountCsv,
      importedBy: "staff_fin_02",
    });
    createdImportIds.push(resSigned.importRecord.id);

    assert(resSigned.linesCount === 2, `Signed amount parsed 2 lines (actual: ${resSigned.linesCount})`);
    assert(resSigned.totalDebitAmount === 250.00, "Negative amount mapped to debit 250.00");
    assert(resSigned.totalCreditAmount === 125.50, "Positive amount mapped to credit 125.50");

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 4: SWIFT MT940 & OFX Format Parsers
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[4/10] Verifying SWIFT MT940 & OFX Format Parsers...');

    // 1. SWIFT MT940
    const mt940Text = `:20:START20260901
:25:HDFC0001234/987654321
:28C:00001/001
:60F:C260901INR50000,00
:61:2609020902CR10000,00NTRFNONREF//REF-DEP-003
:86:UPI PAYMENT RECEIVED FROM CUSTOMER
:61:2609030903DR2500,00NTRFNONREF//CHQ-1002
:86:SUGAR SUPPLIER CHEQUE CLEARING
:62F:C260903INR57500,00`;

    const resMt940 = await BankStatementImportService.ingestStatement({
      bankAccountId: activeAccount.id,
      sourceFilename: "swift_statement_sept2026.txt",
      fileContent: mt940Text,
      sourceFormat: "MT940",
      importedBy: "staff_fin_mt940",
    });
    createdImportIds.push(resMt940.importRecord.id);

    assert(resMt940.linesCount === 2, `MT940 parsed 2 lines (actual: ${resMt940.linesCount})`);
    assert(resMt940.totalCreditAmount === 10000.00, `MT940 credit amount is 10000.00 (actual: ${resMt940.totalCreditAmount})`);
    assert(resMt940.totalDebitAmount === 2500.00, `MT940 debit amount is 2500.00 (actual: ${resMt940.totalDebitAmount})`);
    assert(resMt940.statementPeriodStart === "2026-09-02", `MT940 date converted to 2026-09-02 (actual: ${resMt940.statementPeriodStart})`);

    // 2. OFX XML Statement
    const ofxText = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>INR</CURDEF>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260908120000</DTPOSTED>
            <TRNAMT>7500.00</TRNAMT>
            <FITID>OFX-TXN-001</FITID>
            <NAME>Direct Bank Deposit</NAME>
            <MEMO>Counter Cash Inward</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260909120000</DTPOSTED>
            <TRNAMT>-1800.00</TRNAMT>
            <FITID>OFX-TXN-002</FITID>
            <NAME>Packaging Vendor</NAME>
            <MEMO>Box Purchases</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    const resOfx = await BankStatementImportService.ingestStatement({
      bankAccountId: activeAccount.id,
      sourceFilename: "bank_statement.ofx",
      fileContent: ofxText,
      sourceFormat: "OFX",
      importedBy: "staff_fin_ofx",
    });
    createdImportIds.push(resOfx.importRecord.id);

    assert(resOfx.linesCount === 2, `OFX parsed 2 lines (actual: ${resOfx.linesCount})`);
    assert(resOfx.totalCreditAmount === 7500.00, `OFX credit amount is 7500.00 (actual: ${resOfx.totalCreditAmount})`);
    assert(resOfx.totalDebitAmount === 1800.00, `OFX debit amount is 1800.00 (actual: ${resOfx.totalDebitAmount})`);
    assert(resOfx.statementPeriodStart === "2026-09-08", `OFX date parsed to 2026-09-08 (actual: ${resOfx.statementPeriodStart})`);

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 5: Cryptographic Replay & Deduplication Protection
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[5/10] Verifying Cryptographic Replay & Deduplication Protection...');

    // Attempt to re-import the exact same file content for activeAccount
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "duplicate_attempt.csv",
        fileContent: standardCsv, // identical content -> identical SHA256
        importedBy: "another_staff",
      });
      assert(false, "Duplicate statement file upload should have been rejected");
    } catch (err) {
      assert(
        err instanceof BankStatementServiceError && err.code === "DUPLICATE_STATEMENT_FILE",
        "Duplicate statement file upload rejected with DUPLICATE_STATEMENT_FILE"
      );
    }

    // Attempting to import the SAME file content for activeAccount2 (different bank account) is ALLOWED
    const resDifferentAccount = await BankStatementImportService.ingestStatement({
      bankAccountId: activeAccount2.id,
      sourceFilename: "hdfc_september_2026_copy.csv",
      fileContent: standardCsv,
      importedBy: "staff_fin_01",
    });
    createdImportIds.push(resDifferentAccount.importRecord.id);
    assert(resDifferentAccount.linesCount === 5, "Same file content successfully imported for distinct bank account");

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 6: Invariant Enforcement & Constraint Validation
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[6/10] Verifying Invariant Enforcement & Constraint Validation...');

    // 1. Negative amount rejected
    const negativeCsv = `Date,Description,Debit,Credit\n2026-09-10,Invalid Line,-500.00,0.00`;
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "neg.csv",
        fileContent: negativeCsv,
        importedBy: "staff_fin_01",
      });
      assert(false, "Negative amount line should have been rejected");
    } catch (err) {
      assert(
        err instanceof BankStatementServiceError && err.code === "NEGATIVE_AMOUNT_REJECTED",
        "Negative amount line rejected with NEGATIVE_AMOUNT_REJECTED"
      );
    }

    // 2. Dual-sided amount (both debit and credit > 0) rejected
    const dualSidedCsv = `Date,Description,Debit,Credit\n2026-09-10,Dual Sided,500.00,300.00`;
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "dual.csv",
        fileContent: dualSidedCsv,
        importedBy: "staff_fin_01",
      });
      assert(false, "Dual-sided line should have been rejected");
    } catch (err) {
      assert(
        err instanceof BankStatementServiceError && err.code === "INVALID_LINE_AMOUNT",
        "Dual-sided line rejected with INVALID_LINE_AMOUNT"
      );
    }

    // 3. Zero amount line rejected
    const zeroCsv = `Date,Description,Debit,Credit\n2026-09-10,Zero Line,0.00,0.00`;
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "zero.csv",
        fileContent: zeroCsv,
        importedBy: "staff_fin_01",
      });
      assert(false, "Zero-amount file should have been rejected");
    } catch (err) {
      assert(
        err instanceof BankStatementServiceError && err.code === "NO_STATEMENT_LINES_FOUND",
        "Zero-amount file rejected with NO_STATEMENT_LINES_FOUND"
      );
    }

    // 4. Invalid transaction date rejected
    const invalidDateCsv = `Date,Description,Debit,Credit\nnot-a-date,Bad Date Line,,1000.00`;
    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "bad_date.csv",
        fileContent: invalidDateCsv,
        importedBy: "staff_fin_01",
      });
      assert(false, "Invalid transaction date should have been rejected");
    } catch (err) {
      assert(
        err instanceof BankStatementServiceError && err.code === "NO_STATEMENT_LINES_FOUND",
        "Invalid date row ignored or rejected safely"
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 7: Atomic Transactional Rollback
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[7/10] Verifying Atomic Transactional Rollback...');

    const preRollbackImports = await client.query('SELECT COUNT(*) FROM public.bank_statement_import;');
    const preRollbackLines = await client.query('SELECT COUNT(*) FROM public.bank_statement_line;');
    const initialImportsCount = parseInt(preRollbackImports.rows[0].count, 10);
    const initialLinesCount = parseInt(preRollbackLines.rows[0].count, 10);

    // Create a CSV where Line 1 & Line 2 are valid, but Line 3 triggers a constraint failure
    const poisonCsv = `Date,Description,Reference,Debit,Credit
2026-09-10,Valid Line 1,REF-01,,1000.00
2026-09-11,Valid Line 2,REF-02,500.00,
2026-09-12,Poison Line 3,REF-03,-999.00,`;

    try {
      await BankStatementImportService.ingestStatement({
        bankAccountId: activeAccount.id,
        sourceFilename: "poison_statement.csv",
        fileContent: poisonCsv,
        importedBy: "staff_fin_01",
      });
      assert(false, "Poison statement should have failed");
    } catch (err) {
      assert(err instanceof BankStatementServiceError, "Poison statement rejected by service");
    }

    // Verify ZERO rows were persisted (atomic rollback guarantee)
    const postRollbackImports = await client.query('SELECT COUNT(*) FROM public.bank_statement_import;');
    const postRollbackLines = await client.query('SELECT COUNT(*) FROM public.bank_statement_line;');
    assert(
      parseInt(postRollbackImports.rows[0].count, 10) === initialImportsCount,
      `Rollback preserved import count: ${initialImportsCount} (actual: ${postRollbackImports.rows[0].count})`
    );
    assert(
      parseInt(postRollbackLines.rows[0].count, 10) === initialLinesCount,
      `Rollback preserved lines count: ${initialLinesCount} (actual: ${postRollbackLines.rows[0].count})`
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 8: Repository Queries, Filtering & Cancellation Lifecycle
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[8/10] Verifying Repository Queries, Filtering & Cancellation Lifecycle...');

    // 1. getImportById
    const fetchedImport = await BankStatementImportService.getImportById(resStandard.importRecord.id);
    assert(fetchedImport !== null && fetchedImport.id === resStandard.importRecord.id, "getImportById returned correct record");

    // 2. listImports with bank account filter
    const listRes = await BankStatementImportService.listImports({ bankAccountId: activeAccount.id });
    assert(listRes.totalCount >= 4, `listImports returned at least 4 imports for activeAccount (actual: ${listRes.totalCount})`);

    // 3. getImportLines with status filter
    const linesRes = await BankStatementImportService.getImportLines(resStandard.importRecord.id, { reconciliationStatus: "UNMATCHED" });
    assert(linesRes.totalCount === 5, `getImportLines returned 5 UNMATCHED lines (actual: ${linesRes.totalCount})`);

    // 4. getLineById
    const sampleLine = linesRes.lines[0];
    const fetchedLine = await BankStatementImportService.getLineById(sampleLine.id);
    assert(fetchedLine !== null && fetchedLine.id === sampleLine.id, "getLineById returned single line record");

    // 5. cancelImport
    const cancelled = await BankStatementImportService.cancelImport(
      resSigned.importRecord.id,
      "supervisor_01",
      "Uploaded incorrect statement period by mistake"
    );
    assert(cancelled.status === "SUPERSEDED", "cancelImport transitioned status to SUPERSEDED");

    // Re-cancelling should fail
    try {
      await BankStatementImportService.cancelImport(resSigned.importRecord.id, "supervisor_01", "Second attempt");
      assert(false, "Re-cancelling already superseded import should have failed");
    } catch (err) {
      assert(
        err instanceof BankStatementServiceError && err.code === "IMPORT_ALREADY_CANCELLED",
        "Re-cancelling rejected with IMPORT_ALREADY_CANCELLED"
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 9: Evidence-Only Accounting Invariant Verification
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[9/10] Verifying Evidence-Only Accounting Invariant...');

    const voucherRes = await client.query('SELECT COUNT(*) FROM public.accounting_voucher;');
    assert(parseInt(voucherRes.rows[0].count, 10) === 0, "ZERO accounting vouchers created (actual: 0)");

    const journalRes = await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry;');
    assert(parseInt(journalRes.rows[0].count, 10) === 0, "ZERO accounting journal entries created (actual: 0)");

    const journalLineRes = await client.query('SELECT COUNT(*) FROM public.accounting_journal_line;');
    assert(parseInt(journalLineRes.rows[0].count, 10) === 0, "ZERO accounting journal lines created (actual: 0)");

    const accountRes = await client.query('SELECT COUNT(*) FROM public.accounting_account;');
    assert(parseInt(accountRes.rows[0].count, 10) === 99, "Chart of accounts count unchanged at 99 (actual: 99)");

    const orderRes = await client.query('SELECT COUNT(*) FROM "order";');
    assert(parseInt(orderRes.rows[0].count, 10) === 173, "Historical orders untouched at 173 (actual: 173)");

    const paymentRes = await client.query('SELECT COUNT(*) FROM public.payment_transaction;');
    assert(parseInt(paymentRes.rows[0].count, 10) === 53, "Historical payment transactions untouched at 53 (actual: 53)");

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 10: 100% Teardown & Post-test Baseline Audit
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[10/10] Executing 100% Fixture Teardown and Post-test Baseline Audit...');

    // LIFO Cleanup: lines -> imports -> bank accounts
    for (const impId of createdImportIds) {
      await BankStatementImportRepository.deleteLinesByImportId(impId, client);
      await BankStatementImportRepository.deleteImport(impId, client);
    }

    for (const baId of createdBankAccountIds) {
      await client.query('DELETE FROM public.bank_statement_line WHERE bank_account_id = $1;', [baId]);
      await client.query('DELETE FROM public.bank_statement_import WHERE bank_account_id = $1;', [baId]);
      await client.query('DELETE FROM public.bank_account WHERE id = $1;', [baId]);
    }

    // Audit final PostgreSQL state
    for (const [table, expected] of Object.entries(baselineChecks)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM "order"' : `SELECT COUNT(*) FROM "${table}"`;
      const res = await client.query(q);
      const actual = parseInt(res.rows[0].count, 10);
      assert(actual === expected, `Post-test ${table} === ${expected} (actual: ${actual})`);
    }

  } catch (err) {
    console.error("\nUnexpected test suite crash:", err);
    failCount++;
  } finally {
    // Safety cleanup in case of crash
    try {
      for (const baId of createdBankAccountIds) {
        await client.query('DELETE FROM public.bank_statement_line WHERE bank_account_id = $1;', [baId]);
        await client.query('DELETE FROM public.bank_statement_import WHERE bank_account_id = $1;', [baId]);
        await client.query('DELETE FROM public.bank_account WHERE id = $1;', [baId]);
      }
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
    try {
      await closeDbPool();
    } catch (poolCloseErr) {
      console.error("Error closing DB pool:", poolCloseErr);
    }
    try {
      await client.end();
    } catch (clientEndErr) {
      console.error("Error closing dedicated client:", clientEndErr);
    }
  }

  console.log('\n=============================================================================');
  console.log(`STEP 4.10.5-B TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test runner fatal error:", err);
  process.exit(1);
});
