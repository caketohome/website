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

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND (
      table_name LIKE '%invoice%' OR 
      table_name LIKE '%order%' OR 
      table_name LIKE '%receivable%' OR 
      table_name LIKE '%receipt%' OR
      table_name LIKE '%credit_note%'
    )
    ORDER BY table_name
  `);
  console.log('Invoice / Order / AR tables:');
  console.table(tables.rows);

  // Check row counts for relevant tables
  for (const t of tables.rows) {
    try {
      const c = await client.query(`SELECT count(*)::int as count FROM public.${t.table_name}`);
      console.log(`  - ${t.table_name}: ${c.rows[0].count} rows`);
    } catch (e) {
      console.log(`  - ${t.table_name}: error (${e.message})`);
    }
  }

  // Inspect customer table
  const custCount = await client.query("SELECT count(*)::int as count FROM public.customer");
  console.log(`\nCustomer count: ${custCount.rows[0].count}`);

  // Inspect journal lines for account 1121
  const arLines = await client.query(`
    SELECT jl.id, jl.account_id, jl.debit_amount, jl.credit_amount, jl.customer_id, 
           v.voucher_no, v.voucher_date::text, v.reference_type, v.reference_id, v.narration
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    JOIN public.accounting_account ca ON ca.id = jl.account_id
    WHERE ca.code = '1121'
  `);
  console.log('\nJournal Lines on Account 1121 (Trade AR):');
  console.table(arLines.rows);

  await client.end();
}

run();
