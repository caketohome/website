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

async function inspectProducts() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("=== PIM PRODUCTS & VARIANTS AUDIT ===");

    // Fetch all active products
    const prodsRes = await client.query(`
      SELECT p.id, p.title, p.handle, p.status, p.merchandise_type, p.metadata, p.created_at, p.updated_at
      FROM public.product p
      WHERE p.status = 'published' AND (p.deleted_at IS NULL)
      ORDER BY p.id ASC
    `);

    console.log(`Total Published Products in PostgreSQL: ${prodsRes.rows.length}`);

    // Fetch all product variants
    const variantsRes = await client.query(`
      SELECT pv.id, pv.title, pv.product_id, pv.sku, pv.barcode, pv.manage_inventory, pv.allow_backorder, pv.metadata
      FROM public.product_variant pv
      WHERE pv.deleted_at IS NULL
      ORDER BY pv.product_id, pv.id
    `);
    console.log(`Total Active Product Variants in PostgreSQL: ${variantsRes.rows.length}`);

    // Group variants by product
    const variantsByProd = {};
    for (const v of variantsRes.rows) {
      if (!variantsByProd[v.product_id]) variantsByProd[v.product_id] = [];
      variantsByProd[v.product_id].push(v);
    }

    // Fetch tax_rate_rule records
    const rulesRes = await client.query(`
      SELECT trr.id, trr.reference, trr.reference_id, tr.code as tax_code, tr.rate, tr.name as tax_name
      FROM public.tax_rate_rule trr
      JOIN public.tax_rate tr ON tr.id = trr.tax_rate_id
      WHERE trr.deleted_at IS NULL AND tr.deleted_at IS NULL
    `);
    const rulesMap = {};
    for (const r of rulesRes.rows) {
      rulesMap[`${r.reference}:${r.reference_id}`] = r;
    }

    // Fetch inventory records if any exist
    let invMap = {};
    try {
      const invRes = await client.query(`
        SELECT product_id, SUM(quantity) as total_qty, SUM(reserved) as total_reserved
        FROM public.shared_inventory
        GROUP BY product_id
      `);
      for (const r of invRes.rows) {
        invMap[r.product_id] = r;
      }
    } catch (e) {
      console.log("shared_inventory query:", e.message);
    }

    let summary = [];
    for (const p of prodsRes.rows) {
      const m = p.metadata || {};
      const vars = variantsByProd[p.id] || [];
      const prodRule = rulesMap[`product:${p.id}`];
      const inv = invMap[p.id] || null;

      summary.push({
        id: p.id,
        title: p.title,
        handle: p.handle,
        merchandise_type: p.merchandise_type || m.merchandise_type || "UNSET",
        hsn: m.hsn_code || "MISSING",
        tax_class: m.tax_class || "UNSET",
        gst_rate: m.gst_rate !== undefined ? m.gst_rate : "UNSET",
        tax_rule: prodRule ? `${prodRule.tax_code} (${prodRule.rate}%)` : "NONE",
        variants_count: vars.length,
        variants: vars.map(v => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          manage_inv: v.manage_inventory,
          tax_rule: rulesMap[`product_variant:${v.id}`] ? rulesMap[`product_variant:${v.id}`].tax_code : "INHERIT"
        })),
        inv: inv ? `qty=${inv.total_qty}, res=${inv.total_reserved}` : "NONE"
      });
    }

    console.log("\n--- DETAILED PRODUCT LISTING ---");
    for (const s of summary) {
      console.log(`[${s.id}] "${s.title}"`);
      console.log(`   Type: ${s.merchandise_type} | HSN: ${s.hsn} | Meta Tax: ${s.tax_class} (${s.gst_rate}%) | DB Rule: ${s.tax_rule} | Inv: ${s.inv}`);
      console.log(`   Variants (${s.variants_count}): ${s.variants.map(v => `${v.id}(${v.title}, sku=${v.sku || 'none'}, rule=${v.tax_rule})`).join(", ") || "NO VARIANTS"}`);
    }

  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    await client.end();
  }
}

inspectProducts();
