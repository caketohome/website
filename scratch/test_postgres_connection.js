const { Client } = require("./backend/node_modules/pg");

const connectionString = "[REDACTED_DATABASE_CREDENTIAL]";

async function testConnection() {
  console.log("Connecting to PostgreSQL at Supabase...");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("SUCCESS: Connected to PostgreSQL!");
    const res = await client.query("SELECT NOW() as current_time, version();");
    console.log("PostgreSQL Time & Version:", res.rows[0]);

    // Check existing tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`Found ${tablesRes.rows.length} tables in PostgreSQL:`, tablesRes.rows.map(r => r.table_name));

    // Try querying shop_branch table
    const branchRes = await client.query("SELECT * FROM shop_branch LIMIT 5;").catch(e => ({ error: e.message }));
    console.log("Query 'shop_branch':", branchRes.error ? `Table issue: ${branchRes.error}` : branchRes.rows);

    await client.end();
  } catch (err) {
    console.error("PostgreSQL Connection Error:", err.message);
  }
}

testConnection();
