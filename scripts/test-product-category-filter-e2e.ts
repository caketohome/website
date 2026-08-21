import { ApiEngine } from "../frontend/src/lib/api-engine";
import { apiClient } from "../frontend/src/lib/api-client";
import { searchProducts, getCatalogFilterOptions } from "../frontend/src/lib/data/catalog";
import { AiToolRegistry } from "../frontend/src/lib/ai/ai-tool-registry";
import * as https from "https";
import * as fs from "fs";

interface TestAssertion {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestAssertion[] = [];

function assert(id: number, name: string, condition: boolean, details: string) {
  results.push({
    id,
    name,
    passed: Boolean(condition),
    details,
  });
  const symbol = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`${symbol} [Assertion ${id}]: ${name} - ${details}`);
}

function checkUrlStatus(url: string): Promise<number> {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode || 0);
    }).on("error", () => {
      resolve(0);
    });
  });
}

async function runSuite() {
  console.log("===============================================================================");
  console.log("   CAKETOHOME: PRODUCT CATEGORY MODEL & FILTER SYSTEM E2E VERIFICATION SUITE   ");
  console.log("===============================================================================\n");

  // 1. Mango Cake Image Fix Verification
  const prod3 = ApiEngine.getProductById("prod_3");
  const mangoImgUrl = prod3?.thumbnail || "";
  const isFixedUrl = !mangoImgUrl.includes("photo-1535141192574-5d4897c13136") && mangoImgUrl.includes("photo-1588195538326-c5b1e9f80a1b");
  assert(1, "Mango Cake Thumbnail URL Updated", isFixedUrl, `prod_3 thumbnail is ${mangoImgUrl}`);

  const mangoStatus = await checkUrlStatus(mangoImgUrl);
  assert(2, "Mango Cake Thumbnail HTTP 200", mangoStatus === 200, `Image HTTP status code: ${mangoStatus}`);

  // 2. Canonical Categories Verification
  const categories = ApiEngine.getCategories(true);
  assert(3, "Canonical Categories Loaded", categories.length >= 6, `Total canonical categories: ${categories.length}`);

  const chocolateCat = categories.find((c: any) => c.slug === "chocolate-cakes");
  assert(4, "Chocolate Cakes Category Exists", Boolean(chocolateCat && chocolateCat.name === "Chocolate Cakes"), `Category: ${chocolateCat?.name} (${chocolateCat?.slug})`);

  const fruitCat = categories.find((c: any) => c.slug === "fruit-mousse-cakes");
  assert(5, "Fruit & Mousse Cakes Category Exists", Boolean(fruitCat && fruitCat.name === "Fruit & Mousse Cakes"), `Category: ${fruitCat?.name} (${fruitCat?.slug})`);

  const redVelvetCat = categories.find((c: any) => c.slug === "red-velvet-cakes");
  assert(6, "Red Velvet Cakes Category Exists", Boolean(redVelvetCat && redVelvetCat.name === "Red Velvet Cakes"), `Category: ${redVelvetCat?.name} (${redVelvetCat?.slug})`);

  // 3. Dynamic Category Product Counts
  assert(7, "Chocolate Cakes Product Count Accurate", (chocolateCat?.product_count || 0) >= 2, `Chocolate count: ${chocolateCat?.product_count}`);
  assert(8, "Fruit Cakes Product Count Accurate", (fruitCat?.product_count || 0) >= 1, `Fruit count: ${fruitCat?.product_count}`);

  // 4. Products Enriched with Category Taxonomy
  const allProducts = ApiEngine.getProducts();
  const allEnriched = allProducts.every((p: any) => p.category && p.category_slug && Array.isArray(p.categories) && p.categories.length > 0);
  assert(9, "All Products Enriched with Categories", allEnriched, `Total enriched products: ${allProducts.length}`);

  // 5. Category Filtering Logic in ApiEngine
  const chocProducts = ApiEngine.getProducts({ category: "chocolate-cakes" });
  const chocHasBelgian = chocProducts.some((p: any) => (p.id || p.product_id) === "prod_1");
  assert(10, "Filter by Chocolate Category Returns Truffle Cake", chocHasBelgian, `Chocolate filtered count: ${chocProducts.length}`);

  const mangoProducts = ApiEngine.getProducts({ category: "fruit-mousse-cakes" });
  const mangoFound = mangoProducts.some((p: any) => (p.id || p.product_id) === "prod_3");
  assert(11, "Filter by Fruit Category Returns Mango Cake", mangoFound, `Fruit filtered count: ${mangoProducts.length}`);

  const redVelvetProducts = ApiEngine.getProducts({ category: "red-velvet-cakes" });
  const rvFound = redVelvetProducts.some((p: any) => (p.id || p.product_id) === "prod_2");
  assert(12, "Filter by Red Velvet Category Returns Red Velvet Cake", rvFound, `Red Velvet filtered count: ${redVelvetProducts.length}`);

  // 6. Data Layer searchProducts Integration
  const catalogChocSearch = await searchProducts({ category: "chocolate-cakes" });
  assert(13, "Data Layer searchProducts Category Filter", catalogChocSearch.results.length >= 1 && catalogChocSearch.results.some(p => p.product_id === "prod_1"), `Search returned ${catalogChocSearch.results.length} products`);

  const multiFilterSearch = await searchProducts({ category: "chocolate-cakes", flavour: "Chocolate", min_price: 600 });
  assert(14, "Multi-Filter Matrix (Category + Flavour + Price)", multiFilterSearch.results.some(p => p.product_id === "prod_1" && p.price === 649), `Multi-filter returned ${multiFilterSearch.results.length} products`);

  // 7. Catalog Filter Options API
  const filterOptions = await getCatalogFilterOptions();
  assert(15, "getCatalogFilterOptions Returns Category Taxonomy", filterOptions.categories.length >= 6, `Categories in options: ${filterOptions.categories.length}`);

  // 8. AI Tool Registry Integration
  const aiCatResult = await AiToolRegistry.getCategories();
  assert(16, "AI Tool Registry getCategories Returns Taxonomy", aiCatResult.totalCategories >= 6, `AI Categories: ${aiCatResult.totalCategories}`);

  const aiProductSearchResult = await AiToolRegistry.searchProducts({ categoryId: "chocolate-cakes" });
  assert(17, "AI Tool Registry searchProducts by CategoryId", aiProductSearchResult.totalFound >= 1, `AI Found products: ${aiProductSearchResult.totalFound}`);

  // 9. Database Store JSON Persistence
  const dbRaw = JSON.parse(fs.readFileSync("frontend/data/db-store.json", "utf8"));
  const dbHasCategories = Array.isArray(dbRaw.categories) && dbRaw.categories.length >= 6;
  const dbHasProductCategories = Array.isArray(dbRaw.product_categories) && dbRaw.product_categories.length >= 5;
  assert(18, "Database Store Categories Persisted", dbHasCategories, `db-store.json categories count: ${dbRaw.categories?.length}`);
  assert(19, "Database Store Product Categories Relational Mapping", dbHasProductCategories, `db-store.json product_categories count: ${dbRaw.product_categories?.length}`);

  // 10. Product Detail Query Enrichment
  const detailProd = ApiEngine.getProductBySlug("belgian-chocolate-truffle-cake");
  assert(20, "Product Detail Enriched with Category Data", Boolean(detailProd?.category === "Chocolate Cakes" && detailProd?.categories?.length >= 2), `Detail category: ${detailProd?.category}, categories count: ${detailProd?.categories?.length}`);

  console.log("\n===============================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`   SUMMARY: ${totalPassed} / ${results.length} ASSERTIONS PASSED (${((totalPassed / results.length) * 100).toFixed(1)}%)   `);
  console.log("===============================================================================\n");

  if (totalPassed === results.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
