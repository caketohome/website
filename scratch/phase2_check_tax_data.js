const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  const rates = await pool.query('SELECT * FROM tax_rate ORDER BY created_at');
  console.log('=== tax_rate ===');
  rates.rows.forEach(r => console.log(JSON.stringify(r)));
  
  const regions = await pool.query('SELECT * FROM tax_region ORDER BY created_at');
  console.log('\n=== tax_region ===');
  regions.rows.forEach(r => console.log(JSON.stringify(r)));

  // Check for tax-related settings
  const settings = await pool.query("SELECT * FROM setting WHERE \"group\" LIKE '%tax%' OR key LIKE '%tax%' ORDER BY \"group\", key");
  console.log('\n=== tax-related settings ===');
  settings.rows.forEach(r => console.log(`${r.group}.${r.key} = ${r.value}`));

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
