const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN TRANSACTION READ ONLY');

  console.log('=== CHECK CONFIG_AUDIT_LOG ===');
  try {
    const res = await c.query("SELECT * FROM public.config_audit_log WHERE config_key LIKE '%accounting%' OR config_key LIKE '%start_date%'");
    console.log(res.rows);
  } catch (e) {
    console.log('Error querying config_audit_log:', e.message);
  }

  console.log('\n=== CHECK AUDIT_LOG FOR ACCOUNTING START DATE ===');
  try {
    const res2 = await c.query("SELECT * FROM public.audit_log WHERE entity = 'setting' OR action LIKE '%accounting%' OR action LIKE '%setting%'");
    console.log('audit_log setting/accounting rows:', res2.rows);
  } catch (e) {
    console.log('Error querying audit_log:', e.message);
  }

  await c.query('COMMIT');
  await c.end();
}

main().catch(console.error);
