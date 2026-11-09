const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env from frontend/.env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts[0] && parts[1]) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

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

    console.log('\n=== 4. Check Accounting Voucher Columns ===');
    const vchCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'accounting_voucher'
      ORDER BY ordinal_position;
    `);
    console.log('accounting_voucher columns:', vchCols.rows.map(r => r.column_name));

    console.log('\n=== 4b. Check Historical Vouchers (H2, H3) ===');
    const vchs = ['vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8', 'VCH-EXPENSE-FY2026-27-20261005-3TTZ8T', 'VCH-EXPENSE-FY2026-27-20261005-23MZ39'];
    const vchRes = await client.query(`
      SELECT * 
      FROM public.accounting_voucher 
      WHERE id = ANY($1) OR voucher_no = ANY($1);
    `, [vchs]);
    console.log('Historical Vouchers found:');
    console.table(vchRes.rows);

    console.log('\n=== 5. Check Journal Line Columns ===');
    const jlCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'accounting_journal_line'
      ORDER BY ordinal_position;
    `);
    console.log('accounting_journal_line columns:', jlCols.rows.map(r => r.column_name));

    console.log('\n=== 5b. Cash Accounts & Balances ===');
    const accRes = await client.query(`
      SELECT a.code, a.name, 
             COALESCE(SUM(jl.debit_amount), 0) as total_debit,
             COALESCE(SUM(jl.credit_amount), 0) as total_credit,
             COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0) as net_balance
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

    console.log('\n=== 8. Product and Variant Columns ===');
    const prodCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product'
      ORDER BY ordinal_position;
    `);
    console.log('product columns:', prodCols.rows.map(r => r.column_name));

    const varCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product_variant'
      ORDER BY ordinal_position;
    `);
    console.log('product_variant columns:', varCols.rows.map(r => r.column_name));

    const sampleProds = await client.query(`
      SELECT id, title, handle, status, thumbnail, metadata 
      FROM public.product 
      LIMIT 5;
    `);
    console.log('Sample Products:');
    console.table(sampleProds.rows);

    console.log('\n=== 10. Check Invoice Columns & Sample Rows ===');
    const invCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'invoice'
      ORDER BY ordinal_position;
    `);
    console.log('invoice columns:', invCols.rows.map(r => r.column_name));

    const sampleInvs = await client.query(`SELECT * FROM public.invoice LIMIT 5;`);
    console.log('Sample Invoices:');
    console.table(sampleInvs.rows);

    console.log('\n=== 12. Check tax_rate constraints ===');
    const constRes = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'public.tax_rate'::regclass;
    `);
    console.table(constRes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
