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

async function inspectProductClassification() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('=== 1. CHECK TABLES RELATED TO CATEGORIES / PRODUCTS ===');
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%product%' OR table_name LIKE '%cat%' OR table_name LIKE '%type%' OR table_name LIKE '%collection%')
    ORDER BY table_name;
  `);
  console.log(JSON.stringify(tables.rows.map(r => r.table_name), null, 2));

  console.log('\n=== 2. COLUMNS OF product TABLE ===');
  const prodCols = await client.query(`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product'
    ORDER BY ordinal_position;
  `);
  console.log(JSON.stringify(prodCols.rows.map(r => `${r.column_name} (${r.udt_name})`), null, 2));

  console.log('\n=== 3. DISTINCT CATEGORIES / METADATA IN product TABLE ===');
  const cats = await client.query(`
    SELECT 
      type_id,
      collection_id,
      metadata->>'category' as category_meta,
      metadata->>'item_type' as item_type_meta,
      COUNT(*) as count
    FROM public.product
    GROUP BY type_id, collection_id, metadata->>'category', metadata->>'item_type'
    ORDER BY count DESC;
  `);
  console.log(JSON.stringify(cats.rows, null, 2));

  console.log('\n=== 4. CHECK IF product_category / product_type TABLES EXIST AND HAVE ROWS ===');
  for (const t of ['product_category', 'product_type', 'product_collection', 'category']) {
    try {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${t}"`);
      console.log(`Table ${t} has ${res.rows[0].cnt} rows`);
    } catch (e) {
      console.log(`Table ${t} does not exist or error: ${e.message}`);
    }
  }

  await client.end();
}

inspectProductClassification().catch(console.error);
