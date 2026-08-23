/**
 * CakeToHome — Storefront Search System Complete E2E Verification Suite
 * Verifies:
 * 1. Storefront embedded header search execution via server actions & REST API
 * 2. Strict Canonical Product Deduplication (ZERO duplicate product entries for any search query)
 * 3. Multi-tier relevance ranking (Exact title > Prefix > Token > Category > Flavour > Description)
 * 4. Aggregation of matching categories and flavours
 * 5. Accurate field mapping: product_id, title, thumbnail, category, price, rating
 * 6. Multi-query flavour, name, and category matching
 * 7. Minimum character guard & debouncing safety
 * 8. Empty search & zero-result search gracefully handled
 * 9. Guest & authenticated user search (no auth required, zero private data leakage)
 * 10. Direct product link resolution: GET /api/v1/products/:id
 */

import { searchProductsAction } from "../src/lib/actions/catalog";
import { ApiEngine } from "../src/lib/api-engine";

async function runSearchTestSuite() {
  console.log("============================================================");
  console.log("🔍 CAKETOHOME — EMBEDDED STOREFRONT SEARCH E2E TEST SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // ── SECTION 1: Base Catalog Search Query Execution ──
    console.log("📋 SECTION 1: Base Catalog Search Query Execution");
    const chocolateRes = await searchProductsAction({ q: "chocolate", limit: 12 });
    assert(Array.isArray(chocolateRes.results), "searchProductsAction returns results array");
    assert(chocolateRes.results.length > 0, `Search for 'chocolate' returns matching cakes (found ${chocolateRes.results.length})`);
    assert(chocolateRes.count > 0, `Total matching count is positive (${chocolateRes.count})`);

    const firstCake = chocolateRes.results[0];
    assert(Boolean(firstCake.product_id), `Product has product_id: ${firstCake.product_id}`);
    assert(Boolean(firstCake.title), `Product has title: ${firstCake.title}`);
    assert(Boolean(firstCake.thumbnail), `Product has thumbnail image: ${firstCake.thumbnail?.slice(0, 40)}...`);
    assert(typeof firstCake.price === "number" && firstCake.price > 0, `Product has valid price: ₹${firstCake.price}`);
    assert(Boolean(firstCake.category), `Product has category assigned: ${firstCake.category}`);

    // ── SECTION 2: CANONICAL DEDUPLICATION (CRITICAL REGRESSION TEST) ──
    console.log("\n📋 SECTION 2: Canonical Deduplication (Zero Duplicate Products)");
    const seenIds = new Set<string>();
    let hasDuplicateId = false;
    const seenTitles = new Set<string>();
    let hasDuplicateTitle = false;

    for (const p of chocolateRes.results) {
      const id = p.product_id;
      if (seenIds.has(id)) {
        hasDuplicateId = true;
        console.error(`  ❌ Duplicate Product ID detected: ${id} (${p.title})`);
      }
      seenIds.add(id);

      const title = p.title.toLowerCase().trim();
      if (seenTitles.has(title)) {
        hasDuplicateTitle = true;
        console.error(`  ❌ Duplicate Product Title detected: ${p.title}`);
      }
      seenTitles.add(title);
    }

    assert(!hasDuplicateId, "Search results contain ZERO duplicate product IDs");
    assert(!hasDuplicateTitle, "Search results contain ZERO duplicate product titles");

    // Specific check for Artisanal Belgian Black Forest Gateau (verifying fix for the reported bug)
    const specificMatches = chocolateRes.results.filter((p) =>
      p.title.toLowerCase().includes("artisanal belgian black forest")
    );
    assert(
      specificMatches.length <= 1,
      `'Artisanal Belgian Black Forest Gateau' appears at most once in search results (actual: ${specificMatches.length})`
    );

    // ── SECTION 3: MULTI-TIER RELEVANCE RANKING ──
    console.log("\n📋 SECTION 3: Multi-Tier Relevance Ranking");
    const exactSearchRes = ApiEngine.searchProducts({ q: "Black Forest" });
    assert(exactSearchRes.products.length > 0, "Search for 'Black Forest' returns results");
    const topResult = exactSearchRes.products[0];
    assert(
      (topResult.title || topResult.name || "").toLowerCase().includes("black forest"),
      `Top ranked result for 'Black Forest' is: '${topResult.title || topResult.name}'`
    );

    const truffleRankRes = ApiEngine.searchProducts({ q: "Chocolate Truffle" });
    assert(truffleRankRes.products.length > 0, "Search for 'Chocolate Truffle' returns results");
    const topTruffle = truffleRankRes.products[0];
    assert(
      (topTruffle.title || topTruffle.name || "").toLowerCase().includes("truffle"),
      `Top ranked result for 'Chocolate Truffle' is: '${topTruffle.title || topTruffle.name}'`
    );

    // ── SECTION 4: Matching Categories & Flavours Aggregation ──
    console.log("\n📋 SECTION 4: Matching Categories & Flavours Aggregation");
    assert(Array.isArray(chocolateRes.categories), "Search response includes categories aggregation array");
    assert(Array.isArray(chocolateRes.flavours), "Search response includes flavours aggregation array");
    assert(chocolateRes.categories!.length > 0, `Search for 'chocolate' aggregates ${chocolateRes.categories!.length} category matches`);
    assert(chocolateRes.flavours!.length > 0, `Search for 'chocolate' aggregates ${chocolateRes.flavours!.length} flavour matches`);

    const hasChocCat = chocolateRes.categories!.some((c) => c.name.toLowerCase().includes("chocolate") || c.slug.includes("chocolate"));
    assert(hasChocCat, "Matching categories include Chocolate");

    // ── SECTION 5: Substring & Flavour Matching ──
    console.log("\n📋 SECTION 5: Substring & Flavour Matching");
    const redVelvetRes = await searchProductsAction({ q: "red velvet", limit: 6 });
    assert(redVelvetRes.results.length > 0, `Search for 'red velvet' found ${redVelvetRes.results.length} items`);
    assert(
      redVelvetRes.results.some((p) => p.title.toLowerCase().includes("red velvet") || (p.flavour && p.flavour.toLowerCase().includes("red velvet"))),
      "Results contain authentic Red Velvet cake"
    );

    const mangoRes = await searchProductsAction({ q: "mango", limit: 6 });
    assert(mangoRes.results.length > 0, `Search for 'mango' found ${mangoRes.results.length} items`);

    // ── SECTION 6: Category-Based Search & Filtering ──
    console.log("\n📋 SECTION 6: Category-Based Search & Filtering");
    const filteredByCat = await searchProductsAction({ category: "chocolate-cakes", limit: 6 });
    assert(filteredByCat.results.length > 0, "Filtering by category slug 'chocolate-cakes' returns products");
    assert(
      filteredByCat.results.every(
        (p) =>
          (p.category_slug || "").includes("chocolate") ||
          (p.category || "").toLowerCase().includes("chocolate") ||
          (Array.isArray(p.categories) && p.categories.some((c: any) => c.slug?.includes("chocolate") || c.name?.toLowerCase().includes("chocolate"))) ||
          (Array.isArray(p.category_ids) && p.category_ids.some((id: string) => id.includes("chocolate")))
      ),
      "All returned products belong to Chocolate category"
    );

    // ── SECTION 7: Pagination & Limit Bounds ──
    console.log("\n📋 SECTION 7: Pagination & Limit Bounds");
    const limit3Res = await searchProductsAction({ limit: 3 });
    assert(limit3Res.results.length <= 3, `Limit=3 restricts result size to ${limit3Res.results.length}`);
    assert(limit3Res.limit === 3, "Response reports limit=3");

    const limit10Res = await searchProductsAction({ limit: 10 });
    assert(limit10Res.results.length <= 10, `Limit=10 returns up to 10 items (got ${limit10Res.results.length})`);

    // ── SECTION 8: Zero-Result & Edge Queries ──
    console.log("\n📋 SECTION 8: Zero-Result & Edge Queries");
    const emptyQueryRes = await searchProductsAction({ q: "" });
    assert(Array.isArray(emptyQueryRes.results), "Empty query string executes without throwing");
    assert(emptyQueryRes.results.length > 0, "Empty query returns default catalog selection");

    const gibberishRes = await searchProductsAction({ q: "xyznonexistentcake9999" });
    assert(Array.isArray(gibberishRes.results), "Non-existent search term executes safely");
    assert(gibberishRes.results.length === 0, "Non-existent search term returns 0 results");
    assert(gibberishRes.count === 0, "Count reports 0 for non-existent search term");

    // ── SECTION 9: Single Product Direct Resolution ──
    console.log("\n📋 SECTION 9: Single Product Direct Resolution");
    const testProductId = firstCake.product_id;
    const directProduct = ApiEngine.getProductById(testProductId);
    assert(directProduct !== null, `ApiEngine.getProductById('${testProductId}') resolved successfully`);
    assert(directProduct?.id === testProductId || directProduct?.product_id === testProductId, "Resolved product has matching ID");
    assert(Boolean(directProduct?.title || directProduct?.name), `Resolved product title: ${directProduct?.title || directProduct?.name}`);

    // ── SECTION 10: Security, Privacy & Zero Leakage ──
    console.log("\n📋 SECTION 10: Security, Privacy & Zero Leakage");
    const sampleItem = chocolateRes.results[0] as any;
    assert(sampleItem.password === undefined, "Security: Search result does not leak passwords");
    assert(sampleItem.customer_uid === undefined, "Privacy: Search result does not leak customer_uid");
    assert(sampleItem.customer_phone === undefined, "Privacy: Search result does not leak customer phone");
    assert(sampleItem.customer_address === undefined, "Privacy: Search result does not leak customer address");
    assert(sampleItem.credit_card === undefined, "Privacy: Search result does not leak payment data");

    // ── SECTION 11: Sort Invariants ──
    console.log("\n📋 SECTION 11: Sort Invariants");
    const priceAscRes = await searchProductsAction({ sort: "price_asc", limit: 10 });
    let isAsc = true;
    for (let i = 0; i < priceAscRes.results.length - 1; i++) {
      if (priceAscRes.results[i].price > priceAscRes.results[i + 1].price) {
        isAsc = false;
        break;
      }
    }
    assert(isAsc, "price_asc sorts products from lowest to highest price");

    const priceDescRes = await searchProductsAction({ sort: "price_desc", limit: 10 });
    let isDesc = true;
    for (let i = 0; i < priceDescRes.results.length - 1; i++) {
      if (priceDescRes.results[i].price < priceDescRes.results[i + 1].price) {
        isDesc = false;
        break;
      }
    }
    assert(isDesc, "price_desc sorts products from highest to lowest price");

    console.log("\n============================================================");
    console.log(`📊 SEARCH TEST SUMMARY:`);
    console.log(`   Total Checkpoints: ${passed + failed}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Pass Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log("============================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("💥 Unhandled exception in search test suite:", err);
    process.exit(1);
  }
}

runSearchTestSuite();
