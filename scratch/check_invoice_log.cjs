const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('=== INVOICE ALLOCATION LOG SUMMARY ===');
  const summary = await c.query(`
    SELECT count(*) as total, 
           max(sequence_value) as max_seq, 
           min(sequence_value) as min_seq,
           count(DISTINCT invoice_number) as distinct_inv
    FROM public.invoice_allocation_log
  `);
  console.log(summary.rows);

  console.log('\n=== ALL POSTGRESQL SEQUENCES ===');
  const seqs = await c.query("SELECT sequencename, last_value FROM pg_sequences");
  console.log(seqs.rows);

  console.log('\n=== ALL INVOICES IN PUBLIC.INVOICE ===');
  const allInvs = await c.query("SELECT id, invoice_number, order_id, created_at FROM public.invoice ORDER BY invoice_number ASC");
  console.log(allInvs.rows);

  await c.end();
}

main().catch(console.error);
