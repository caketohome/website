/**
 * CakeToHome — Storefront Product Listing, Search & Filters Full Automated Test Suite
 * Tests all 20 required acceptance criteria against live PostgreSQL database.
 */

import { dbQuery, closeDbPool } from '../src/lib/db';
import { ProductRepository } from '../src/lib/repositories/product.repository';
import { searchProducts, getCatalogFilterOptions } from '../src/lib/data/catalog';
import { ApiEngine } from '../src/lib/api-engine';
import { SearchEngine } from '../src/lib/search/search-engine';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("CAKETOHOME CATALOG FUNCTIONAL TEST SUITE — 20 ACCEPTANCE CRITERIA");
  console.log("================================================================================\n");

  const testProdId = `prod_test_auto_${Date.now()}`;
  const testProdHandle = `test-mango-delight-${Date.now()}`;

  try {
    // Initial cleanup of any previous test products
    await dbQuery(`DELETE FROM "product" WHERE id LIKE 'prod_test_auto_%'`);
    await ApiEngine.reloadStore();

    // 1. GET product listing
    console.log("--- 1. GET Product Listing ---");
    const listing = await searchProducts({});
    assert(listing.results.length > 0, `Product listing returns products (got ${listing.results.length})`);
    assert(listing.count > 0, `Total count is positive (got ${listing.count})`);

    // 2. GET product listing from PostgreSQL directly
    console.log("\n--- 2. GET Product Listing from PostgreSQL ---");
    const dbRows = await dbQuery(`SELECT id, title, handle, status FROM "product" WHERE deleted_at IS NULL`);
    assert(dbRows.rows.length === listing.count, `Storefront count matches PostgreSQL active row count (${dbRows.rows.length} vs ${listing.count})`);

    // 3. Search Chocolate
    console.log("\n--- 3. Search 'Chocolate' ---");
    const chocResults = await searchProducts({ q: "Chocolate" });
    assert(chocResults.results.length > 0, `Search 'Chocolate' returns matches (got ${chocResults.results.length})`);
    chocResults.results.forEach((p) => {
      const match =
        p.title.toLowerCase().includes("chocolate") ||
        (p.flavour && p.flavour.toLowerCase().includes("chocolate")) ||
        (p.description && p.description.toLowerCase().includes("chocolate")) ||
        (p.category && p.category.toLowerCase().includes("chocolate"));
      assert(Boolean(match), `Product "${p.title}" matches chocolate query`);
    });

    // 4. Search Case Insensitive ("chocolate" vs "CHOCOLATE")
    console.log("\n--- 4. Search Case Insensitivity ---");
    const lowerRes = await searchProducts({ q: "chocolate" });
    const upperRes = await searchProducts({ q: "CHOCOLATE" });
    assert(lowerRes.results.length === upperRes.results.length, `Lower and upper case searches return identical counts (${lowerRes.results.length} vs ${upperRes.results.length})`);

    // 5. Search No-Match State
    console.log("\n--- 5. Search No-Match State ---");
    const noMatch = await searchProducts({ q: "XyZNonExistentCakeQuery12345" });
    assert(noMatch.results.length === 0, `No-match query returns empty results (got ${noMatch.results.length})`);
    assert(noMatch.count === 0, `No-match count is 0 (got ${noMatch.count})`);

    // 6. Category Filter
    console.log("\n--- 6. Category Filter ---");
    const catRes = await searchProducts({ category: "chocolate-cakes" });
    assert(catRes.results.length > 0, `Category filter 'chocolate-cakes' returns products (got ${catRes.results.length})`);

    // 7. Flavour Filter
    console.log("\n--- 7. Flavour Filter ---");
    const flavRes = await searchProducts({ flavour: "Chocolate" });
    assert(flavRes.results.length > 0, `Flavour filter 'Chocolate' returns products (got ${flavRes.results.length})`);

    // 8. Weight Filter
    console.log("\n--- 8. Weight Filter ---");
    const weightRes = await searchProducts({ weight: "1 kg" });
    assert(weightRes.results.length > 0, `Weight filter '1 kg' returns products (got ${weightRes.results.length})`);

    // 9. Price Filter
    console.log("\n--- 9. Price Filter (₹500 - ₹999) ---");
    const priceRes = await searchProducts({ min_price: 500, max_price: 999 });
    assert(priceRes.results.length > 0, `Price range filter returns products (got ${priceRes.results.length})`);
    priceRes.results.forEach((p) => {
      assert(p.price >= 500 && p.price <= 999, `Product "${p.title}" price ₹${p.price} within range [500, 999]`);
    });

    // 10. Multiple Filters Composed (Flavour + Weight + Price)
    console.log("\n--- 10. Multiple Composed Filters ---");
    const multiRes = await searchProducts({ flavour: "Chocolate", weight: "1 kg", min_price: 500, max_price: 999 });
    assert(multiRes.results.length > 0, `Composed filters return matching products (got ${multiRes.results.length})`);

    // 11. Clear All (Restores Full Catalog)
    console.log("\n--- 11. Clear All Filters ---");
    const cleared = await searchProducts({});
    assert(cleared.results.length === listing.results.length, `Cleared filters restore full catalog (${cleared.results.length} vs ${listing.results.length})`);

    // 12. Sorting (Price Ascending vs Descending)
    console.log("\n--- 12. Sorting ---");
    const ascRes = await searchProducts({ sort: "price_asc" });
    const descRes = await searchProducts({ sort: "price_desc" });
    assert(ascRes.results.length > 0 && descRes.results.length > 0, "Sorted queries returned products");
    assert(ascRes.results[0].price <= ascRes.results[ascRes.results.length - 1].price, `Price ascending verified (first: ₹${ascRes.results[0].price}, last: ₹${ascRes.results[ascRes.results.length - 1].price})`);
    assert(descRes.results[0].price >= descRes.results[descRes.results.length - 1].price, `Price descending verified (first: ₹${descRes.results[0].price}, last: ₹${descRes.results[descRes.results.length - 1].price})`);

    // 13. Pagination (limit + offset)
    console.log("\n--- 13. Pagination ---");
    const page1 = await searchProducts({ limit: 4, offset: 0 });
    const page2 = await searchProducts({ limit: 4, offset: 4 });
    assert(page1.results.length === 4, `Page 1 returned 4 items`);
    assert(page2.results.length > 0, `Page 2 returned items`);
    assert(page1.results[0].product_id !== page2.results[0].product_id, `Page 1 and Page 2 contain distinct products`);

    // 14. Product Detail Fetch
    console.log("\n--- 14. Product Detail Fetch ---");
    const firstProd = listing.results[0];
    const detail = await ProductRepository.findById(firstProd.product_id);
    assert(detail !== null, `Product detail retrieved for ${firstProd.product_id}`);
    assert(detail?.title === firstProd.title, `Product detail title matches ("${detail?.title}")`);

    // 15. Product Creation -> Storefront Listing
    console.log("\n--- 15. Product Creation -> Storefront Listing ---");
    await ProductRepository.save({
      id: testProdId,
      product_id: testProdId,
      title: "Alphonso Mango Saffron Cake",
      name: "Alphonso Mango Saffron Cake",
      handle: testProdHandle,
      slug: testProdHandle,
      description: "Fresh Ratnagiri mango pulp layered with pure Kashmiri saffron cream.",
      status: "published",
      price: 849,
      flavour: "Mango",
      category: "Fruit Cakes",
      category_slug: "fruit-cakes",
      weight: "1 kg",
      is_featured: true,
      thumbnail: "http://localhost:3000/_test_mango.jpeg",
    });

    // Reload store in ApiEngine
    await ApiEngine.reloadStore();
    const createdSearch = await searchProducts({ q: "Alphonso Mango" });
    assert(createdSearch.results.some((p) => p.product_id === testProdId), `Newly created product found in searchProducts`);

    // 16. Product Update -> Storefront Listing
    console.log("\n--- 16. Product Update -> Storefront Listing ---");
    await ProductRepository.save({
      id: testProdId,
      product_id: testProdId,
      title: "Alphonso Mango Royal Pistachio Cake",
      name: "Alphonso Mango Royal Pistachio Cake",
      handle: testProdHandle,
      status: "published",
      price: 899,
      flavour: "Mango",
      category: "Fruit Cakes",
      weight: "1 kg",
      thumbnail: "http://localhost:3000/_test_mango.jpeg",
    });
    await ApiEngine.reloadStore();
    const updatedSearch = await searchProducts({ q: "Royal Pistachio" });
    assert(updatedSearch.results.some((p) => p.product_id === testProdId), `Updated product found with new title keywords`);

    // 17. Product Archive -> Removed from Active Listing
    console.log("\n--- 17. Product Archive -> Removed from Active Listing ---");
    await ProductRepository.delete(testProdId);
    await ApiEngine.reloadStore();
    const archivedSearch = await searchProducts({ q: "Alphonso Mango" });
    assert(!archivedSearch.results.some((p) => p.product_id === testProdId), `Archived product no longer appears in storefront search`);

    // Clean up test record completely
    await dbQuery(`DELETE FROM "product" WHERE id = $1`, [testProdId]);

    // 18. Filter Options Check
    console.log("\n--- 18. Catalog Filter Options ---");
    const opts = await getCatalogFilterOptions();
    assert(opts.categories.length > 0, `Filter options has categories (got ${opts.categories.length})`);
    assert(opts.flavours.length > 0, `Filter options has flavours (got ${opts.flavours.length})`);
    assert(opts.weights.length > 0, `Filter options has weights (got ${opts.weights.length})`);

    // 19. HTTP API Endpoint Verification
    console.log("\n--- 19. HTTP API Endpoint Verification ---");
    const apiRes = await fetch("http://localhost:3000/api/v1/products?search=Chocolate");
    assert(apiRes.status === 200, `GET /api/v1/products?search=Chocolate returns HTTP 200`);
    const apiJson = await apiRes.json();
    assert(apiJson.success === true, `API returns success: true`);
    assert(apiJson.results.length > 0, `API returns matching products (got ${apiJson.results.length})`);

    // 20. Static JSON Verification
    console.log("\n--- 20. Static Database Verification ---");
    const totalPgProds = await dbQuery(`SELECT count(*) AS cnt FROM "product" WHERE deleted_at IS NULL`);
    assert(Number(totalPgProds.rows[0].cnt) === listing.count, `PostgreSQL is the single source of truth (${totalPgProds.rows[0].cnt} products)`);

    console.log("\n================================================================================");
    console.log("🎉 ALL 20 AUTOMATED FUNCTIONAL TESTS PASSED WITH 100% SUCCESS!");
    console.log("================================================================================");
  } finally {
    await closeDbPool();
  }
}

runAllTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  });
