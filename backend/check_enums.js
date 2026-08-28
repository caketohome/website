const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

async function checkEnums() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public';
  `);

  console.log("Enums in public schema:", res.rows);

  const sampleOrders = await client.query(`SELECT id, status FROM "order"`);
  console.log("Sample existing orders in DB:", sampleOrders.rows);

  await client.end();
}

checkEnums();
