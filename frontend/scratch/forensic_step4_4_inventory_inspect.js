const { Client } = require('../node_modules/pg');
const fs = require('fs');
const path = require('path');

function getDbUrl() {
  const env = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
  for (const line of env.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getDbUrl() });
  await client.connect();

  console.log('=== PRODUCT MERCHANDISE TYPES ===');
  const res = await client.query(`
    SELECT merchandise_type, count(*) as cnt 
    FROM public.product 
    GROUP BY merchandise_type
  `);
  console.log(res.rows);

  console.log('\n=== ACCESSORY PRODUCTS ===');
  const accs = await client.query(`
    SELECT id, title, merchandise_type 
    FROM public.product 
    WHERE merchandise_type = 'ACCESSORY'
  `);
  console.log(accs.rows);

  console.log('\n=== PACKAGING PRODUCTS ===');
  const packs = await client.query(`
    SELECT id, title, merchandise_type 
    FROM public.product 
    WHERE merchandise_type = 'PACKAGING'
  `);
  console.log(packs.rows);

  console.log('\n=== BRANCH INVENTORY SUMMARY ===');
  const binv = await client.query(`
    SELECT count(*) as total_rows, sum(quantity) as total_qty, sum(reserved) as total_res
    FROM public.branch_inventory
  `);
  console.log(binv.rows[0]);

  console.log('\n=== COST LOTS AND MOVEMENTS SUMMARY ===');
  const lots = await client.query(`SELECT count(*) as cnt FROM public.inventory_cost_lot`);
  const movs = await client.query(`SELECT count(*) as cnt FROM public.inventory_movement`);
  const cons = await client.query(`SELECT count(*) as cnt FROM public.inventory_cost_consumption`);
  console.log({ lots: lots.rows[0].cnt, movs: movs.rows[0].cnt, cons: cons.rows[0].cnt });

  await client.end();
}

run().catch(console.error);
