const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const envContent = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).substring(13).trim();

async function check() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const res = await client.query(`
    SELECT
      tc.table_name, kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule, rc.delete_rule
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND (tc.table_name IN ('inventory_cost_lot', 'inventory_movement', 'purchase_item', 'branch_inventory', 'order_item', 'line_item')
           OR ccu.table_name IN ('product', 'product_variant'))
  `);
  console.table(res.rows);
  await client.end();
}
check().catch(console.error);
