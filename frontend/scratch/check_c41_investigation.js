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

async function check() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  const vIds = [
    'vch_00MUY56ZTC34S8UI',
    'vch_00MUY5AOGGSK8V6F',
    'vch_00MUY5JWF2LY24UG',
    'vch_00MUY5JXF1WJKL8B',
    'vch_00MUY5JY8CAPASU6'
  ];

  const r1 = await pool.query('SELECT COUNT(*) as count FROM petty_cash_request WHERE voucher_id = ANY($1) OR payment_voucher_id = ANY($1)', [vIds]);
  console.log('petty_cash_request refs:', r1.rows[0].count);

  const r2 = await pool.query('SELECT COUNT(*) as count FROM accounting_journal_entry WHERE voucher_id = ANY($1)', [vIds]);
  console.log('accounting_journal_entry refs:', r2.rows[0].count);

  const r3 = await pool.query('SELECT COUNT(*) as count FROM accounting_journal_line WHERE journal_entry_id = $1', ['jent_00MUY5AORYJ7ZQB4']);
  console.log('accounting_journal_line refs for jent_00MUY5AORYJ7ZQB4:', r3.rows[0].count);

  const totalVouchers = await pool.query('SELECT COUNT(*) as count FROM accounting_voucher');
  console.log('Total accounting vouchers:', totalVouchers.rows[0].count);

  const totalEntries = await pool.query('SELECT COUNT(*) as count FROM accounting_journal_entry');
  console.log('Total accounting journal entries:', totalEntries.rows[0].count);

  const totalLines = await pool.query('SELECT COUNT(*) as count FROM accounting_journal_line');
  console.log('Total accounting journal lines:', totalLines.rows[0].count);

  await pool.end();
}

check().catch(console.error);
