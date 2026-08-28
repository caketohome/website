import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../backend/.env") });

async function checkDb() {
  const connectionString = process.env.DATABASE_URL;
  console.log("Connecting to database:", connectionString?.replace(/:[^:@]+@/, ":****@"));

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Live PostgreSQL Database Connected Successfully!");

    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name;
    `);

    console.log(`\nFound ${res.rows.length} tables in PostgreSQL:`);
    res.rows.forEach((r) => {
      console.log(` - [${r.table_schema}] ${r.table_name}`);
    });

    await client.end();
  } catch (err: any) {
    console.error("❌ Database Connection Failed:", err.message);
    process.exit(1);
  }
}

checkDb();
