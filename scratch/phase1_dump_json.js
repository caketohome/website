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

async function dumpProductMaster() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const res = await pool.query(`
      SELECT 
        p.id,
        p.title,
        p.handle,
        p.status,
        p.deleted_at,
        p.description,
        p.weight,
        p.metadata
      FROM public.product p
      ORDER BY p.id ASC;
    `);

    const summary = {
      total: res.rows.length,
      active: res.rows.filter(r => r.deleted_at === null).length,
      deleted: res.rows.filter(r => r.deleted_at !== null).length,
      active_with_hsn: res.rows.filter(r => r.deleted_at === null && r.metadata?.hsn_code && r.metadata.hsn_code.trim() !== "").length,
      active_without_hsn: res.rows.filter(r => r.deleted_at === null && (!r.metadata?.hsn_code || r.metadata.hsn_code.trim() === "")).length,
      deleted_with_hsn: res.rows.filter(r => r.deleted_at !== null && r.metadata?.hsn_code && r.metadata.hsn_code.trim() !== "").length,
      deleted_without_hsn: res.rows.filter(r => r.deleted_at !== null && (!r.metadata?.hsn_code || r.metadata.hsn_code.trim() === "")).length,
    };

    const products = res.rows.map(r => ({
      id: r.id,
      title: r.title,
      handle: r.handle,
      status: r.status,
      is_deleted: r.deleted_at !== null,
      deleted_at: r.deleted_at,
      description: r.description,
      weight: r.weight,
      category: r.metadata?.category,
      category_slug: r.metadata?.category_slug,
      hsn_code: r.metadata?.hsn_code || null,
      hsn_description: r.metadata?.hsn_description || null,
      gst_rate: r.metadata?.gst_rate ?? null,
      tax_class: r.metadata?.tax_class || null,
      tax_configuration_id: r.metadata?.tax_configuration_id || null,
      uqc: r.metadata?.uqc || null,
      flavour: r.metadata?.flavour || null,
      cake_base: r.metadata?.cake_base || null,
      filling: r.metadata?.filling || null,
      cream: r.metadata?.cream || null,
      brand: r.metadata?.brand || null,
      tags: r.metadata?.tags || null,
      price: r.metadata?.selling_price || r.metadata?.price || null,
      raw_metadata_keys: Object.keys(r.metadata || {}),
    }));

    fs.writeFileSync(
      path.join(__dirname, "product_master_dump.json"),
      JSON.stringify({ summary, products }, null, 2)
    );

    console.log("Summary:", JSON.stringify(summary, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

dumpProductMaster();
