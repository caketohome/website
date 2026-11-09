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

async function inspect12Unmapped() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const unmappedProductIds = [
    "prod_01KXYMAJKNDZ4T2YVA7K144XP5",
    "prod_01KXYMAJKNH99E1TMWYGQGT61D",
    "prod_01KXYMAJKNS8AGWCN5S1WEGKSD",
    "prod_01KXYMAJKNV48P1B9CM7C022YM",
    "prod_1",
    "prod_2",
    "prod_3",
    "prod_4",
    "prod_5",
    "prod_dist_pg_persisted_test",
    "prod_dist_test_01",
    "prod_dist_test_02",
  ];

  try {
    const res = await client.query(`
      SELECT p.id, p.title, p.handle, p.merchandise_type, p.status, p.metadata, p.created_at
      FROM public.product p
      WHERE p.id = ANY($1)
    `, [unmappedProductIds]);

    console.log("=== INSPECTION OF 12 UNMAPPED PRODUCTS ===");
    for (const r of res.rows) {
      const m = r.metadata || {};
      console.log(`\nProduct ID: ${r.id}`);
      console.log(`Title: ${r.title}`);
      console.log(`Handle: ${r.handle}`);
      console.log(`Merchandise Type: ${r.merchandise_type}`);
      console.log(`Status: ${r.status}`);
      console.log(`Category: ${m.category} (slug: ${m.category_slug})`);
      console.log(`HSN Code: ${m.hsn_code} | Desc: ${m.hsn_description}`);
      console.log(`Metadata Tax Fields: gst_rate=${m.gst_rate}, tax_class=${m.tax_class}, tax_rate_id=${m.tax_rate_id}`);
      console.log(`Taxability: ${m.taxability} | Tax Inclusive: ${m.tax_inclusive}`);
      console.log(`PIM Config:`, m.pim_config);
    }

    // Check tax_rate table
    const taxRates = await client.query(`SELECT id, code, name, rate FROM public.tax_rate WHERE deleted_at IS NULL`);
    console.log("\nActive Tax Master Rates in PostgreSQL:", taxRates.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspect12Unmapped();
