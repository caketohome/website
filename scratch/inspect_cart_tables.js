const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const fks = await pool.query(`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('cart', 'cart_line_item');
  `);
  console.log('Foreign keys on cart & cart_line_item:', fks.rows);

  // Check sales channel and region in DB for default cart references
  const sc = await pool.query('SELECT id FROM sales_channel LIMIT 1');
  console.log('Sample sales_channel:', sc.rows[0]);
  const reg = await pool.query('SELECT id FROM region LIMIT 1');
  console.log('Sample region:', reg.rows[0]);

  await pool.end();
}

main().catch(console.error);
