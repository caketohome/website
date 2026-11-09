const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  const rates = await pool.query('SELECT id, rate, code, name, is_default, tax_region_id FROM tax_rate ORDER BY created_at');
  console.log('TAX_RATES:');
  console.log(JSON.stringify(rates.rows, null, 2));

  const regions = await pool.query('SELECT id, country_code, province_code FROM tax_region LIMIT 10');
  console.log('\nTAX_REGIONS:');
  console.log(JSON.stringify(regions.rows, null, 2));

  // Check for a tax_configuration table
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%tax%'");
  console.log('\nTAX TABLES:', tables.rows.map(r => r.table_name).join(', '));

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
