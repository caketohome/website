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

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query(
      "SELECT id, title, merchandise_type, hs_code, metadata->>'gst_rate' as gst, metadata->>'tax_rate_id' as tax_rate_id, metadata->>'tax_code' as tax_code, metadata FROM public.product WHERE metadata->>'gst_rate' IS NOT NULL"
    );
    console.log("Products with gst_rate:", r.rows.map(x => ({
      id: x.id,
      title: x.title,
      merch: x.merchandise_type,
      hs_code: x.hs_code,
      gst: x.gst,
      tax_rate_id: x.tax_rate_id,
      tax_code: x.tax_code,
      hsn_code: x.metadata?.hsn_code,
      tax_classification: x.metadata?.tax_classification
    })));
  } finally {
    await pool.end();
  }
}

run().catch(console.error);
