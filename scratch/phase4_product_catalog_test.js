const fs = require("fs");
const path = require("path");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));

async function runPhase4Audit() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to PostgreSQL for Phase 4 Catalog & Product Audit.");

  const results = {
    catalog_counts: {},
    zero_price_products: [],
    invalid_categories: [],
    unpublished_products: [],
    sample_products: [],
    hardcoded_scans: [],
    summary: {}
  };

  // 1. Query products
  console.log("Querying product database...");
  const prodRes = await client.query(`
    SELECT
      id,
      title,
      handle,
      status,
      thumbnail,
      created_at,
      metadata
    FROM product
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC;
  `);

  results.catalog_counts.total_active_products = prodRes.rows.length;

  for (const p of prodRes.rows) {
    const meta = p.metadata || {};
    const rawPrice = meta.selling_price ?? meta.price ?? (meta.weight_prices && meta.weight_prices[0]?.selling_price);
    const price = Number(rawPrice || 0);

    if (price <= 0) {
      results.zero_price_products.push({
        id: p.id,
        title: p.title,
        price,
        raw: rawPrice
      });
    }

    if (p.status !== "published") {
      results.unpublished_products.push({
        id: p.id,
        title: p.title,
        status: p.status
      });
    }
  }

  // 2. Query categories
  console.log("Querying product_category database...");
  const catRes = await client.query(`
    SELECT id, name, handle, metadata
    FROM product_category
    ORDER BY name ASC;
  `);
  results.catalog_counts.total_categories = catRes.rows.length;
  results.categories = catRes.rows.map(c => ({ id: c.id, name: c.name, handle: c.handle }));

  // 3. Query variants
  console.log("Querying product_variant database...");
  const varRes = await client.query(`
    SELECT id, product_id, title, sku, metadata
    FROM product_variant
    WHERE deleted_at IS NULL;
  `);
  results.catalog_counts.total_variants = varRes.rows.length;

  // 4. Sample product data verification
  results.sample_products = prodRes.rows.slice(0, 5).map(p => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    selling_price: p.metadata?.selling_price || p.metadata?.price,
    category: p.metadata?.category,
    occasion: p.metadata?.occasion,
    inventory_mode: p.metadata?.pim_config?.inventory_mode || (p.metadata?.category === "Accessories" ? "PHYSICAL_INVENTORY" : "KITCHEN_PREPARED")
  }));

  // 5. Codebase scan for hardcoded catalog entities
  console.log("Scanning codebase for hardcoded product/price patterns...");
  const srcDir = path.join(__dirname, "../frontend/src");
  function scanDir(dir) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== ".next") {
          files.push(...scanDir(path.join(dir, e.name)));
        }
      } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
        files.push(path.join(dir, e.name));
      }
    }
    return files;
  }

  const allTsFiles = scanDir(srcDir);
  const hardcodedPatterns = [
    { name: "hardcoded_prices", regex: /price:\s*(?:599|699|799|899|999|1299|1499)\b/g },
    { name: "mock_products_array", regex: /(?:mockProducts|dummyProducts|sampleProducts)\s*=\s*\[/g },
    { name: "hardcoded_branches", regex: /(?:mockBranches|dummyBranches)\s*=\s*\[/g },
    { name: "hardcoded_delivery_promises", regex: /"delivered in (?:15|30|45) mins"/i }
  ];

  for (const f of allTsFiles) {
    const content = fs.readFileSync(f, "utf8");
    const rel = path.relative(path.join(__dirname, ".."), f).replace(/\\/g, "/");

    for (const p of hardcodedPatterns) {
      if (p.regex.test(content)) {
        results.hardcoded_scans.push({
          pattern: p.name,
          file: rel,
          classification: rel.includes("test") || rel.includes("scratch") ? "TEST_ONLY" : "REVIEW_NEEDED"
        });
      }
    }
  }

  await client.end();

  results.summary = {
    total_products_in_db: prodRes.rows.length,
    zero_price_products_found: results.zero_price_products.length,
    unpublished_products_found: results.unpublished_products.length,
    total_categories_in_db: catRes.rows.length,
    total_variants_in_db: varRes.rows.length,
    hardcoded_scans_matched: results.hardcoded_scans.length
  };

  console.log("\n=================================================");
  console.log("PHASE 4 PRODUCT & CATALOG AUDIT SUMMARY");
  console.log("=================================================");
  console.log(JSON.stringify(results.summary, null, 2));

  fs.writeFileSync(
    path.join(__dirname, "phase4_catalog_audit_results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log("Saved results to scratch/phase4_catalog_audit_results.json");
}

runPhase4Audit().catch(err => {
  console.error("Phase 4 failed:", err);
  process.exit(1);
});
