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

  const orders = await c.query(`
    SELECT
      id,
      customer_id,
      email,
      metadata->>'customer_id' as meta_cust_id,
      metadata->>'customer_phone' as meta_phone,
      metadata->>'customer_name' as meta_name
    FROM "order"
    LIMIT 15;
  `);
  console.log("Sample Orders:");
  console.log(orders.rows);

  const sampleCusts = await c.query(`
    SELECT id, email, phone, metadata->>'customer_uid' as cust_uid
    FROM customer
    LIMIT 10;
  `);
  console.log("\nSample Customers:");
  console.log(sampleCusts.rows);

  // Check how many orders have an email or phone matching a customer
  const matchRes = await c.query(`
    SELECT
      count(*) as total_orders,
      count(*) FILTER (WHERE c_by_id.id IS NOT NULL) as matched_by_id,
      count(*) FILTER (WHERE c_by_email.id IS NOT NULL) as matched_by_email,
      count(*) FILTER (WHERE c_by_phone.id IS NOT NULL) as matched_by_phone
    FROM "order" o
    LEFT JOIN customer c_by_id ON o.customer_id = c_by_id.id
    LEFT JOIN customer c_by_email ON LOWER(o.email) = LOWER(c_by_email.email)
    LEFT JOIN customer c_by_phone ON (o.metadata->>'customer_phone') = c_by_phone.phone;
  `);
  console.log("\nOrder <-> Customer Matching Analysis:");
  console.log(matchRes.rows[0]);

  // Check duplicate branch names
  const dupBranches = await c.query(`
    SELECT name, count(*), string_agg(id, ', ') as ids
    FROM branch
    GROUP BY name
    HAVING count(*) > 1;
  `);
  console.log("\nDuplicate Branch Names:");
  console.log(dupBranches.rows);

  await c.end();
}

main();
