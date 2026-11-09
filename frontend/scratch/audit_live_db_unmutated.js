const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function inspect() {
  await client.connect();
  console.log('=== DATABASE RE-CHECK AFTER DRY RUN ===\n');

  // 1. Sequence check
  const seqRes = await client.query(`
    SELECT last_value, is_called 
    FROM public.statutory_invoice_seq
  `);
  console.log('1. statutory_invoice_seq state:', seqRes.rows[0]);

  // 2. Column check on order table
  const ordCol = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'order' AND column_name = 'order_number'
  `);
  console.log('2. order.order_number column exists in Supabase:', ordCol.rows.length > 0);

  // 3. Numbering tables existence check
  const tblCheck = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
  `);
  console.log('3. Numbering tables currently committed in Supabase:', tblCheck.rows.map(r => r.table_name));

  // 4. Invariant row counts
  const invCount = await client.query('SELECT COUNT(*) as count FROM public.invoice');
  console.log('4. public.invoice total rows:', invCount.rows[0].count);

  const ordCount = await client.query('SELECT COUNT(*) as count FROM public."order"');
  console.log('5. public.order total rows:', ordCount.rows[0].count);

  const vchCount = await client.query('SELECT COUNT(*) as count FROM public.accounting_voucher');
  console.log('6. public.accounting_voucher total rows:', vchCount.rows[0].count);

  await client.end();
}

inspect().catch(console.error);
