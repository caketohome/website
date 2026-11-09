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

async function clean() {
  const client = new Client({ 
    connectionString: getConnectionString(), 
    ssl: { rejectUnauthorized: false },
    statement_timeout: 5000 
  });
  
  try {
    await client.connect();
    console.log("Connected to PostgreSQL for controlled C4.1 test fixture cleanup...");

    // 1. Delete all teller_movement
    const delMov = await client.query('DELETE FROM teller_movement;');
    console.log(`1. Deleted ${delMov.rowCount} teller_movement rows.`);

    // 2. Delete all teller_session
    const delSess = await client.query('DELETE FROM teller_session;');
    console.log(`2. Deleted ${delSess.rowCount} teller_session rows.`);

    // 3. Delete all teller
    const delTlr = await client.query('DELETE FROM teller;');
    console.log(`3. Deleted ${delTlr.rowCount} teller rows.`);

    // 4. Find all test vouchers created by TELLER_SESSION
    const testVouchersRes = await client.query("SELECT id FROM accounting_voucher WHERE reference_type = 'TELLER_SESSION';");
    const testVoucherIds = testVouchersRes.rows.map(r => r.id);
    console.log(`Found ${testVoucherIds.length} test vouchers to clean up:`, testVoucherIds);

    if (testVoucherIds.length > 0) {
      // 4a. Delete dependent journal lines
      const delLines = await client.query(`
        DELETE FROM accounting_journal_line 
        WHERE journal_entry_id IN (
          SELECT id FROM accounting_journal_entry WHERE voucher_id = ANY($1)
        );
      `, [testVoucherIds]);
      console.log(`4a. Deleted ${delLines.rowCount} accounting_journal_line rows.`);

      // 4b. Delete dependent journal entries
      const delEntries = await client.query(`
        DELETE FROM accounting_journal_entry WHERE voucher_id = ANY($1);
      `, [testVoucherIds]);
      console.log(`4b. Deleted ${delEntries.rowCount} accounting_journal_entry rows.`);

      // 4c. Delete vouchers
      const delVouchers = await client.query(`
        DELETE FROM accounting_voucher WHERE id = ANY($1);
      `, [testVoucherIds]);
      console.log(`4c. Deleted ${delVouchers.rowCount} accounting_voucher rows.`);
    }

    // 5. Delete test users
    const delUsers = await client.query("DELETE FROM \"user\" WHERE id LIKE 'usr_test_c41_%';");
    console.log(`5. Deleted ${delUsers.rowCount} test users.`);

    // 6. Verify restored baseline
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
    console.log("\n=== RESTORED DATABASE BASELINE COUNTS ===");
    console.log(JSON.stringify(counts.rows[0], null, 2));

  } finally {
    await client.end();
  }
}

clean().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
