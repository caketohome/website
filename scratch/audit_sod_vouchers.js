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
  console.log('Forensic Audit: 2 Historical Vouchers Contributing to GL 1121 (₹2,000.00)');
  console.log('=============================================================================\n');

  const vchs = await client.query(`
    SELECT 
      v.id, v.voucher_no, v.voucher_type, v.voucher_date::text, v.branch_id, b.name as branch_name,
      v.fiscal_year, v.status, v.total_amount, v.reference_type, v.reference_id, v.reference_event,
      v.narration, v.created_by, v.submitted_by, v.approved_by, v.posted_by,
      v.submitted_at, v.approved_at, v.posted_at, v.metadata, v.created_at
    FROM public.accounting_voucher v
    LEFT JOIN public.branch b ON b.id = v.branch_id
    WHERE v.id IN ('vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8')
  `);
  console.log('--- VOUCHER HEADERS ---');
  console.log(JSON.stringify(vchs.rows, null, 2));

  const jes = await client.query(`
    SELECT 
      je.id as je_id, je.entry_no, je.voucher_id, je.entry_date::text, je.total_debit, je.total_credit,
      je.narration, je.created_by, je.created_at
    FROM public.accounting_journal_entry je
    WHERE je.voucher_id IN ('vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8')
  `);
  console.log('\n--- JOURNAL ENTRIES ---');
  console.log(JSON.stringify(jes.rows, null, 2));

  const jls = await client.query(`
    SELECT 
      jl.id as line_id, jl.journal_entry_id, je.entry_no, jl.line_no,
      ca.code as account_code, ca.name as account_name, ca.type as account_type,
      jl.debit_amount, jl.credit_amount, jl.narration, jl.customer_id, jl.supplier_id, jl.cost_centre_id
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_account ca ON ca.id = jl.account_id
    WHERE je.voucher_id IN ('vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8')
    ORDER BY je.entry_no, jl.line_no
  `);
  console.log('\n--- JOURNAL LINES ---');
  console.table(jls.rows);

  // Check if reference_id points to anything in database
  console.log('\n--- CHECK REFERENCE IDs IN OTHER TABLES ---');
  for (const row of vchs.rows) {
    console.log(`Checking reference_id: ${row.reference_id} (type: ${row.reference_type})`);
    const ordCheck = await client.query('SELECT id FROM public."order" WHERE id = $1', [row.reference_id]);
    console.log(`  - in "order": ${ordCheck.rows.length} rows`);
    const invCheck = await client.query('SELECT id FROM public.invoice WHERE id = $1 OR order_id = $1', [row.reference_id]);
    console.log(`  - in "invoice": ${invCheck.rows.length} rows`);
  }

  await client.end();
}

run().catch(console.error);
