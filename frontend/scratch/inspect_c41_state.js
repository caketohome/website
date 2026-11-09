const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
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

async function inspectDb() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false }, statement_timeout: 5000 });
  try {
    await client.connect();

    // 1. Table Counts
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM accounting_account) as account_count,
        (SELECT COUNT(*) FROM accounting_voucher) as voucher_count,
        (SELECT COUNT(*) FROM accounting_journal_entry) as entry_count,
        (SELECT COUNT(*) FROM accounting_journal_line) as line_count,
        (SELECT COUNT(*) FROM bank_account) as bank_count,
        (SELECT COUNT(*) FROM teller) as teller_count,
        (SELECT COUNT(*) FROM teller_session) as session_count,
        (SELECT COUNT(*) FROM teller_movement) as movement_count,
        (SELECT COUNT(*) FROM "user" WHERE id LIKE 'usr_test_c41_%') as c41_user_count;
    `);
    console.log("=== TABLE COUNTS ===");
    console.log(JSON.stringify(counts.rows[0], null, 2));

    // 2. All Vouchers
    const vouchers = await client.query(`
      SELECT id, voucher_no, voucher_type, reference_type, reference_id, status, created_at 
      FROM accounting_voucher 
      ORDER BY created_at ASC;
    `);
    console.log("\n=== ALL ACCOUNTING VOUCHERS ===");
    console.log(JSON.stringify(vouchers.rows, null, 2));

    // 3. Teller Sessions and their settlement_voucher_id
    const sessions = await client.query(`
      SELECT id, teller_id, branch_id, status, opening_float, closing_count, expected_cash, variance, 
             opened_by, closed_by, verified_by, settled_by, settlement_voucher_id, created_at
      FROM teller_session 
      ORDER BY created_at ASC;
    `);
    console.log("\n=== ALL TELLER SESSIONS ===");
    console.log(JSON.stringify(sessions.rows, null, 2));

    // 4. Teller Movements
    const movements = await client.query(`
      SELECT id, teller_session_id, branch_id, direction, movement_type, amount, source_type, source_id, created_at
      FROM teller_movement
      ORDER BY created_at ASC;
    `);
    console.log("\n=== ALL TELLER MOVEMENTS ===");
    console.log(JSON.stringify(movements.rows, null, 2));

    // 5. Tellers
    const tellers = await client.query(`
      SELECT id, branch_id, user_id, name, code, status, created_at
      FROM teller
      ORDER BY created_at ASC;
    `);
    console.log("\n=== ALL TELLERS ===");
    console.log(JSON.stringify(tellers.rows, null, 2));

    // 6. Journal Entries for TELLER_SESSION vouchers
    const journalEntries = await client.query(`
      SELECT e.id as entry_id, e.voucher_id, e.entry_no,
             l.id as line_id, l.account_id, l.debit_amount, l.credit_amount, l.branch_id
      FROM accounting_journal_entry e
      JOIN accounting_journal_line l ON l.journal_entry_id = e.id
      JOIN accounting_voucher v ON v.id = e.voucher_id
      WHERE v.reference_type = 'TELLER_SESSION'
      ORDER BY e.created_at ASC, l.debit_amount DESC;
    `);
    console.log("\n=== JOURNAL ENTRIES/LINES FOR TELLER SESSIONS ===");
    console.log(JSON.stringify(journalEntries.rows, null, 2));

  } finally {
    await client.end();
  }
}

inspectDb().catch(console.error);
