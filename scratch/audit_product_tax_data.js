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

async function auditProducts() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const res = await c.query(`
    SELECT p.id, p.title, p.handle, p.metadata
    FROM public.product p
    WHERE p.deleted_at IS NULL
    ORDER BY p.id
  `);

  console.log(`Total products: ${res.rows.length}`);
  const report = res.rows.map(r => {
    const meta = r.metadata || {};
    return {
      id: r.id,
      title: r.title,
      gst_rate: meta.gst_rate ?? null,
      tax_class: meta.tax_class ?? null,
      tax_configuration_id: meta.tax_configuration_id ?? null,
      hsn_code: meta.hsn_code ?? null,
      category: meta.category ?? null,
      category_slug: meta.category_slug ?? null,
    };
  });

  console.table(report);

  // Group by status
  const mapped = report.filter(r => r.gst_rate !== null || r.tax_configuration_id !== null);
  const unmapped = report.filter(r => r.gst_rate === null && (r.tax_configuration_id === null || r.tax_configuration_id === 'txcfg_food_5'));
  console.log(`Explicit gst_rate set: ${report.filter(r => r.gst_rate !== null).length}`);
  console.log(`Missing gst_rate: ${report.filter(r => r.gst_rate === null).length}`);

  await c.end();
}

auditProducts().catch(console.error);
