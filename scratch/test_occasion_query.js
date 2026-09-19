const path = require('path');
const pgPath = path.resolve(__dirname, '../frontend/node_modules/pg');
const { Client } = require(pgPath);
const fs = require('fs');

const env = fs.readFileSync('frontend/.env', 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const dbUrl = match ? match[1].replace(/["']/g, '') : '';

const client = new Client({ connectionString: dbUrl });

async function run() {
  await client.connect();

  const all = await client.query("SELECT id, title, description, metadata FROM product WHERE deleted_at IS NULL");
  console.log(`Total active products in DB: ${all.rows.length}`);
  for (const p of all.rows) {
    console.log(`- [${p.id}] "${p.title}" | category: ${p.metadata?.category || p.metadata?.category_id} | occ: ${p.metadata?.occasion} | occ_ids: ${JSON.stringify(p.metadata?.occasion_ids)}`);
  }

  await client.end();
}

run().catch(console.error);
