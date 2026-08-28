const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

async function checkBranch() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const existingBranches = await client.query(`SELECT id, name, code, shop_id, city_id FROM "branch" LIMIT 5`);
  console.log("Sample existing branches in DB:", existingBranches.rows);

  await client.end();
}

checkBranch();
