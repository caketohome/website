import { dbQuery, closeDbPool } from "../src/lib/db";
import { ApiEngine } from "../src/lib/api-engine";
import { searchProducts, listProducts, getProductById, getProductBySlug } from "../src/lib/data/catalog";

async function runStorefrontDbAuthorityTest() {
  console.log("============================================================");
  console.log("🏛️  STOREFRONT CATALOG DATA-SOURCE AUTHORITY VERIFICATION");
  console.log("============================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  try {
    // 1. Direct PostgreSQL query
    console.log("\n[1] Querying PostgreSQL public.product directly...");
    const pgRes = await dbQuery(`
      SELECT id, title, handle, thumbnail, status, metadata 
      FROM "product" 
      WHERE deleted_at IS NULL
      ORDER BY id ASC
    `);
    const pgProducts = pgRes.rows;
    console.log(`Found ${pgProducts.length} active products in PostgreSQL.`);
    assert(pgProducts.length > 0, `PostgreSQL contains active products (found ${pgProducts.length})`);

    // 2. Hydrate ApiEngine and verify in-memory store matches DB count
    console.log("\n[2] Hydrating ApiEngine and verifying product parity...");
    await ApiEngine.ensureHydrated();
    const engineProducts = ApiEngine.getProducts();
    console.log(`ApiEngine.getProducts() returned ${engineProducts.length} products.`);
    assert(
      engineProducts.length === pgProducts.length,
      `ApiEngine count (${engineProducts.length}) exactly matches PostgreSQL active count (${pgProducts.length})`
    );

    // 3. Check every PG product is in ApiEngine and storefront catalog
    console.log("\n[3] Verifying 1-to-1 mapping between DB and storefront...");
    const catalogProducts = await listProducts();
    console.log(`catalog.listProducts() returned ${catalogProducts.length} products.`);
    assert(
      catalogProducts.length === pgProducts.length,
      `catalog.listProducts() count (${catalogProducts.length}) matches DB (${pgProducts.length})`
    );

    for (const pgP of pgProducts) {
      const foundInCatalog = catalogProducts.find((cp: any) => cp.id === pgP.id || cp.product_id === pgP.id);
      assert(
        Boolean(foundInCatalog),
        `DB product "${pgP.title}" (${pgP.id}) exists in storefront catalog`,
        `Missing ID: ${pgP.id}`
      );

      if (foundInCatalog) {
        assert(
          foundInCatalog.title === pgP.title || foundInCatalog.name === pgP.title,
          `Title matches DB for ${pgP.id}: "${foundInCatalog.title || foundInCatalog.name}" === "${pgP.title}"`
        );
      }
    }

    // 4. Test search with real vs non-existent queries
    console.log("\n[4] Verifying search engine database authority...");
    const searchChoco = await searchProducts({ q: "Chocolate" });
    assert(searchChoco.count > 0, `Search "Chocolate" returned ${searchChoco.count} matching DB cakes`);

    const nonExistentQuery = "CAKE_TO_HOME_NON_EXISTENT_PRODUCT_999999";
    const searchNonExistent = await searchProducts({ q: nonExistentQuery });
    assert(
      searchNonExistent.count === 0 && searchNonExistent.results.length === 0,
      `Non-existent query "${nonExistentQuery}" returns strictly 0 results (no mock/demo fallback)`
    );

    const nonExistentZ = "ZZZZ_NON_EXISTENT_PRODUCT_12345";
    const searchNonExistentZ = await searchProducts({ q: nonExistentZ });
    assert(
      searchNonExistentZ.count === 0 && searchNonExistentZ.results.length === 0,
      `Non-existent query "${nonExistentZ}" returns strictly 0 results`
    );

    // 5. Test getProductById and getProductBySlug with real vs non-existent
    console.log("\n[5] Verifying PDP lookups & zero fake fallbacks...");
    const firstPgProduct = pgProducts[0];
    const realById = await getProductById(firstPgProduct.id);
    assert(Boolean(realById), `getProductById("${firstPgProduct.id}") resolves real DB product: "${realById?.title}"`);

    const fakeById = await getProductById("non_existent_fake_id_999999");
    assert(fakeById === null, `getProductById("non_existent_fake_id_999999") returns null (no mock fallback)`);

    const fakeBySlug = await getProductBySlug("non-existent-fake-slug-999999");
    assert(fakeBySlug === null, `getProductBySlug("non-existent-fake-slug-999999") returns null (no mock fallback)`);

    // 6. Test Category & Flavour Facets
    console.log("\n[6] Verifying Category & Flavour Facets authenticity...");
    const allSearch = await searchProducts({});
    assert(Array.isArray(allSearch.categories) && allSearch.categories.length > 0, "Categories facet populated from DB");
    assert(Array.isArray(allSearch.flavours) && allSearch.flavours.length > 0, "Flavours facet populated from DB");
    console.log("Active Flavours from DB:", allSearch.flavours);
    console.log("Active Categories from DB:", allSearch.categories?.map((c: any) => `${c.name} (${c.count})`));

    console.log("\n============================================================");
    console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log("============================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await closeDbPool();
  }
}

runStorefrontDbAuthorityTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
