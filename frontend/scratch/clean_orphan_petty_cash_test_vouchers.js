const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

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

async function clean() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log("Connected to PostgreSQL for orphan PETTY_CASH test voucher cleanup...");

    const vIds = [
      'vch_00MUY56ZTC34S8UI',
      'vch_00MUY5AOGGSK8V6F',
      'vch_00MUY5JWF2LY24UG',
      'vch_00MUY5JXF1WJKL8B',
      'vch_00MUY5JY8CAPASU6'
    ];

    await client.query("BEGIN;");

    // 1. Delete the 1 empty journal entry
    const delJe = await client.query("DELETE FROM accounting_journal_entry WHERE id = 'jent_00MUY5AORYJ7ZQB4';");
    console.log(`1. Deleted ${delJe.rowCount} empty accounting_journal_entry row.`);

    // 2. Delete the 5 orphan vouchers
    const delV = await client.query("DELETE FROM accounting_voucher WHERE id = ANY($1);", [vIds]);
    console.log(`2. Deleted ${delV.rowCount} orphan accounting_voucher rows.`);

    await client.query("COMMIT;");

    // 3. Verify counts
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM accounting_account) as account_count,
        (SELECT COUNT(*) FROM accounting_voucher) as voucher_count,
        (SELECT COUNT(*) FROM accounting_journal_entry) as entry_count,
        (SELECT COUNT(*) FROM accounting_journal_line) as line_count,
        (SELECT COUNT(*) FROM bank_account) as bank_count,
        (SELECT COUNT(*) FROM teller) as teller_count,
        (SELECT COUNT(*) FROM teller_session) as session_count,
        (SELECT COUNT(*) FROM teller_movement) as movement_count;
    `);

    console.log("\n=== RESTORED DATABASE BASELINE COUNTS ===");
    console.log(JSON.stringify(counts.rows[0], null, 2));

    const tb = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0) as total_debit,
        COALESCE(SUM(credit_amount), 0) as total_credit
      FROM accounting_journal_line;
    `);
    console.log(`Trial Balance: Dr ₹${tb.rows[0].total_debit} = Cr ₹${tb.rows[0].total_credit}`);

  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Cleanup error:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

clean().catch(console.error);
