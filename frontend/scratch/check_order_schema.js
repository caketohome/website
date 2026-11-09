const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.join(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

const pool = new Pool({ connectionString: dbUrl });

async function main() {
  const ordCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order' 
    ORDER BY ordinal_position
  `);
  console.log('ORDER COLUMNS:');
  console.table(ordCols.rows);

  // Check line items table
  const lineItemTables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%order%' OR table_name LIKE '%line_item%'
  `);
  console.log('ORDER RELATED TABLES:');
  console.table(lineItemTables.rows);

  const sampleOrder = await pool.query('SELECT * FROM public.order LIMIT 1');
  console.log('SAMPLE ORDER:', sampleOrder.rows[0]);

  await pool.end();
}

main().catch(console.error);
