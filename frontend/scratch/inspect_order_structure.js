const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found in environment or backend/.env");
}

async function inspectOrderStructure() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== INSPECTING ORDER LINE ITEMS & STORAGE ===");

  // Check line_item table
  try {
    const liCols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'line_item';`);
    console.log("line_item columns:", liCols.rows);
    const liCount = await client.query(`SELECT count(*)::int as cnt FROM public.line_item;`);
    console.log("line_item row count:", liCount.rows[0].cnt);
    const liSample = await client.query(`SELECT * FROM public.line_item LIMIT 2;`);
    console.log("line_item sample:", JSON.stringify(liSample.rows, null, 2));
  } catch (e) {
    console.log("line_item table error:", e.message);
  }

  // Check how orders link to items
  const sampleWithItems = await client.query(`
    SELECT id, order_number, total, subtotal, tax_total, metadata
    FROM public."order"
    WHERE metadata->'items' IS NOT NULL AND jsonb_array_length(metadata->'items') > 0
    LIMIT 2;
  `);
  console.log("Orders with metadata.items:", JSON.stringify(sampleWithItems.rows, null, 2));

  // Check purchase and purchase_item details
  const pCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_item'
    ORDER BY ordinal_position;
  `);
  console.log("purchase_item columns:", JSON.stringify(pCols.rows, null, 2));

  // Check branch table
  const branches = await client.query(`SELECT id, name, code FROM public.branch LIMIT 5;`);
  console.log("branch sample:", JSON.stringify(branches.rows, null, 2));

  // Check suppliers
  const suppliers = await client.query(`SELECT count(*)::int as cnt FROM public.supplier;`);
  console.log("supplier count:", suppliers.rows[0].cnt);

  await client.end();
}

inspectOrderStructure().catch(console.error);
