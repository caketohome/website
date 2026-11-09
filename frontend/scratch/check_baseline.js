const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
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
  }
  throw new Error("DATABASE_URL not found in .env");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function main() {
  const client = await pool.connect();
  try {
    const coaRes = await client.query('SELECT COUNT(*) FROM public.accounting_account');
    console.log(`CoA count: ${coaRes.rows[0].count}`);

    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(12,2) as total_debit,
        COALESCE(SUM(credit_amount), 0)::numeric(12,2) as total_credit
      FROM public.accounting_journal_line
    `);
    const debit = parseFloat(tbRes.rows[0].total_debit);
    const credit = parseFloat(tbRes.rows[0].total_credit);
    console.log(`Trial Balance: Dr=₹${debit.toFixed(2)}, Cr=₹${credit.toFixed(2)}, Diff=₹${(debit - credit).toFixed(4)}`);

    const branchCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branch' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Branch columns:', branchCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    const defRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.customer_receipt_allocation'::regclass
    `);
    console.log('customer_receipt_allocation constraints:', defRes.rows);

    // Check invoice columns
    const invCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invoice' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Invoice columns:', invCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // Check customer_receipt_allocation columns
    const craCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customer_receipt_allocation' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('customer_receipt_allocation columns:', craCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // Check notification columns
    const notifCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notification' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('notification columns:', notifCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    const accCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'accounting_account' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('accounting_account columns:', accCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // Check bank_account columns and leaf GL accounts
    const bankRes = await client.query(`
      SELECT ba.id, ba.account_name, ba.account_number, ba.bank_name, ba.gl_account_id, acc.code as gl_code, acc.name as gl_name
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account acc ON ba.gl_account_id = acc.id
    `);
    console.log('Bank accounts:', JSON.stringify(bankRes.rows, null, 2));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
