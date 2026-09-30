const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function check() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  // Check how many non-acc products exist in branch_inventory
  const nonAcc = await client.query(`
    SELECT COUNT(*) as cnt 
    FROM public.branch_inventory bi
    WHERE bi.product_id NOT LIKE 'acc_%';
  `);
  console.log('Non-accessory products in branch_inventory:', nonAcc.rows[0].cnt);

  // Check all products in product table:
  const cakes = await client.query(`
    SELECT id, title, metadata->>'category' as category
    FROM public.product
    WHERE id NOT LIKE 'acc_%'
    LIMIT 10;
  `);
  console.log('Sample actual cake products in product table:');
  console.log(JSON.stringify(cakes.rows, null, 2));

  // Check if any of these actual cake products are in branch_inventory:
  const actualCakesInInv = await client.query(`
    SELECT COUNT(*) as cnt
    FROM public.branch_inventory bi
    JOIN public.product p ON bi.product_id = p.id
    WHERE p.id NOT LIKE 'acc_%';
  `);
  console.log('Actual cake products in branch_inventory:', actualCakesInInv.rows[0].cnt);

  await client.end();
}
check().catch(console.error);
