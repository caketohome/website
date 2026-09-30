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
  throw new Error("No database connection string found");
}

async function inspect() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log("=== COLUMNS OF branch_inventory ===");
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'branch_inventory' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  console.log(cols.rows);

  console.log("\n=== CONSTRAINTS OF branch_inventory ===");
  const cons = await client.query(`
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'branch_inventory'
    ORDER BY tc.constraint_name, kcu.ordinal_position;
  `);
  console.log(cons.rows);

  console.log("\n=== INDEXES OF branch_inventory ===");
  const idxs = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'branch_inventory';
  `);
  console.log(idxs.rows);

  await client.end();
}

inspect();
