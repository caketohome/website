const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN TRANSACTION READ ONLY');

  console.log('=== PHASE B: 1. ALL COMPANY RECORDS ===');
  const companies = await c.query('SELECT * FROM public.company');
  console.log(JSON.stringify(companies.rows, null, 2));

  console.log('\n=== PHASE B: 2. ALL GST REGISTRATIONS ===');
  const gstRegs = await c.query('SELECT * FROM public.gst_registration');
  console.log(JSON.stringify(gstRegs.rows, null, 2));

  console.log('\n=== PHASE B: 3. INVOICE SEQUENCE GSTIN & CONFIG ===');
  const seqs = await c.query('SELECT * FROM public.invoice_sequence');
  console.log(JSON.stringify(seqs.rows, null, 2));

  console.log('\n=== PHASE B: 4. HISTORICAL INVOICES SELLER SNAPSHOTS ===');
  const invs = await c.query(`
    SELECT id, invoice_number, 
           metadata->>'seller_legal_name' as seller_legal_name,
           metadata->>'seller_gstin' as seller_gstin,
           metadata->>'seller_state_code' as seller_state_code,
           metadata->>'seller_fssai_number' as seller_fssai,
           created_at
    FROM public.invoice
    ORDER BY created_at ASC
  `);
  console.log(JSON.stringify(invs.rows, null, 2));

  console.log('\n=== PHASE B: 5. BRANCH TAX CONFIGURATIONS ===');
  const branches = await c.query(`
    SELECT id, code, name, city, state, 
           metadata->>'gstin' as branch_gstin,
           metadata->>'fssai_number' as branch_fssai
    FROM public.branch
    LIMIT 5
  `);
  console.log(JSON.stringify(branches.rows, null, 2));

  await c.query('COMMIT');
  await c.end();
}

main().catch(console.error);
