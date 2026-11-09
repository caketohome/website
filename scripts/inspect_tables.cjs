const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });
async function main() {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log(res.rows.map(r => r.table_name).join(', '));
  await client.end();
}
main().catch(console.error);

