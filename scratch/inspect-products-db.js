const { Client } = require("../frontend/node_modules/pg");

const connectionString =
  process.env.DATABASE_URL ||
  "[REDACTED_DATABASE_CREDENTIAL]";

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const totalRes = await client.query(`SELECT count(*) FROM "product"`);
  const notDeletedRes = await client.query(`SELECT count(*) FROM "product" WHERE deleted_at IS NULL`);
  const statusRes = await client.query(`SELECT status, count(*) FROM "product" GROUP BY status`);
  const deletedRes = await client.query(`SELECT count(*) FROM "product" WHERE deleted_at IS NOT NULL`);
  
  console.log("Total products in product table:", totalRes.rows[0].count);
  console.log("Products with deleted_at IS NULL:", notDeletedRes.rows[0].count);
  console.log("Products with deleted_at IS NOT NULL:", deletedRes.rows[0].count);
  console.log("Status breakdown:", statusRes.rows);

  const allRows = await client.query(`SELECT id, title, handle, status, deleted_at, created_at FROM "product" ORDER BY created_at ASC`);
  console.log("\nAll Products list:");
  allRows.rows.forEach((r, i) => {
    console.log(`${i + 1}. [${r.id}] "${r.title}" (status: ${r.status}, deleted_at: ${r.deleted_at})`);
  });

  // Also check if any other table has products or if any shop/sales channel links filter them
  const scProdRes = await client.query(`SELECT count(*) FROM "product_sales_channel"`);
  console.log("\nProduct sales channel mappings:", scProdRes.rows[0].count);

  const shopProdRes = await client.query(`SELECT count(*) FROM "shopmodule_shop_product_product"`);
  console.log("Shop product mappings:", shopProdRes.rows[0].count);

  await client.end();
}

run().catch(console.error);
