const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

async function checkSettingIndices() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'setting' AND schemaname = 'public';
  `);

  console.log("Setting indices:", res.rows);

  const existing = await client.query(`SELECT id, "group", "key", value FROM "setting"`);
  console.log("Existing settings in DB:", existing.rows);

  await client.end();
}

checkSettingIndices();
