const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('=== 1. FULL EXTRACTION: PUBLIC.COMPANY ===');
  const compRes = await c.query('SELECT * FROM public.company');
  console.log(JSON.stringify(compRes.rows, null, 2));

  console.log('\n=== 2. FULL EXTRACTION: PUBLIC.GST_REGISTRATION ===');
  const gstRes = await c.query('SELECT * FROM public.gst_registration');
  console.log(JSON.stringify(gstRes.rows, null, 2));

  console.log('\n=== 3. FOREIGN KEY REFERENCES TO PUBLIC.COMPANY ===');
  const fkCompRes = await c.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'company';
  `);
  console.log('Foreign keys targeting company:', fkCompRes.rows);

  console.log('\n=== 4. FOREIGN KEY REFERENCES TO PUBLIC.GST_REGISTRATION ===');
  const fkGstRes = await c.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'gst_registration';
  `);
  console.log('Foreign keys targeting gst_registration:', fkGstRes.rows);

  console.log('\n=== 5. CHECK DIRECT USAGE IN OTHER TABLES ===');
  // Check branch
  const branchCompCol = await c.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'branch' AND column_name IN ('company_id', 'gst_registration_id', 'gstin_id')
  `);
  console.log('Branch columns matching company/gst:', branchCompCol.rows.map(r => r.column_name));
  
  if (branchCompCol.rows.length > 0) {
    const branchRes = await c.query(`
      SELECT count(*) as total,
             count(CASE WHEN company_id = '${compRes.rows[0]?.id}' THEN 1 END) as matches_company,
             count(CASE WHEN gst_registration_id = '${gstRes.rows[0]?.id}' THEN 1 END) as matches_gst
      FROM public.branch
    `);
    console.log('Branch references to synthetic company/gst:', branchRes.rows[0]);
  }

  // Check invoice
  const invCompCol = await c.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'invoice' AND column_name IN ('company_id', 'gst_registration_id', 'gstin')
  `);
  console.log('Invoice columns matching company/gst:', invCompCol.rows.map(r => r.column_name));
  if (invCompCol.rows.length > 0) {
    const invRes = await c.query(`
      SELECT id, invoice_number, gstin, created_at FROM public.invoice LIMIT 10
    `);
    console.log('Sample invoice gstin records:', invRes.rows);
  }

  // Check invoice_sequence
  const seqRes = await c.query('SELECT * FROM public.invoice_sequence');
  console.log('Invoice sequence rows:', seqRes.rows);

  await c.end();
}

main().catch(console.error);
