const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- TELLERS ---');
  const t = await client.query('SELECT * FROM public.teller');
  console.log(t.rows);

  console.log('\n--- TELLER SESSIONS ---');
  const s = await client.query('SELECT id, teller_id, branch_id, opening_float, expected_cash, closing_count, variance, status, opened_by, opened_at, closed_at FROM public.teller_session');
  console.table(s.rows);

  console.log('\n--- TELLER MOVEMENTS COUNT ---');
  const m = await client.query('SELECT count(*)::int as count FROM public.teller_movement');
  console.log('movements count:', m.rows[0].count);

  console.log('\n--- JOURNAL LINE BALANCES BY ACCOUNT ---');
  const jl = await client.query(`
    SELECT account_id, 
           SUM(debit_amount)::numeric(12,2) as total_debit, 
           SUM(credit_amount)::numeric(12,2) as total_credit, 
           (SUM(debit_amount) - SUM(credit_amount))::numeric(12,2) as net_balance 
    FROM public.accounting_journal_line 
    GROUP BY account_id 
    ORDER BY account_id
  `);
  console.table(jl.rows);

  console.log('\n--- TRIAL BALANCE NET DIFFERENCE ---');
  const tb = await client.query(`
    SELECT SUM(debit_amount)::numeric(12,2) as total_debit, 
           SUM(credit_amount)::numeric(12,2) as total_credit, 
           (SUM(debit_amount) - SUM(credit_amount))::numeric(12,2) as diff 
    FROM public.accounting_journal_line
  `);
  console.table(tb.rows);

  console.log('\n--- BANK ACCOUNTS ---');
  const ba = await client.query('SELECT * FROM public.bank_account');
  console.table(ba.rows);

  console.log('\n--- BANK DEPOSIT SLIPS ---');
  const bds = await client.query('SELECT * FROM public.bank_deposit_slip');
  console.table(bds.rows);

  await client.end();
}

run().catch(console.error);
