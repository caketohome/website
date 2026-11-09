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

async function inspectSharedInventory() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("=== SHARED INVENTORY TABLE INSPECTION ===");
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'shared_inventory'
      ORDER BY ordinal_position
    `);
    console.log("Columns of shared_inventory:", cols.rows);

    const rows = await client.query(`
      SELECT * FROM public.shared_inventory LIMIT 20
    `);
    console.log("Sample rows of shared_inventory:", rows.rows);

    // Also check other inventory tables
    const otherTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%invent%'
    `);
    console.log("All inventory tables in public:", otherTables.rows.map(r => r.table_name));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectSharedInventory();
