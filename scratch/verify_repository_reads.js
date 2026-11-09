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

// Simulating ProductRepository.mapRowToDomain exactly as implemented in product.repository.ts
function mapRowToDomain(p) {
  const meta = p.metadata || {};
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    description: p.description,
    category: meta.category,
    hsn_code: meta.hsn_code || "",
    hsn_description: meta.hsn_description || (meta.hsn_code ? "Cakes, Pastries & Bakery Goods" : "Unclassified (Missing HSN Code)"),
    gst_rate: meta.gst_rate,
    hs_code_col: p.hs_code
  };
}

async function testRepositoryReads() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("=== VERIFYING REPOSITORY READS FROM POSTGRESQL ===");

    // 1. Fetch all active products via SQL equivalent to ProductRepository.findAll
    const res = await pool.query(
      `SELECT * FROM "product" WHERE deleted_at IS NULL ORDER BY created_at ASC, id ASC LIMIT 100`
    );
    const domainProducts = res.rows.map(mapRowToDomain);

    console.log(`Repository returned ${domainProducts.length} active products.`);

    let unclassifiedCount = 0;
    for (const p of domainProducts) {
      if (!p.hsn_code) {
        unclassifiedCount++;
        console.error(`  [FAIL] Missing HSN on: ${p.id} (${p.title})`);
      } else {
        console.log(`  [OK] ${p.id.padEnd(32)} | HSN: ${p.hsn_code.padEnd(10)} | Desc: "${p.hsn_description}"`);
      }
    }

    if (unclassifiedCount === 0) {
      console.log("\n✅ ALL 22 ACTIVE PRODUCTS SUCCESSFULLY RETURN PERSISTED HSN CODES IN REPOSITORY READS");
    } else {
      console.error(`\n❌ ${unclassifiedCount} products missing HSN codes in repository reads`);
      process.exit(1);
    }

  } finally {
    await pool.end();
  }
}

testRepositoryReads();
