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

async function inspectAllProducts() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  const res = await client.query(`
    SELECT id, title, handle, metadata->>'category' as category, metadata->>'category_slug' as category_slug
    FROM public.product
    ORDER BY id;
  `);

  console.log(`TOTAL PRODUCTS: ${res.rows.length}`);
  const catSummary = {};
  for (const p of res.rows) {
    const cat = p.category || 'NULL_CATEGORY';
    if (!catSummary[cat]) catSummary[cat] = [];
    catSummary[cat].push({ id: p.id, title: p.title, slug: p.category_slug });
  }

  for (const [c, prods] of Object.entries(catSummary)) {
    console.log(`\nCATEGORY: "${c}" (${prods.length} products)`);
    prods.slice(0, 3).forEach(p => console.log(`  - [${p.id}] ${p.title} (slug: ${p.slug})`));
    if (prods.length > 3) console.log(`    ... and ${prods.length - 3} more`);
  }

  // Check product table columns and constraints
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'product'
    ORDER BY ordinal_position;
  `);
  console.log('\nPRODUCT COLUMNS:');
  console.log(JSON.stringify(cols.rows.map(c => `${c.column_name}: ${c.data_type} (null: ${c.is_nullable})`), null, 2));

  await client.end();
}
inspectAllProducts().catch(console.error);
