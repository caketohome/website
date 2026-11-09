const { Pool } = require("../frontend/node_modules/pg");
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

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
        AND (table_name ILIKE '%tax%' OR table_name ILIKE '%hsn%' OR table_name ILIKE '%gst%')
      ORDER BY table_name;
    `);
    console.log("Matching tables:", r.rows.map(x => x.table_name));

    // Also check if any table named 'supplier' or 'catalog' has HSN info
    const supCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='supplier';
    `);
    console.log("Supplier columns:", supCols.rows.map(x => x.column_name));

    // Check gst_registration table
    const gstReg = await pool.query(`SELECT * FROM public.gst_registration LIMIT 5;`);
    console.log("GST Registrations:", gstReg.rows);

  } finally {
    await pool.end();
  }
}

checkTables();
