const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });
async function main() {
  await client.connect();
  const res = await client.query("SELECT * FROM public.product_variant WHERE product_id = 'prod_01KXYMAJKNWZCFXJHESPTZE01G' LIMIT 1;");
  console.log('Variant:', res.rows[0]);
  await client.end();
}
main().catch(console.error);
