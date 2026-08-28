const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

async function checkShop() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'shop' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);

  console.log("Shop columns:", res.rows);
  const existingShops = await client.query(`SELECT * FROM "shop"`);
  console.log("Existing shops in DB:", existingShops.rows);

  await client.end();
}

checkShop();
