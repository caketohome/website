const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

async function checkCustomerFk() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    const custCount = await client.query('SELECT count(*) FROM public.customer');
    console.log('Total customers:', custCount.rows[0].count);

    const guestCust = await client.query("SELECT * FROM public.customer WHERE id = 'guest' OR email LIKE '%guest%' LIMIT 5");
    console.log('Guest customer rows:', guestCust.rows);

    const ordCust = await client.query('SELECT customer_id, count(*) FROM public."order" GROUP BY customer_id ORDER BY count(*) DESC LIMIT 5');
    console.log('Top order customer_ids:', ordCust.rows);

    // Check if customer_id in journal lines has been used in test runs
    const jlineCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'accounting_journal_line' AND column_name IN ('customer_id', 'supplier_id');
    `);
    console.log('Journal line customer/supplier columns:', jlineCols.rows);

    // Check sales-posting service how it sets journal lines in Step 4.4
    // We already saw sales-posting service commercialLines
  } finally {
    await client.end();
  }
}

checkCustomerFk().catch(console.error);
