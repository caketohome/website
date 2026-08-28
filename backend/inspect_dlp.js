const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

async function checkDlp() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'delivery_partner' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);

  console.log("delivery_partner columns:", res.rows);

  const sample = await client.query(`SELECT * FROM "delivery_partner" LIMIT 3`);
  console.log("Sample delivery_partner rows:", sample.rows);

  await client.end();
}

checkDlp();
