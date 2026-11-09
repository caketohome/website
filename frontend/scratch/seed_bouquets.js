const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const envPath = path.join(__dirname, "../.env");
const lines = fs.readFileSync(envPath, "utf8").split("\n");
let connStr = "";
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    let val = trimmed.substring("DATABASE_URL=".length).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    connStr = val;
    break;
  }
}

const pool = new Pool({ connectionString: connStr });

async function seedBouquets() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Ensure category exists
    await client.query(`
      INSERT INTO product_category (id, name, handle, mpath, description, is_active, is_internal, rank, created_at, updated_at)
      VALUES ('cat_bouquets', 'Bouquets & Fresh Flowers', 'bouquets', 'cat_bouquets.', 'Fresh floral bouquets, roses, and flower arrangements', true, false, 5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, handle = EXCLUDED.handle, mpath = EXCLUDED.mpath, updated_at = NOW();
    `);

    // 2. Insert Bouquet Product 1
    const bouquet1Id = "prod_bouquet_rose_01";
    const bouquet1VarId = "var_bouquet_rose_01";
    await client.query(`
      INSERT INTO product (id, title, handle, description, status, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'published', $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, metadata = EXCLUDED.metadata, updated_at = NOW();
    `, [
      bouquet1Id,
      "Royal Red Velvet Roses Bouquet",
      "royal-red-velvet-roses-bouquet",
      "Premium bunch of 12 fresh red velvet Dutch roses wrapped in matte black luxury wrapping with satin ribbon.",
      JSON.stringify({
        price: 599,
        selling_price: 599,
        mrp: 799,
        category: "Bouquets & Fresh Flowers",
        category_slug: "bouquets",
        primary_category_id: "cat_bouquets",
        merchandise_type: "BOUQUET",
        thumbnail: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=500&auto=format&fit=crop",
        gst_rate: 5,
        rating: 4.9,
        review_count: 38,
        tags: "flowers, bouquet, roses, birthday, anniversary, romance",
      }),
    ]);

    await client.query(`
      INSERT INTO product_variant (id, product_id, title, sku, barcode, metadata, created_at, updated_at)
      VALUES ($1, $2, 'Standard 12 Stems', 'BOUQ-ROSE-12', '8901234000101', '{"stems": 12}'::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [bouquet1VarId, bouquet1Id]);

    // Insert Bouquet Product 2
    const bouquet2Id = "prod_bouquet_carnation_01";
    const bouquet2VarId = "var_bouquet_carnation_01";
    await client.query(`
      INSERT INTO product (id, title, handle, description, status, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'published', $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, metadata = EXCLUDED.metadata, updated_at = NOW();
    `, [
      bouquet2Id,
      "Pastel Dutch Carnations & Lilies Bouquet",
      "pastel-dutch-carnations-lilies-bouquet",
      "Delicate hand-tied bouquet featuring pink Dutch carnations, white Asiatic lilies, and baby's breath foliage.",
      JSON.stringify({
        price: 699,
        selling_price: 699,
        mrp: 899,
        category: "Bouquets & Fresh Flowers",
        category_slug: "bouquets",
        primary_category_id: "cat_bouquets",
        merchandise_type: "BOUQUET",
        thumbnail: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=500&auto=format&fit=crop",
        gst_rate: 5,
        rating: 4.8,
        review_count: 24,
        tags: "flowers, bouquet, carnations, lilies, celebration",
      }),
    ]);

    await client.query(`
      INSERT INTO product_variant (id, product_id, title, sku, barcode, metadata, created_at, updated_at)
      VALUES ($1, $2, 'Standard Bunch', 'BOUQ-CARN-01', '8901234000102', '{"stems": 10}'::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [bouquet2VarId, bouquet2Id]);

    // 3. Ensure both bouquets exist in shared_inventory pool with merchandise_type = 'BOUQUET'
    await client.query(`
      INSERT INTO shared_inventory (
        id, product_id, variant_id, merchandise_type, title, quantity, reserved, safety_threshold, created_at, updated_at
      ) VALUES (
        'si_bouquet_rose_01', $1, $2, 'BOUQUET', 'Royal Red Velvet Roses Bouquet', 50, 0, 5, NOW(), NOW()
      ) ON CONFLICT (product_id, variant_id) DO UPDATE SET
        merchandise_type = 'BOUQUET', title = EXCLUDED.title, updated_at = NOW();
    `, [bouquet1Id, bouquet1VarId]);

    await client.query(`
      INSERT INTO shared_inventory (
        id, product_id, variant_id, merchandise_type, title, quantity, reserved, safety_threshold, created_at, updated_at
      ) VALUES (
        'si_bouquet_carnation_01', $1, $2, 'BOUQUET', 'Pastel Dutch Carnations & Lilies Bouquet', 50, 0, 5, NOW(), NOW()
      ) ON CONFLICT (product_id, variant_id) DO UPDATE SET
        merchandise_type = 'BOUQUET', title = EXCLUDED.title, updated_at = NOW();
    `, [bouquet2Id, bouquet2VarId]);

    await client.query("COMMIT");
    console.log("Bouquet products & shared inventory seeded successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seeding error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedBouquets();
