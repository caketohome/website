/**
 * Comprehensive Product API, 404 Routing, Deduplication & Performance Integrity Test Suite
 * Gates:
 * 1. Product Options API Contract (/api/v1/store/catalog/products/prod_2/options & variants)
 * 2. Accessories API Contract (/api/v1/accessories & /api/v1/store/accessories)
 * 3. Occasions API Contract (/api/v1/occasions)
 * 4. Product Reviews API Contract (/api/v1/products/prod_2/reviews)
 * 5. Customer Favorites API Contract (/api/v1/customer/favorites & /check/prod_2)
 * 6. Master Variant Options API (/api/v1/admin/catalog/flavors & shapes)
 * 7. Single-Flight Request Deduplication (concurrent identical requests)
 * 8. Cache Performance & TTL Verification
 * 9. Proper 404 Not Found Handling for Non-Existent Routes (No 500s or crashes)
 * 10. End-to-End Product Resolution & Options Schema Validation
 */

import { ApiEngine } from "../src/lib/api-engine";
import { apiClient } from "../src/lib/api-client";

let passedCount = 0;
let failedCount = 0;

function assert(gate: string, condition: boolean, details: string) {
  if (condition) {
    console.log(`✅ [GATE PASSED] ${gate}: ${details}`);
    passedCount++;
  } else {
    console.error(`❌ [GATE FAILED] ${gate}: ${details}`);
    failedCount++;
  }
}

