process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

const FIXES = [
  {
    id: 'prod_01KXYMAJKNDZ4T2YVA7K144XP5',
    title: 'Chocolate Fudge Cupcake',
    price: 499,
    selling_price: 499,
    mrp: 599,
    category: 'Cupcakes',
    category_slug: 'cupcakes',
    primary_category_id: 'cat_cupcakes',
    weight: 'Box of 6',
    weight_prices: [
      {
        id: 'wp_cupcake_choc_6',
        weight_name: 'Box of 6',
        selling_price: 499,
        mrp: 599,
        normalized_grams: 300,
        is_enabled: true
      }
    ]
  },
  {
    id: 'prod_01KXYMAJKNV48P1B9CM7C022YM',
    title: 'Vanilla Bean Cupcake',
    price: 449,
    selling_price: 449,
    mrp: 549,
    category: 'Cupcakes',
    category_slug: 'cupcakes',
    primary_category_id: 'cat_cupcakes',
    weight: 'Box of 6',
    weight_prices: [
      {
        id: 'wp_cupcake_vanilla_6',
        weight_name: 'Box of 6',
        selling_price: 449,
        mrp: 549,
        normalized_grams: 300,
        is_enabled: true
      }
    ]
  },
  {
    id: 'prod_01KXYMAJKNS8AGWCN5S1WEGKSD',
    title: 'Butter Croissant',
    price: 149,
    selling_price: 149,
    mrp: 199,
    category: 'Pastries',
    category_slug: 'pastries',
    primary_category_id: 'cat_pastries',
    weight: null,
    weight_prices: [],
    pim_config: {
      show_weight: false,
      required_weight: false,
      show_cake_message: false,
      required_cake_message: false,
      show_photo_cake: false,
      required_photo_cake: false,
    }
  },
  {
    id: 'prod_01KXYMAJKNH99E1TMWYGQGT61D',
    title: 'Danish Pastry Assortment',
    price: 399,
    selling_price: 399,
    mrp: 499,
    category: 'Pastries',
    category_slug: 'pastries',
    primary_category_id: 'cat_pastries',
    weight: 'Box of 4',
    weight_prices: [
      {
        id: 'wp_danish_4',
        weight_name: 'Box of 4',
        selling_price: 399,
        mrp: 499,
        normalized_grams: 250,
        is_enabled: true
      }
    ]
  }
];

async function run() {
  console.log('--- Starting Non-Destructive Price Seed Correction in PostgreSQL ---');
  for (const item of FIXES) {
    // 1. Fetch existing product
    const existing = await pool.query('SELECT id, title, metadata FROM product WHERE id = $1', [item.id]);
    if (existing.rows.length === 0) {
      console.warn(`Product ${item.id} not found, skipping.`);
      continue;
    }
    const currentMeta = existing.rows[0].metadata || {};
    const updatedMeta = {
      ...currentMeta,
      price: item.price,
      selling_price: item.selling_price,
      mrp: item.mrp,
      category: currentMeta.category || item.category,
      category_slug: currentMeta.category_slug || item.category_slug,
      primary_category_id: currentMeta.primary_category_id || item.primary_category_id,
      weight: currentMeta.weight || item.weight,
      weight_prices: currentMeta.weight_prices && currentMeta.weight_prices.length > 0 ? currentMeta.weight_prices : item.weight_prices,
      price_updated_at: new Date().toISOString(),
      price_correction_source: 'canonical_inr_seed_fix'
    };

    await pool.query('UPDATE product SET metadata = $1, updated_at = NOW() WHERE id = $2', [updatedMeta, item.id]);
    console.log(`✓ Updated [${item.id}] ${item.title}: selling_price = ₹${item.selling_price}, mrp = ₹${item.mrp}`);
  }

  // 2. Verify all products have valid price now
  const check = await pool.query(`
    SELECT id, title, metadata->>'price' as price, metadata->>'selling_price' as selling_price
    FROM product
    WHERE deleted_at IS NULL
  `);
  console.log(`\nVerification: Total ${check.rows.length} products in DB:`);
  let zeroCount = 0;
  for (const p of check.rows) {
    const sp = Number(p.selling_price || p.price || 0);
    if (sp <= 0) {
      console.error(`  ❌ [${p.id}] ${p.title} still has price = ${sp}`);
      zeroCount++;
    } else {
      console.log(`  ✓ [${p.id}] ${p.title} -> ₹${sp}`);
    }
  }
  console.log(`\nResult: ${zeroCount} products with zero price remaining.`);

  await pool.end();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
