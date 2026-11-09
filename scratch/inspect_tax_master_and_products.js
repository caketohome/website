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
    console.log("=== TAX_RATE_RULE COLUMNS ===");
    const ruleCols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tax_rate_rule'"
    );
    console.log(ruleCols.rows);

    console.log("=== INVOICE COLUMNS ===");
    const invCols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='invoice'"
    );
    console.log(invCols.rows.map(c => c.column_name));

    console.log("=== PURCHASE_ITEM COLUMNS ===");
    const piCols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_item'"
    );
    console.log(piCols.rows.map(c => c.column_name));

    console.log("=== CHECK ALL PRODUCTS TAX & HSN METADATA ===");
    const allProds = await pool.query(
      "SELECT id, title, handle, merchandise_type, hs_code, metadata->>'hsn_code' as hsn, metadata->>'gst_rate' as gst, metadata->>'tax_rate_id' as tax_rate_id, metadata->>'tax_code' as tax_code FROM public.product WHERE deleted_at IS NULL"
    );
    console.log(`Total active products: ${allProds.rows.length}`);
    const withGst = allProds.rows.filter(p => p.gst !== null && p.gst !== undefined);
    const withHsn = allProds.rows.filter(p => p.hsn || p.hs_code);
    const withTaxRateId = allProds.rows.filter(p => p.tax_rate_id);
    console.log(`Products with metadata.gst_rate: ${withGst.length}`);
    console.log(`Products with hsn/hs_code: ${withHsn.length}`);
    console.log(`Products with tax_rate_id: ${withTaxRateId.length}`);
    console.log("Products without metadata.gst_rate:", allProds.rows.filter(p => !p.gst).map(p => ({ id: p.id, title: p.title, merch: p.merchandise_type, hsn: p.hsn || p.hs_code })));

    console.log("=== CHECK ORDER_ITEM TAX FIELDS ===");
    const oiCols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='order_item'"
    );
    console.log(oiCols.rows.map(c => c.column_name));

  } finally {
    await pool.end();
  }
}

run().catch(console.error);
