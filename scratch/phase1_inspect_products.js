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

async function inspectProductMaster() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("=== PHASE 1: PRODUCT MASTER SCHEMA & DATA INSPECTION ===");

    // 1. Check columns in product and product_variant
    const prodCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product'
      ORDER BY ordinal_position;
    `);
    console.log("\n[Product Columns]:", prodCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

    const varCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product_variant'
      ORDER BY ordinal_position;
    `);
    console.log("\n[Product Variant Columns]:", varCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

    // 2. Total products summary
    const countRes = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_count,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_count,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND metadata->>'hsn_code' IS NOT NULL AND TRIM(metadata->>'hsn_code') != '') as classified_count,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND (metadata->>'hsn_code' IS NULL OR TRIM(metadata->>'hsn_code') = '')) as unclassified_count
      FROM public.product;
    `);
    console.log("\n[Product Summary Counts]:", countRes.rows[0]);

    // 3. Query all products with details
    const prods = await pool.query(`
      SELECT 
        p.id,
        p.title,
        p.handle,
        p.status,
        p.deleted_at,
        p.description,
        p.metadata->>'category' as category,
        p.metadata->>'category_slug' as category_slug,
        p.metadata->>'hsn_code' as hsn_code,
        p.metadata->>'hsn_description' as hsn_description,
        p.metadata->>'gst_rate' as gst_rate,
        p.metadata->>'tax_class' as tax_class,
        p.metadata->>'tax_configuration_id' as tax_configuration_id,
        p.metadata->>'uqc' as uqc,
        p.metadata->>'flavour' as flavour,
        p.metadata->>'cake_base' as cake_base,
        p.metadata->>'filling' as filling,
        p.metadata->>'cream' as cream,
        p.metadata->>'cake_type' as cake_type,
        p.metadata->>'brand' as brand,
        p.metadata->>'tags' as tags,
        p.metadata->'weight_prices' as weight_prices,
        p.metadata->'pim_config' as pim_config,
        p.metadata->>'selling_price' as selling_price,
        p.metadata->>'price' as price
      FROM public.product p
      ORDER BY 
        CASE WHEN (p.metadata->>'hsn_code' IS NOT NULL AND TRIM(p.metadata->>'hsn_code') != '') THEN 0 ELSE 1 END,
        p.id ASC;
    `);

    console.log(`\nFound ${prods.rows.length} total products in database:`);
    
    // Group into classified and unclassified
    const classified = prods.rows.filter(r => r.hsn_code && r.hsn_code.trim() !== "");
    const unclassified = prods.rows.filter(r => !r.hsn_code || r.hsn_code.trim() === "");

    console.log(`\n--- CLASSIFIED PRODUCTS (${classified.length}) ---`);
    for (const p of classified) {
      console.log(`ID: ${p.id} | Name: "${p.title}" | Status: ${p.status} | Deleted: ${p.deleted_at !== null} | Cat: ${p.category} | HSN: ${p.hsn_code} | HSN Desc: "${p.hsn_description}" | GST: ${p.gst_rate}% | Price: ₹${p.selling_price || p.price}`);
    }

    console.log(`\n--- UNCLASSIFIED PRODUCTS (${unclassified.length}) ---`);
    for (const p of unclassified) {
      console.log(`\nID: ${p.id}`);
      console.log(`  Name: "${p.title}"`);
      console.log(`  Handle: ${p.handle}`);
      console.log(`  Status: ${p.status} (deleted: ${p.deleted_at !== null})`);
      console.log(`  Category: ${p.category} (slug: ${p.category_slug})`);
      console.log(`  GST Rate: ${p.gst_rate}% | Tax Class: ${p.tax_class} | UQC: ${p.uqc}`);
      console.log(`  Description: ${p.description}`);
      console.log(`  Details: flavour="${p.flavour}", cake_base="${p.cake_base}", filling="${p.filling}", cream="${p.cream}", cake_type="${p.cake_type}", brand="${p.brand}"`);
      console.log(`  Tags: ${p.tags}`);
      console.log(`  PIM Config: ${JSON.stringify(p.pim_config)}`);
      console.log(`  Weight Prices: ${JSON.stringify(p.weight_prices)}`);
    }

    // 4. Check product variants
    const vars = await pool.query(`
      SELECT 
        pv.id,
        pv.product_id,
        pv.title,
        pv.sku,
        pv.weight,
        pv.metadata
      FROM public.product_variant pv
      WHERE pv.deleted_at IS NULL;
    `);
    console.log(`\n[Product Variants]: Found ${vars.rows.length} active variants across products.`);

    // 5. Check if any line items in orders or invoices reference unclassified products
    const orderItems = await pool.query(`
      SELECT 
        elem->>'product_id' as product_id,
        elem->>'title' as title,
        elem->>'hsn_code' as hsn_code,
        COUNT(*) as count
      FROM public."order" o,
      jsonb_array_elements(o.metadata->'items') as elem
      GROUP BY elem->>'product_id', elem->>'title', elem->>'hsn_code'
      ORDER BY count DESC;
    `);
    console.log("\n[Order Items in DB]:", orderItems.rows);

  } catch (err) {
    console.error("Error during inspection:", err);
  } finally {
    await pool.end();
  }
}

inspectProductMaster();
