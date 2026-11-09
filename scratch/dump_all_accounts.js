const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const fs = require('fs');

async function dumpAccounts() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test'
  });
  await client.connect();

  const res = await client.query(`
    SELECT code, name, type, subtype, is_group, is_system, is_active, tax_rate, tax_class, description
    FROM public.accounting_account
    WHERE deleted_at IS NULL
    ORDER BY code ASC
  `);

  console.log(`Dumping ${res.rowCount} accounts to scratch/chart_of_accounts_dump.json...`);
  fs.writeFileSync(
    path.resolve(__dirname, 'chart_of_accounts_dump.json'),
    JSON.stringify(res.rows, null, 2),
    'utf8'
  );
  console.log('DONE!');
  await client.end();
}

dumpAccounts().catch(console.error);
