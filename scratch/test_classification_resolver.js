const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function resolveProductInventoryMode(product) {
  const meta = product.metadata || {};
  const pim = meta.pim_config || product.pim_config || {};

  // 1. Explicit PIM authority takes highest precedence
  if (pim.inventory_mode === "STOCK_CONTROLLED" || pim.inventory_mode === "MADE_TO_ORDER_AVAILABILITY") {
    return { mode: pim.inventory_mode, reason: "explicit_pim_config" };
  }

  // 2. Explicit category / accessory markers
  const cat = String(meta.category || product.category || "").toLowerCase();
  const slug = String(meta.category_slug || product.category_slug || "").toLowerCase();
  const id = String(product.id || "");

  if (
    id.startsWith("acc_") ||
    slug === "accessories" ||
    slug === "cake-accessories" ||
    slug === "greeting-cards" ||
    cat === "accessories" ||
    cat === "cake accessories" ||
    cat === "greeting cards"
  ) {
    return { mode: "STOCK_CONTROLLED", reason: "accessory_category_or_id" };
  }

  // 3. Made-to-order bakery indicators (baking attributes, weights, prep time, bakery categories)
  const isBakeryCategory = [
    "cakes", "pastries", "cupcakes", "specialty-cakes", "artisanal-cakes",
    "chocolate-cakes", "signature-cakes", "black-forest-cakes", "red-velvet-cakes",
    "fruit-mousse-cakes", "butterscotch-caramel-cakes", "desserts"
  ].some(b => slug.includes(b) || cat.toLowerCase().includes(b));

  const hasBakeryAttributes = 
    meta.prep_time_minutes != null ||
    meta.flavour != null ||
    meta.cake_base != null ||
    meta.filling != null ||
    (Array.isArray(meta.weight_prices) && meta.weight_prices.length > 0) ||
    meta.weight != null;

  if (isBakeryCategory || hasBakeryAttributes) {
    return { mode: "MADE_TO_ORDER_AVAILABILITY", reason: "bakery_attributes_or_category" };
  }

  return { mode: "UNKNOWN", reason: "unclassified_product" };
}

async function main() {
  const allProds = await pool.query(`
    SELECT id, title, handle, metadata 
    FROM product 
    ORDER BY created_at DESC;
  `);

  console.log(`Auditing ${allProds.rows.length} products in DB:`);
  let stockCount = 0;
  let madeToOrderCount = 0;
  let unknownCount = 0;
  const unknownList = [];

  for (const p of allProds.rows) {
    const res = resolveProductInventoryMode(p);
    if (res.mode === "STOCK_CONTROLLED") stockCount++;
    else if (res.mode === "MADE_TO_ORDER_AVAILABILITY") madeToOrderCount++;
    else {
      unknownCount++;
      unknownList.push({ id: p.id, title: p.title, metadata: p.metadata });
    }
  }

  console.log({
    total: allProds.rows.length,
    stockCount,
    madeToOrderCount,
    unknownCount
  });

  if (unknownCount > 0) {
    console.log('Unknown products:', unknownList);
  } else {
    console.log('ALL PRODUCTS DETERMINISTICALLY CLASSIFIED (100% RESOLUTION).');
  }

  await pool.end();
}

main().catch(console.error);
