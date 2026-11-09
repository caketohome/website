const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const env = fs.readFileSync('.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/^['\"]|['\"]$/g, '');
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  const tx = await client.query('BEGIN');
  console.log('Testing deferred constraints...');
  // Check constraint trigger definition
  // Test transaction detection
  const res = await client.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'chk_teller_movement_direction_type'");
  console.log('chk_teller_movement_direction_type:', res.rows[0]);
  await client.query('ROLLBACK');
  await client.end();
}
run().catch(console.error);
