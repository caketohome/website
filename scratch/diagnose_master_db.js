const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspect() {
  const client = await pool.connect();
  try {
    console.log('=== 1. Tax Related Tables ===');
    const taxTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name LIKE '%tax%' OR table_name LIKE '%gst%')
      ORDER BY table_name;
    `);
    console.log('Tax tables:', taxTables.rows.map(r => r.table_name));

    console.log('\n=== 2. Product & PIM Tables ===');
    const pimTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name LIKE '%product%' OR table_name LIKE '%catalog%')
      ORDER BY table_name;
    `);
    console.log('PIM tables:', pimTables.rows.map(r => r.table_name));

    console.log('\n=== 3. Invoice & Purchase Tables ===');
    const invTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name LIKE '%invoice%' OR table_name LIKE '%purchase%' OR table_name LIKE '%supplier%')
      ORDER BY table_name;
    `);
    console.log('Invoice/Purchase tables:', invTables.rows.map(r => r.table_name));

    console.log('\n=== 4. Check Historical Vouchers (H2, H3) ===');
    const vchs = ['vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8', 'VCH-EXPENSE-FY2026-27-20261005-3TTZ8T', 'VCH-EXPENSE-FY2026-27-20261005-23MZ39'];
    const vchRes = await client.query(`
      SELECT id, voucher_number, voucher_type, status, total_amount, metadata 
      FROM public.accounting_voucher 
      WHERE id = ANY($1) OR voucher_number = ANY($1);
    `, [vchs]);
    console.log('Historical Vouchers found:');
    console.table(vchRes.rows);

    console.log('\n=== 5. Cash Accounts & Balances ===');
    const accRes = await client.query(`
      SELECT a.code, a.name, 
             COALESCE(SUM(jl.debit), 0) as total_debit,
             COALESCE(SUM(jl.credit), 0) as total_credit,
             COALESCE(SUM(jl.debit - jl.credit), 0) as net_balance
      FROM public.accounting_account a
      LEFT JOIN public.accounting_journal_line jl ON a.id = jl.account_id
      WHERE a.code IN ('1111', '1112', '1114', '1115', '1118', '1119', '1121', '1122', '2111', '4110', '5299')
      GROUP BY a.code, a.name
      ORDER BY a.code;
    `);
    console.table(accRes.rows);

    console.log('\n=== 6. Delivery Handover Table Status ===');
    const dhCount = await client.query(`SELECT count(*), status FROM public.delivery_cash_handover GROUP BY status;`);
    console.table(dhCount.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
