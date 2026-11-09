const path = require('path');
const Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;

async function checkEquity() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await client.connect();
  const res = await client.query("SELECT id, code, name, type, subtype FROM public.accounting_account WHERE type = 'EQUITY' OR code LIKE '3%' ORDER BY code;");
  console.log('Equity accounts:', res.rows);
  const offset = await client.query("SELECT id, code, name, type, subtype FROM public.accounting_account WHERE subtype = 'OPENING_OFFSET' OR name ILIKE '%opening%';");
  console.log('Opening offset accounts:', offset.rows);
  await client.end();
}

checkEquity().catch(console.error);
