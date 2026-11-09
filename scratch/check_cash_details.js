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

  console.log('--- ALL EXPENSES ---');
  const exps = await client.query(`
    SELECT *
    FROM public.expense
    ORDER BY created_at ASC
  `);
  console.table(exps.rows);

  console.log('\n--- ALL POSTED JOURNAL ENTRIES AND LINES ---');
  const jl = await client.query(`
    SELECT 
      v.voucher_no,
      v.voucher_type,
      v.reference_type,
      v.reference_id,
      ca.code AS acct_code,
      ca.name AS acct_name,
      jl.debit_amount AS dr,
      jl.credit_amount AS cr,
      jl.narration,
      v.status AS vch_status,
      v.created_at
    FROM public.accounting_journal_line jl
    JOIN public.accounting_account ca ON ca.id = jl.account_id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    ORDER BY v.created_at ASC, jl.id ASC
  `);
  console.table(jl.rows);

  console.log('\n--- ALL VOUCHERS ---');
  const vchs = await client.query(`
    SELECT id, voucher_no, voucher_type, status, total_amount, reference_type, reference_id, narration, created_at
    FROM public.accounting_voucher
    ORDER BY created_at ASC
  `);
  console.table(vchs.rows);

  console.log('\n--- PAYMENTS / ORDERS WITH CASH ---');
  const orders = await client.query(`
    SELECT id, payment_method, payment_status, total, created_at
    FROM public."order"
    ORDER BY created_at DESC
    LIMIT 10
  `).catch(e => ({ rows: e.message }));
  console.log('orders:', orders.rows);

  console.log('\n--- CUSTOMER PAYMENTS / RECEIPTS ---');
  const custRcpt = await client.query(`
    SELECT * FROM public.customer_receipt LIMIT 5
  `).catch(e => ({ rows: e.message }));
  console.log('customer_receipt:', custRcpt.rows);

  await client.end();
}

run().catch(console.error);
