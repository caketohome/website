const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const connStr = match[1].replace(/["']/g, '').trim();

async function inspect() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  console.log('--- VOUCHERS ---');
  const vouchers = await client.query('SELECT id, voucher_no, voucher_type, voucher_date, narration, reference_type, reference_id FROM accounting_voucher ORDER BY id');
  console.table(vouchers.rows);
  
  console.log('--- JOURNAL ENTRIES ---');
  const entries = await client.query('SELECT e.id, e.entry_no, e.voucher_id, e.entry_date, e.narration, (SELECT COUNT(*) FROM accounting_journal_line l WHERE l.journal_entry_id = e.id) as line_count FROM accounting_journal_entry e ORDER BY e.id');
  console.table(entries.rows);

  console.log('--- PETTY CASH REQUESTS ---');
  const pcr = await client.query('SELECT * FROM petty_cash_request ORDER BY id');
  console.table(pcr.rows);

  console.log('--- COUNTS ---');
  const counts = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM accounting_account) as account_count,
      (SELECT COUNT(*) FROM accounting_voucher) as voucher_count,
      (SELECT COUNT(*) FROM accounting_journal_entry) as entry_count,
      (SELECT COUNT(*) FROM accounting_journal_line) as line_count,
      (SELECT COUNT(*) FROM teller) as teller_count,
      (SELECT COUNT(*) FROM teller_session) as session_count,
      (SELECT COUNT(*) FROM teller_movement) as movement_count,
      (SELECT COUNT(*) FROM branch_vault_movement) as vault_mov_count,
      (SELECT COUNT(*) FROM petty_cash_request) as petty_cash_count;
  `);
  console.table(counts.rows);

  // Check trial balance
  const tb = await client.query(`
    SELECT 
      COALESCE(SUM(debit_amount), 0) as total_debit,
      COALESCE(SUM(credit_amount), 0) as total_credit,
      COALESCE(SUM(debit_amount) - SUM(credit_amount), 0) as diff
    FROM accounting_journal_line;
  `);
  console.log('--- TRIAL BALANCE ---');
  console.table(tb.rows);

  console.log('--- GST INPUT ACCOUNTS 1141-1149 ---');
  const gstAccs = await client.query("SELECT id, code, name, subtype, tax_rate, is_active FROM accounting_account WHERE code BETWEEN '1141' AND '1149' ORDER BY code");
  console.table(gstAccs.rows);
  
  await client.end();
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
