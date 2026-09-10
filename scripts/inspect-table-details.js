const path = require('path');
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../frontend/.env') });
}

const { Client } = require(path.join(__dirname, '../backend/node_modules/pg'));

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    for (const tbl of ['order', 'order_item', 'order_status_history', 'order_note', 'delivery', 'delivery_partner', 'payment_transaction', 'branch_inventory']) {
      const colRes = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position;
      `, [tbl]);
      const cnt = await client.query(`SELECT count(*) FROM "${tbl}"`);
      console.log(`\nTable: ${tbl} (rows: ${cnt.rows[0].count})`);
      console.log('Columns: ' + colRes.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
      
      // Sample 1 row if available
      if (Number(cnt.rows[0].count) > 0) {
        const sampleRes = await client.query(`SELECT * FROM "${tbl}" LIMIT 1`);
        const row = sampleRes.rows[0];
        // Clean metadata for printing
        console.log('Sample Keys:', Object.keys(row));
        if (row.metadata) {
          console.log('Sample Metadata Keys:', Object.keys(row.metadata));
        }
      }
    }

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

main();
