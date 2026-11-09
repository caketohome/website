const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function inspectBranches() {
  const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });
  await client.connect();
  const branches = await client.query('SELECT id, name, code FROM public.branch;');
  console.log('Branches in DB:');
  console.table(branches.rows);
  const products = await client.query('SELECT id, title FROM public.product LIMIT 5;');
  console.log('Products in DB:');
  console.table(products.rows);
  await client.end();
}
inspectBranches().catch(console.error);

