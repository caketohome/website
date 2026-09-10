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
    console.log('[DB Schema Audit] Connected to PostgreSQL');

    // 1. List all public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const allTables = tablesRes.rows.map(r => r.table_name);
    console.log('\n--- All Public Tables (' + allTables.length + ') ---');
    console.log(allTables.join(', '));

    // 2. Filter order-related tables
    const orderTables = allTables.filter(t => 
      t.includes('order') || t.includes('item') || t.includes('payment') || 
      t.includes('deliver') || t.includes('invent') || t.includes('cart') ||
      t.includes('invoice') || t.includes('refund') || t.includes('history')
    );
    console.log('\n--- Order/Fulfillment Lifecycle Tables ---');
    console.log(orderTables.join(', '));

    // 3. Inspect columns for key tables
    for (const tbl of orderTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tbl]);
      console.log(`\nTable [${tbl}]:`);
      colRes.rows.forEach(c => {
        console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`);
      });

      // Count rows
      try {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM "${tbl}";`);
        console.log(`  Row count: ${countRes.rows[0].count}`);
      } catch (err) {
        console.log(`  Count error: ${err.message}`);
      }
    }

    await client.end();
    console.log('\n[DB Schema Audit] Inspection completed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('Error during schema audit:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

main();
