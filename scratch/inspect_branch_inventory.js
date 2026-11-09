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

async function inspectBranchInventory() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const biCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'branch_inventory'
      ORDER BY ordinal_position
    `);
    console.log("=== BRANCH INVENTORY COLUMNS ===");
    biCols.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

    const biRows = await client.query(`
      SELECT bi.*, b.name as branch_name, p.title as prod_title, p.merchandise_type
      FROM public.branch_inventory bi
      LEFT JOIN public.branch b ON b.id = bi.branch_id
      LEFT JOIN public.product p ON p.id = bi.product_id
      LIMIT 20
    `);
    console.log(`\nTotal branch_inventory sample rows (${biRows.rows.length}):`);
    biRows.rows.forEach(r => console.log(` [${r.id}] Branch=${r.branch_name || r.branch_id} | Prod=${r.product_id} (${r.prod_title || 'N/A'}, type=${r.merchandise_type}) | Qty=${r.quantity}, Res=${r.reserved}`));

    const countRes = await client.query(`SELECT COUNT(*) FROM public.branch_inventory`);
    console.log(`Total rows in branch_inventory: ${countRes.rows[0].count}`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectBranchInventory();
