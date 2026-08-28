const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

async function checkMoreColumns() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const targetTables = ["branch", "delivery_zone", "city", "customer", "product", "product_category"];

  for (const table of targetTables) {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position;
    `, [table]);

    console.log(`\n📋 Table '${table}' (${res.rows.length} columns):`);
    res.rows.forEach(r => {
      console.log(`   - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
    });
  }

  await client.end();
}

checkMoreColumns().catch(console.error);
