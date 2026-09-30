const path = require("path");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const res = await c.query(`
    SELECT
      id,
      name,
      metadata->>'operational_status' as status,
      metadata->'weekly_schedule' as schedule,
      metadata->'delivery_zones' as zones,
      metadata->'fulfillment_rules' as rules
    FROM branch
    WHERE name NOT LIKE '%Pipeline%' AND name NOT LIKE '%E2E%'
    LIMIT 10;
  `);

  console.log("Real Branches Found:", res.rows.length);
  for (const b of res.rows) {
    console.log(`- ID: ${b.id}, Name: ${b.name}`);
    console.log(`  Schedule keys: ${b.schedule ? Object.keys(b.schedule) : 'none'}`);
    console.log(`  Fulfillment rules:`, b.rules);
  }

  // Also query delivery slots via API for one of these branches
  if (res.rows.length > 0) {
    const realBranch = res.rows[0];
    const todayStr = new Date().toISOString().slice(0, 10);
    const apiRes = await fetch(`http://localhost:3000/api/v1/fulfillment/delivery-slots?branch_id=${realBranch.id}&date=${todayStr}&mode=delivery`);
    const apiBody = await apiRes.json();
    console.log(`\nSlots API result for ${realBranch.id} (${realBranch.name}):`);
    console.log(apiBody);
  }

  await c.end();
}

main();
