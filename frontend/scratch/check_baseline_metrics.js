const { Client } = require('pg');
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
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const coa = await client.query('SELECT count(*) as count FROM public.accounting_account;');
  const vouchers = await client.query('SELECT count(*) as count FROM public.accounting_voucher;');
  const je = await client.query('SELECT count(*) as count FROM public.accounting_journal_entry;');
  const jl = await client.query('SELECT count(*) as count, sum(debit_amount) as debits, sum(credit_amount) as credits FROM public.accounting_journal_line;');
  const corpAcc = await client.query('SELECT count(*) as count FROM public.corporate_account;');
  const corpContact = await client.query('SELECT count(*) as count FROM public.corporate_account_contact;');
  const corpMember = await client.query('SELECT count(*) as count FROM public.corporate_account_member;');
  const corpEvent = await client.query('SELECT count(*) as count FROM public.corporate_account_event;');
  const corpEmp = await client.query('SELECT count(*) as count FROM public.corporate_employee;');
  const corpEmpEvent = await client.query('SELECT count(*) as count FROM public.corporate_employee_event;');
  const corpBatch = await client.query('SELECT count(*) as count FROM public.corporate_employee_import_batch;');

  console.log('COA count:', coa.rows[0].count);
  console.log('Vouchers count:', vouchers.rows[0].count);
  console.log('JE count:', je.rows[0].count);
  console.log('JL count & sums:', jl.rows[0]);
  console.log('corporate_account:', corpAcc.rows[0].count);
  console.log('corporate_account_contact:', corpContact.rows[0].count);
  console.log('corporate_account_member:', corpMember.rows[0].count);
  console.log('corporate_account_event:', corpEvent.rows[0].count);
  console.log('corporate_employee:', corpEmp.rows[0].count);
  console.log('corporate_employee_event:', corpEmpEvent.rows[0].count);
  console.log('corporate_employee_import_batch:', corpBatch.rows[0].count);

  await client.end();
}

run().catch(console.error);
