const path = require('path');
const { Pool } = require(path.join(process.cwd(), 'frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 7 COMPREHENSIVE DATA INTEGRITY SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Butter Croissant in PostgreSQL Database
    // ----------------------------------------------------
    console.log('--- TEST 1: Butter Croissant PostgreSQL Record ---');
    const croissRes = await pool.query(
      "SELECT id, title, handle, weight, metadata FROM product WHERE handle = 'butter-croissant'"
    );
    assert(croissRes.rows.length === 1, 'Butter Croissant exists in database');
    const croissant = croissRes.rows[0];
    const croissMeta = croissant.metadata || {};

    assert(croissant.weight === null, 'Butter Croissant native weight column is NULL');
    assert(croissMeta.weight === undefined, 'Butter Croissant metadata.weight is undefined (no "1 pc")');
    assert(
      Array.isArray(croissMeta.weight_prices) && croissMeta.weight_prices.length === 0,
      'Butter Croissant metadata.weight_prices is empty array (no "1 pc" entry)'
    );
    assert(
      croissMeta.pim_config && croissMeta.pim_config.show_weight === false,
      'Butter Croissant pim_config.show_weight is false'
    );
    assert(
      Number(croissMeta.selling_price || croissMeta.price) === 149,
      `Butter Croissant selling_price is ₹149 (actual: ₹${croissMeta.selling_price})`
    );

    // ----------------------------------------------------
    // TEST 2: Butter Croissant Variant in PostgreSQL
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Butter Croissant Authentic Variant ---');
    const varRes = await pool.query(
      "SELECT id, product_id, title, sku, weight FROM product_variant WHERE product_id = $1",
      [croissant.id]
    );
    assert(varRes.rows.length === 1, 'Butter Croissant has exactly 1 variant in product_variant table');
    const croissVar = varRes.rows[0];
    assert(croissVar.sku === 'BUTTER-CROISSANT', `Variant SKU is "BUTTER-CROISSANT" (actual: "${croissVar.sku}")`);
    assert(croissVar.title === 'Butter Croissant', `Variant title is "Butter Croissant" (actual: "${croissVar.title}")`);
    assert(croissVar.weight === null, 'Variant weight is NULL (not 1 pc, not 500g)');

    // ----------------------------------------------------
    // TEST 3: Chocolate Fudge Cupcake in PostgreSQL Database
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Chocolate Fudge Cupcake PostgreSQL Record ---');
    const cupcakeRes = await pool.query(
      "SELECT id, title, handle, weight, metadata FROM product WHERE handle = 'chocolate-fudge-cupcake'"
    );
    assert(cupcakeRes.rows.length === 1, 'Chocolate Fudge Cupcake exists in database');
    const cupcake = cupcakeRes.rows[0];
    const cupcakeMeta = cupcake.metadata || {};
    assert(
      Number(cupcakeMeta.selling_price) === 499,
      `Chocolate Fudge Cupcake selling_price is ₹499 (actual: ₹${cupcakeMeta.selling_price})`
    );
    assert(
      Number(cupcakeMeta.price) === 499,
      `Chocolate Fudge Cupcake price is ₹499 (actual: ₹${cupcakeMeta.price})`
    );
    assert(
      cupcakeMeta.weight === 'Box of 6',
      `Chocolate Fudge Cupcake weight is "Box of 6" (actual: "${cupcakeMeta.weight}")`
    );

    // ----------------------------------------------------
    // TEST 4: No products in entire DB have "1 pc" variant
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Global DB Scan for Phantom "1 pc" ---');
    const allProdRes = await pool.query('SELECT id, title, handle, metadata FROM product');
    let phantomCount = 0;
    for (const r of allProdRes.rows) {
      const m = r.metadata || {};
      if (m.weight === '1 pc' || m.weight === '1 piece') {
        phantomCount++;
        console.error(`  Found phantom weight on: ${r.title} (${r.handle})`);
      }
      if (Array.isArray(m.weight_prices)) {
        for (const wp of m.weight_prices) {
          if (wp.weight_name === '1 pc' || wp.weight_name === '1 piece') {
            phantomCount++;
            console.error(`  Found phantom weight_price on: ${r.title} (${r.handle})`);
          }
        }
      }
    }
    assert(phantomCount === 0, `Zero products in database contain "1 pc" or "1 piece" (found: ${phantomCount})`);

    // ----------------------------------------------------
    // TEST 5: Repository and Domain Mapping Verification
    // ----------------------------------------------------
    console.log('\n--- TEST 5: ProductRepository Data Mapping ---');
    // Test that ProductRepository maps correctly
    const { ProductRepository } = require(path.join(process.cwd(), 'frontend/src/lib/repositories/product.repository'));
    const repoCroiss = await ProductRepository.findBySlug('butter-croissant');
    assert(repoCroiss !== null, 'ProductRepository.findBySlug("butter-croissant") returned product');
    assert(
      Array.isArray(repoCroiss.weight_prices) && repoCroiss.weight_prices.length === 0,
      'ProductRepository returned 0 weight_prices for Butter Croissant'
    );
    assert(
      Array.isArray(repoCroiss.variants) && repoCroiss.variants.length === 1,
      'ProductRepository attached authentic variants from product_variant table'
    );
    assert(
      repoCroiss.variants[0].sku === 'BUTTER-CROISSANT',
      `ProductRepository variant SKU is "BUTTER-CROISSANT" (actual: "${repoCroiss.variants[0].sku}")`
    );

    // ----------------------------------------------------
    // TEST 6: ApiEngine Cart Operations Verification
    // ----------------------------------------------------
    console.log('\n--- TEST 6: ApiEngine Add to Cart & Price Integrity ---');
    const { ApiEngine } = require(path.join(process.cwd(), 'frontend/src/lib/api-engine'));

    const testCartId = `test_cart_${Date.now()}`;
    const testCroissItem = {
      productId: croissant.id,
      variantId: croissVar.id,
      quantity: 1,
      title: 'Butter Croissant',
    };

    const cartResult = ApiEngine.addToCart(testCartId, testCroissItem);
    assert(cartResult && cartResult.items.length === 1, 'Cart contains exactly 1 item after add');
    const lineItem = cartResult.items[0];
    assert(lineItem.unit_price === 149, `Line item unit price is ₹149 (actual: ₹${lineItem.unit_price})`);
    assert(lineItem.total_price === 149, `Line item total price is ₹149 (actual: ₹${lineItem.total_price})`);
    assert(lineItem.quantity === 1, `Line item quantity is 1 (actual: ${lineItem.quantity})`);
    assert(lineItem.weight === null, `Line item weight is NULL for pastry (no "1 pc", no "1 kg", actual: ${lineItem.weight})`);
    assert(cartResult.subtotal === 149, `Cart subtotal is ₹149 (actual: ₹${cartResult.subtotal})`);

    // Quantity update test
    console.log('\n--- TEST 7: Quantity Stepper (Quantity != Variant) ---');
    const updatedCart = ApiEngine.updateCartItem(testCartId, lineItem.id, 2);
    const updatedItem = updatedCart.items.find((i) => i.id === lineItem.id);
    assert(updatedItem.quantity === 2, `Updated item quantity is 2 (actual: ${updatedItem.quantity})`);
    assert(updatedItem.total_price === 298, `Updated item total price is ₹298 (actual: ₹${updatedItem.total_price})`);
    assert(updatedCart.subtotal === 298, `Updated cart subtotal is ₹298 (actual: ₹${updatedCart.subtotal})`);
    assert(updatedItem.weight === null, `Weight remains NULL when quantity changes (Quantity is NOT a variant)`);

    // Chocolate Fudge Cupcake Add to Cart test
    console.log('\n--- TEST 8: Chocolate Fudge Cupcake Positive Price Verification ---');
    const cupcakeVar = (
      await pool.query("SELECT id FROM product_variant WHERE product_id = $1", [cupcake.id])
    ).rows[0];
    const testCupcakeItem = {
      productId: cupcake.id,
      variantId: cupcakeVar ? cupcakeVar.id : `var_${cupcake.id}`,
      quantity: 1,
      title: 'Chocolate Fudge Cupcake',
    };
    const cartWithCupcake = ApiEngine.addToCart(testCartId, testCupcakeItem);
    const cupcakeLineItem = cartWithCupcake.items.find((i) => i.title.includes('Cupcake'));
    assert(cupcakeLineItem !== undefined, 'Chocolate Fudge Cupcake added to cart successfully');
    assert(
      cupcakeLineItem.unit_price === 499,
      `Chocolate Fudge Cupcake unit price is ₹499 (no zero-price error, actual: ₹${cupcakeLineItem.unit_price})`
    );

    // ----------------------------------------------------
    // TEST 9: Remove Item from Cart
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Remove Item Operation ---');
    const cartAfterRemove = ApiEngine.removeCartItem(testCartId, lineItem.id);
    assert(
      !cartAfterRemove.items.some((i) => i.id === lineItem.id),
      'Butter Croissant removed cleanly from cart'
    );
    assert(cartAfterRemove.items.length === 1, 'Remaining item count is 1 (Cupcake)');
    assert(cartAfterRemove.subtotal === 499, `Remaining subtotal is ₹499 (actual: ₹${cartAfterRemove.subtotal})`);

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
