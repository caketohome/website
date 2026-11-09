const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
  throw new Error("DATABASE_URL not found");
}

async function checkBaseline() {
  const connStr = getConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM accounting_account) as coa,
      (SELECT COUNT(*) FROM accounting_voucher) as vouchers,
      (SELECT COUNT(*) FROM accounting_journal_entry) as journal_entries,
      (SELECT COUNT(*) FROM accounting_journal_line) as journal_lines,
      (SELECT COUNT(*) FROM teller) as tellers,
      (SELECT COUNT(*) FROM teller_session) as teller_sessions,
      (SELECT COUNT(*) FROM teller_movement) as teller_movements,
      (SELECT COUNT(*) FROM "user" WHERE email LIKE '%test%' OR email LIKE '%fixture%') as test_users,
      (SELECT COUNT(*) FROM bank_account) as bank_accounts,
      (SELECT COUNT(*) FROM company) as company,
      (SELECT COUNT(*) FROM gst_registration) as gst_registrations
  `);
  console.log('BASELINE AUDIT:', res.rows[0]);
  await client.end();
}

checkBaseline().catch(err => {
  console.error("Baseline check error:", err);
  process.exit(1);
});
