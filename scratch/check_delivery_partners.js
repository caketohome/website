const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery_partner';");
    console.log('Columns:', cols.rows);

    const rows = await pool.query("SELECT * FROM delivery_partner;");
    console.log('Total rows in delivery_partner:', rows.rows.length);
    console.log(JSON.stringify(rows.rows, null, 2));

    // Check if there are other delivery related tables
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%deliver%';");
    console.log('Delivery tables in public schema:', tables.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
