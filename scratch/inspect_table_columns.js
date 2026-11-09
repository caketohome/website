const { Client } = require("../frontend/node_modules/pg");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function inspectColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const prodCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'product'
      ORDER BY ordinal_position
    `);
    console.log("=== PRODUCT TABLE COLUMNS ===");
    prodCols.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable}, default: ${r.column_default})`));

    const varCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'product_variant'
      ORDER BY ordinal_position
    `);
    console.log("\n=== PRODUCT_VARIANT TABLE COLUMNS ===");
    varCols.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable}, default: ${r.column_default})`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectColumns();
