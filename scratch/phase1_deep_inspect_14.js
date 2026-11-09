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

async function deepInspect14() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const unclassifiedIds = [
    "prod_01KXYMAJKNDZ4T2YVA7K144XP5",
    "prod_01KXYMAJKNH99E1TMWYGQGT61D",
    "prod_01KXYMAJKNS8AGWCN5S1WEGKSD",
    "prod_01KXYMAJKNV48P1B9CM7C022YM",
    "prod_1",
    "prod_2",
    "prod_3",
    "prod_4",
    "prod_5",
    "prod_bouquet_carnation_01",
    "prod_bouquet_rose_01",
    "prod_dist_pg_persisted_test",
    "prod_dist_test_01",
    "prod_dist_test_02",
  ];

  try {
    for (const id of unclassifiedIds) {
      const pRes = await pool.query(`SELECT * FROM public.product WHERE id = $1`, [id]);
      const p = pRes.rows[0];
      console.log(`\n======================================================`);
      console.log(`PRODUCT ID: ${p.id}`);
      console.log(`TITLE: ${p.title}`);
      console.log(`HANDLE: ${p.handle}`);
      console.log(`STATUS: ${p.status} | DELETED_AT: ${p.deleted_at}`);
      console.log(`WEIGHT: ${p.weight}`);
      console.log(`DESCRIPTION: ${p.description}`);
      console.log(`METADATA:`, JSON.stringify(p.metadata, null, 2));

      // Check variants
      const vRes = await pool.query(`SELECT * FROM public.product_variant WHERE product_id = $1 AND deleted_at IS NULL`, [id]);
      if (vRes.rows.length > 0) {
        console.log(`VARIANTS (${vRes.rows.length}):`, vRes.rows.map(v => ({ id: v.id, title: v.title, sku: v.sku, weight: v.weight })));
      } else {
        console.log(`VARIANTS: None`);
      }

      // Check if ordered in any order
      const oRes = await pool.query(`
        SELECT elem->>'title' as item_title, elem->>'hsn_code' as item_hsn, elem->>'gst_rate_pct' as item_gst, count(*)
        FROM public."order" o, jsonb_array_elements(o.metadata->'items') elem
        WHERE elem->>'product_id' = $1
        GROUP BY elem->>'title', elem->>'hsn_code', elem->>'gst_rate_pct';
      `, [id]);
      if (oRes.rows.length > 0) {
        console.log(`HISTORICAL ORDER ITEMS:`, oRes.rows);
      }
    }
  } finally {
    await pool.end();
  }
}

deepInspect14();
