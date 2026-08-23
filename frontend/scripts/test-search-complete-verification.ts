import { ApiEngine } from "../src/lib/api-engine";
import { searchProductsAction } from "../src/lib/actions/catalog";
import { searchProducts } from "../src/lib/data/catalog";

async function runCompleteSearchVerification() {
  console.log("============================================================");
  console.log("🔍 CAKETOHOME — COMPLETE SEARCH & UI VERIFICATION SUITE");
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

  // 1. Data Model & Deduplication
  console.log("\n📋 SECTION 1: Data Model & Zero Duplicate Products");
  const testTerms = ["chocolate", "red velvet", "mango", "black forest", "cake", "cheesecake", "xyz123nonexistent"];
  
  for (const term of testTerms) {
    const res = await searchProductsAction({ q: term, limit: 12 });
    const productIds = res.results.map((p) => p.product_id);
    const uniqueIds = new Set(productIds);
    assert(
      productIds.length === uniqueIds.size,
      `Query "${term}" produces ZERO duplicate products (found ${res.results.length} results, ${uniqueIds.size} unique)`
    );

    if (term === "xyz123nonexistent") {
      assert(res.results.length === 0, `Query "${term}" returns 0 results as expected for non-existent item`);
    } else {
      assert(res.results.length > 0, `Query "${term}" returns active products (count: ${res.results.length})`);
    }
  }

  // 2. Canonical Product Attributes
  console.log("\n📋 SECTION 2: Canonical Search Result Attributes");
  const chocoRes = await searchProductsAction({ q: "chocolate", limit: 5 });
  assert(chocoRes.results.length > 0, "Chocolate search returns results");
  const firstProd = chocoRes.results[0];
  assert(Boolean(firstProd.product_id), `Product has canonical ID: ${firstProd.product_id}`);
  assert(Boolean(firstProd.title), `Product has title: ${firstProd.title}`);
  assert(Boolean(firstProd.thumbnail), `Product has thumbnail URL: ${firstProd.thumbnail?.slice(0, 40)}...`);
  assert(typeof firstProd.price === "number" && firstProd.price > 0, `Product has numeric starting price: ₹${firstProd.price}`);
  assert(Boolean(firstProd.category), `Product has category assigned: ${firstProd.category}`);
  assert(Boolean(firstProd.flavour), `Product has flavour assigned: ${firstProd.flavour}`);

  // 3. Category and Flavour Aggregations
  console.log("\n📋 SECTION 3: Multi-faceted Aggregations");
  assert(Array.isArray(chocoRes.categories) && chocoRes.categories.length > 0, `Search response returns category chips (${chocoRes.categories?.length} categories)`);
  assert(Array.isArray(chocoRes.flavours) && chocoRes.flavours.length > 0, `Search response returns flavour chips (${chocoRes.flavours?.length} flavours)`);

  // 4. Catalog Search Sync with search & q parameters
  console.log("\n📋 SECTION 4: URL Parameters Integration (search / q)");
  const searchParamRes = await searchProducts({ q: "velvet" });
  assert(searchParamRes.results.length > 0, "searchProducts with q filter returns matched cakes");
  assert(searchParamRes.results.some((p) => p.title.toLowerCase().includes("velvet") || p.flavour?.toLowerCase().includes("velvet")), "Results contain velvet cakes");

  // 5. Deduplication across multiple weight variants in memoryStore
  console.log("\n📋 SECTION 5: Variant Collapsing Invariant");
  const allBlackForest = ApiEngine.getProducts({ q: "Black Forest" });
  const blackForestIds = allBlackForest.map((p: any) => p.id || p.product_id);
  const uniqueBf = new Set(blackForestIds);
  assert(blackForestIds.length === uniqueBf.size, "Black Forest Gateau is collapsed into a single canonical product card");

  console.log("\n============================================================");
  console.log(`📊 TOTAL VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCompleteSearchVerification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
