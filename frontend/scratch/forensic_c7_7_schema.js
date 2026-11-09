const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function inspect() {
  const client = await pool.connect();
  try {
    const checkTables = [
      'order',
      'order_line_item',
      'order_address',
      'order_shipping',
      'invoice',
      'customer_receipt_allocation',
      'delivery',
      'delivery_slot',
      'tax_rate',
      'tax_region',
      'tax_rate_rule',
      'credit_line',
      'order_credit_line'
    ];

    for (const t of checkTables) {
      const exists = (await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`, [t])).rows[0].exists;
      if (exists) {
        const cols = (await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
          ORDER BY ordinal_position;
        `, [t])).rows;
        const count = (await client.query(`SELECT COUNT(*) FROM "${t}"`)).rows[0].count;
        console.log(`\n=== Columns for [${t}] (count: ${count}) ===`);
        cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
      } else {
        console.log(`\n[${t}] DOES NOT EXIST`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
