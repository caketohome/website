const path = require('path');
const { Client } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const client = new Client({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer' ORDER BY ordinal_position");
  console.log('Customer columns:', cols.rows.map(r => `${r.column_name} (${r.data_type})`));
  const sample = await client.query("SELECT * FROM customer LIMIT 2");
  console.log('Customer sample:', JSON.stringify(sample.rows, null, 2));
  await client.end();
}

run().catch(e => {
  console.error('PG Error:', e.message);
  process.exit(1);
});
