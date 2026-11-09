const path = require("path");
const pgPath = path.join(__dirname, "../backend/node_modules/pg");
const { Client } = require(pgPath);

const connectionString = "[REDACTED_DATABASE_CREDENTIAL]";

async function inspectSchemas() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = ["branch", "city", "region", "delivery_zone", "customer", "offer", "product"];
  for (const table of tables) {
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = $1;
    `, [table]);
    console.log(`\n================ SCHEMA FOR TABLE '${table}' ================`);
    console.table(colRes.rows);
  }

  await client.end();
}

inspectSchemas();
