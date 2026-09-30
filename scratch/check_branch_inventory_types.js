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
      count(*) FILTER (WHERE bi.product_id LIKE 'acc_%') as accessory_count,
      count(*) FILTER (WHERE bi.product_id NOT LIKE 'acc_%') as non_accessory_count
    FROM branch_inventory bi
    WHERE bi.deleted_at IS NULL;
  `);

  console.log("Branch Inventory Product Breakdown:", res.rows[0]);

  // Check distinct product titles in branch_inventory
  const distinctProds = await c.query(`
    SELECT DISTINCT bi.product_id, p.title, p.metadata->>'category' as category
    FROM branch_inventory bi
    LEFT JOIN product p ON bi.product_id = p.id
    WHERE bi.deleted_at IS NULL;
  `);
  console.log("\nAll Products with physical inventory in branch_inventory:");
  console.table(distinctProds.rows);

  await c.end();
}

main();
