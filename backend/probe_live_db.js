const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function probe() {
  console.log("🐘 Connecting to:", connectionString.replace(/:[^:@]+@/, ":****@"));
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log("✅ Live PostgreSQL Database Connected Successfully!");

    const tablesRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name;
    `);

    console.log(`\nFound ${tablesRes.rows.length} tables in PostgreSQL:`);
    for (const r of tablesRes.rows) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${r.table_schema}"."${r.table_name}"`);
      console.log(` - [${r.table_schema}] ${r.table_name} (${countRes.rows[0].count} rows)`);
    }

    await client.end();
  } catch (err) {
    console.error("❌ Database probe failed:", err.message);
    process.exit(1);
  }
}

probe();
