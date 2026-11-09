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

async function verifyBaseline() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

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

  console.log('--- BASELINE COUNTS ---');
  console.log(counts.rows[0]);

  await client.end();
}

verifyBaseline().catch(console.error);
