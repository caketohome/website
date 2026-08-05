const path = require("path");
const pgPath = path.join(__dirname, "../backend/node_modules/pg");
const { Client } = require(pgPath);

const connectionString = "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

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
