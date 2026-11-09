const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const compId = 'cth_company_1792842928354_umu7n';
  const tables = ['cost_centre', 'bank_account', 'expense', 'corporate_gifting_batch'];

  for (const t of tables) {
    try {
      const res = await c.query(`SELECT count(*) as cnt FROM public."${t}" WHERE company_id = $1`, [compId]);
      console.log(`Table ${t} rows referencing ${compId}:`, res.rows[0].cnt);
    } catch (e) {
      console.log(`Table ${t} check failed:`, e.message);
    }
  }

  // Check public.invoice columns
  const invCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoice' ORDER BY ordinal_position");
  console.log('Invoice columns:', invCols.rows.map(r => r.column_name));
  
  const invRows = await c.query('SELECT * FROM public.invoice LIMIT 5');
  console.log('Sample invoice rows:', invRows.rows);

  await c.end();
}

main().catch(console.error);
