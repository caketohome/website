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

  console.log('=============================================================================');
  console.log('Audit: Teller Custody & Cash Drawers vs General Ledger Accounts 1111 / 1114');
  console.log('=============================================================================\n');

  // 1. List all teller shifts and cash drawers
  const drawers = await client.query('SELECT * FROM public.cash_drawer').catch(e => ({ rows: [] }));
  console.log('--- CASH DRAWERS (public.cash_drawer) ---');
  console.table(drawers.rows);

  const shifts = await client.query('SELECT * FROM public.teller_shift').catch(e => ({ rows: [] }));
  console.log('\n--- TELLER SHIFTS (public.teller_shift) ---');
  console.table(shifts.rows);

  // 2. Check teller_session if exists
  const sess = await client.query('SELECT * FROM public.teller_session').catch(e => ({ rows: [] }));
  console.log('\n--- TELLER SESSIONS (public.teller_session) ---');
  console.table(sess.rows);

  // 3. Check petty cash tables
  const petty = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND table_name LIKE '%petty%'
  `);
  console.log('\n--- PETTY CASH TABLES ---', petty.rows);

  // 4. Source expenses for the disbursements
  const exps = await client.query(`
    SELECT e.id, e.description, e.subtotal, e.cgst, e.sgst, e.total, e.payment_method, e.status, e.branch_id,
           e.voucher_id, e.created_by, e.approved_by, e.posted_at, e.teller_session_id
    FROM public.expense e
  `);
  console.log('\n--- SOURCE EXPENSES ---');
  console.table(exps.rows);

  await client.end();
}

run().catch(console.error);
