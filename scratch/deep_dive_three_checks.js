const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

const dbUrl = "[REDACTED_DATABASE_CREDENTIAL]";
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();

  console.log("===============================================================================");
  console.log("CHECK 1: INDIRANAGAR JOURNAL-BY-JOURNAL SIGN CHECK & REVERSAL IMPACT");
  console.log("===============================================================================");

  const indiLines = await client.query(`
    SELECT 
      jl.id as line_id,
      jl.journal_entry_id,
      jl.line_no,
      aa.code as account_code,
      aa.name as account_name,
      jl.debit_amount,
      jl.credit_amount,
      je.entry_no,
      je.voucher_id,
      v.voucher_no,
      v.voucher_type,
      v.status as voucher_status,
      v.narration as voucher_narration,
      jl.narration as line_narration,
      je.created_at
    FROM accounting_journal_line jl
    JOIN accounting_account aa ON jl.account_id = aa.id
    JOIN accounting_journal_entry je ON jl.journal_entry_id = je.id
    LEFT JOIN accounting_voucher v ON je.voucher_id = v.id
    WHERE jl.branch_id = 'br_indiranagar'
    ORDER BY je.created_at ASC, jl.line_no ASC
  `);

  console.log(`Total journal lines for Indiranagar (all accounts): ${indiLines.rows.length}`);
  console.table(indiLines.rows.map(r => ({
    entry_no: r.entry_no,
    voucher_no: r.voucher_no,
    type: r.voucher_type,
    acc: r.account_code,
    debit: parseFloat(r.debit_amount),
    credit: parseFloat(r.credit_amount),
    narration: (r.line_narration || r.voucher_narration || '').substring(0, 45)
  })));

  // Detailed inspect the two vouchers:
  const excessVch = await client.query(`
    SELECT 
      v.id, v.voucher_no, v.status, v.narration,
      je.id as je_id, je.entry_no,
      jl.line_no, aa.code, aa.name, jl.debit_amount, jl.credit_amount, jl.narration as line_narr
    FROM accounting_voucher v
    JOIN accounting_journal_entry je ON je.voucher_id = v.id
    JOIN accounting_journal_line jl ON jl.journal_entry_id = je.id
    JOIN accounting_account aa ON jl.account_id = aa.id
    WHERE v.voucher_no = 'VCH-JOURNAL-FY2026-27-20261017-YRSXXF'
  `);
  console.log("\n--- Full Lines for VCH-JOURNAL-FY2026-27-20261017-YRSXXF (Excess Voucher) ---");
  console.table(excessVch.rows);

  const shortVch = await client.query(`
    SELECT 
      v.id, v.voucher_no, v.status, v.narration,
      je.id as je_id, je.entry_no,
      jl.line_no, aa.code, aa.name, jl.debit_amount, jl.credit_amount, jl.narration as line_narr
    FROM accounting_voucher v
    JOIN accounting_journal_entry je ON je.voucher_id = v.id
    JOIN accounting_journal_line jl ON jl.journal_entry_id = je.id
    JOIN accounting_account aa ON jl.account_id = aa.id
    WHERE v.voucher_no = 'VCH-JOURNAL-FY2026-27-20261017-YNXYCV'
  `);
  console.log("\n--- Full Lines for VCH-JOURNAL-FY2026-27-20261017-YNXYCV (Shortage Voucher) ---");
  console.table(shortVch.rows);

  console.log("\n===============================================================================");
  console.log("CHECK 2: DISPOSITION OF CLOSED-SESSION CASH (INDIRANAGAR & KORAMANGALA)");
  console.log("===============================================================================");

  const indiSessions = await client.query(`
    SELECT 
      id, teller_id, branch_id, status, opening_float, expected_cash, closing_count, variance,
      opened_at, closed_at, settled_at, settlement_voucher_id, notes, created_at
    FROM teller_session
    WHERE branch_id IN ('br_indiranagar', 'br_koramangala')
    ORDER BY branch_id, created_at ASC
  `);
  console.table(indiSessions.rows);

  // Inspect if any bank deposit or vault movement references these sessions
  const vaultLinks = await client.query(`
    SELECT * FROM branch_vault_movement 
    WHERE branch_id IN ('br_indiranagar', 'br_koramangala')
  `);
  console.log("\nVault movements for Indiranagar & Koramangala:", vaultLinks.rows);

  // Inspect bank deposits or bank transactions if any table exists
  const bankTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%deposit%' OR table_name LIKE '%bank%'
  `);
  console.log("\nBank/Deposit Tables:", bankTables.rows.map(r => r.table_name));

  console.log("\n===============================================================================");
  console.log("CHECK 3: TRANSACTION-LEVEL MATCHING OF ACCOUNT 1122 (CLEARING)");
  console.log("===============================================================================");

  // All 1122 journal lines
  const lines1122 = await client.query(`
    SELECT 
      jl.id as line_id,
      jl.journal_entry_id,
      jl.debit_amount,
      jl.credit_amount,
      jl.branch_id,
      b.name as branch_name,
      v.id as voucher_id,
      v.voucher_no,
      v.voucher_type,
      v.reference_type,
      v.reference_id,
      jl.narration as line_narration,
      v.narration as voucher_narration,
      v.created_at
    FROM accounting_journal_line jl
    JOIN accounting_account aa ON jl.account_id = aa.id
    JOIN accounting_journal_entry je ON jl.journal_entry_id = je.id
    LEFT JOIN accounting_voucher v ON je.voucher_id = v.id
    LEFT JOIN branch b ON jl.branch_id = b.id
    WHERE aa.code = '1122'
    ORDER BY v.created_at ASC
  `);
  console.log(`Total 1122 Journal Lines: ${lines1122.rows.length}`);
  console.table(lines1122.rows);

  // All handovers
  const allHandovers = await client.query(`
    SELECT 
      id, handover_number, branch_id, delivery_partner_id, teller_session_id, status,
      expected_amount, declared_amount, acknowledged_amount, shortage_amount, surplus_amount,
      digital_amount, settlement_voucher_id, teller_movement_id, submitted_at, acknowledged_at, created_at
    FROM delivery_cash_handover
    ORDER BY created_at ASC
  `);
  console.log(`Total Handover Records: ${allHandovers.rows.length}`);
  console.table(allHandovers.rows);

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