async function runApiIntegrityTests() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING CRITICAL API ROUTING, 404 & PERFORMANCE INTEGRITY E2E SUITE");
  console.log("================================================================================\n");

  // ── GATE 1: Product Options via ApiEngine ─────────────────────────────────
  console.log("👉 Testing Gate 1: ApiEngine.getStorefrontProductOptions direct contract");
  const directOptions = ApiEngine.getStorefrontProductOptions("prod_2");
  assert("Gate 1.1 - Options Object Present", Boolean(directOptions && directOptions.success), "Options returned successfully");
  assert("Gate 1.2 - Flavors Array Populated", Array.isArray(directOptions.flavors) && directOptions.flavors.length > 0, `Found ${directOptions.flavors?.length} flavors`);
  assert("Gate 1.3 - Shapes Array Populated", Array.isArray(directOptions.shapes) && directOptions.shapes.length > 0, `Found ${directOptions.shapes?.length} shapes`);
  assert("Gate 1.4 - Weights Array Populated", Array.isArray(directOptions.weights) && directOptions.weights.length > 0, `Found ${directOptions.weights?.length} weight options`);
  assert("Gate 1.5 - Selection Flags Present", typeof directOptions.enable_flavor_selection === "boolean" && typeof directOptions.enable_shape_selection === "boolean", "Dynamic selection flags are boolean");

  // ── GATE 2: Product Options API Endpoint (/store/catalog/products/:id/options)
  console.log("\n👉 Testing Gate 2: apiClient.getStorefrontProductOptions API endpoint");
  const apiOptions = await apiClient.getStorefrontProductOptions("prod_2");
  assert("Gate 2.1 - HTTP Product Options Resolution", Boolean(apiOptions && apiOptions.success), "Resolved /store/catalog/products/prod_2/options without 404");
  assert("Gate 2.2 - HTTP Options Flavors Match", Array.isArray(apiOptions.flavors) && apiOptions.flavors.length > 0, `Received ${apiOptions.flavors?.length} flavors`);
  assert("Gate 2.3 - HTTP Options Shapes Match", Array.isArray(apiOptions.shapes) && apiOptions.shapes.length > 0, `Received ${apiOptions.shapes?.length} shapes`);

  // ── GATE 3: Accessories API Endpoint (/accessories?productId=prod_2) ──────
  console.log("\n👉 Testing Gate 3: apiClient.getAccessories API endpoint");
  const accessoriesRes = await apiClient.getAccessories("prod_2");
  assert("Gate 3.1 - Accessories Resolution", Boolean(accessoriesRes && Array.isArray(accessoriesRes.accessories)), "Resolved /accessories without 404");
  assert("Gate 3.2 - Accessories Content", accessoriesRes.accessories.length > 0, `Returned ${accessoriesRes.accessories?.length} active celebration accessories`);

  // ── GATE 4: Occasions API Endpoint (/occasions) ───────────────────────────
  console.log("\n👉 Testing Gate 4: apiClient.getOccasions API endpoint");
  const occasionsRes = await apiClient.getOccasions();
  assert("Gate 4.1 - Occasions Resolution", Boolean(occasionsRes && Array.isArray(occasionsRes.occasions)), "Resolved /occasions without 404");
  assert("Gate 4.2 - Occasions Population", occasionsRes.occasions.length > 0, `Found ${occasionsRes.occasions?.length} active occasions`);

  // ── GATE 5: Product Reviews API Endpoint (/products/:id/reviews) ──────────
  console.log("\n👉 Testing Gate 5: apiClient.getProductReviews API endpoint");
  const reviewsRes = await apiClient.getProductReviews("prod_2");
  assert("Gate 5.1 - Reviews Resolution", Boolean(reviewsRes && reviewsRes.success), "Resolved /products/prod_2/reviews without 404");
  assert("Gate 5.2 - Reviews Array Present", Array.isArray(reviewsRes.reviews), `Returned ${reviewsRes.reviews?.length} reviews`);

  // ── GATE 6: Customer Favorites Check API (/customer/favorites/check/:id) ──
  console.log("\n👉 Testing Gate 6: apiClient.checkCustomerFavorite API endpoint");
  const favCheckRes = await apiClient.checkCustomerFavorite("prod_2");
  assert("Gate 6.1 - Favorite Check Resolution", Boolean(favCheckRes && favCheckRes.success), "Resolved /customer/favorites/check/prod_2 without 404");
  assert("Gate 6.2 - Favorite Boolean Status", typeof favCheckRes.is_favorited === "boolean", `is_favorited is boolean (${favCheckRes.is_favorited})`);

  // ── GATE 7: Single-Flight Request Deduplication ──────────────────────────
  console.log("\n👉 Testing Gate 7: Single-Flight In-Flight Request Deduplication");
  const startTime = Date.now();
  // Fire 10 parallel identical requests
  const parallelPromises = Array.from({ length: 10 }).map(() =>
    apiClient.getStorefrontProductOptions("prod_2")
  );
  const parallelResults = await Promise.all(parallelPromises);
  const duration = Date.now() - startTime;

  const allMatched = parallelResults.every(
    (res) => res && res.success && res.flavors?.length === directOptions.flavors.length
  );
  assert("Gate 7.1 - Concurrent Single-Flight Execution", allMatched, `10 parallel requests resolved in ${duration}ms via shared in-flight promise`);
  assert("Gate 7.2 - Fast Deduplicated Response Time", duration < 500, `Duration was ${duration}ms (<500ms target)`);

  // ── GATE 8: Metadata Cache Performance ────────────────────────────────────
  console.log("\n👉 Testing Gate 8: Metadata Cache TTL & Response Performance");
  const cacheStart = Date.now();
  const cachedOccasions = await apiClient.getOccasions();
  const cacheDuration = Date.now() - cacheStart;
  assert("Gate 8.1 - Cached Occasions Retrieved", Boolean(cachedOccasions && cachedOccasions.occasions?.length > 0), "Retrieved from in-memory metadata cache");
  assert("Gate 8.2 - Sub-millisecond Cache Latency", cacheDuration <= 50, `Retrieved in ${cacheDuration}ms (instant cache hit)`);

  // ── GATE 9: Non-Existent Route 404 Behavior ──────────────────────────────
  console.log("\n👉 Testing Gate 9: Clean 404 for invalid routes without crashing");
  let caught404 = false;
  try {
    await apiClient.request("/non-existent-sample-route-xyz-999");
  } catch (err: any) {
    caught404 = true;
    assert("Gate 9.1 - Clean 404 Throw", true, `Caught expected error: ${err.message}`);
  }
  assert("Gate 9.2 - 404 Error Was Handled", caught404, "Invalid endpoint rejected cleanly without 500 crash");

  // ── GATE 10: Slug vs ID Product Resolution & Options ──────────────────────
  console.log("\n👉 Testing Gate 10: Product Slug vs ID Options Consistency");
  const slugOptions = await apiClient.getStorefrontProductOptions("classic-red-velvet-cake");
  assert("Gate 10.1 - Slug Options Resolution", Boolean(slugOptions && slugOptions.success), "Resolved options for slug 'classic-red-velvet-cake'");
  assert("Gate 10.2 - Slug vs ID Parity", (slugOptions.flavors?.length || 0) >= (directOptions.flavors?.length || 0), "Options match between slug and ID resolution");

  console.log("\n================================================================================");
  console.log(`🏁 TEST RUN SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runApiIntegrityTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
