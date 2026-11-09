const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

async function inspectSchema() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test'
  });
  await client.connect();

  const tables = ['accounting_account', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_fiscal_period'];
  for (const t of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    console.log(`\nTABLE: ${t} (${cols.rowCount} columns)`);
    for (const c of cols.rows) {
      console.log(`  - ${c.column_name.padEnd(25)} ${c.data_type}`);
    }
  }

  // Count active accounts
  const accCount = await client.query('SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL');
  console.log('\nTOTAL ACTIVE ACCOUNTS:', accCount.rows[0].count);

  await client.end();
}

inspectSchema().catch(console.error);
