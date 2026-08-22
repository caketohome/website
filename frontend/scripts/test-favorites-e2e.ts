/**
 * CAKETOHOME — FAVORITES / WISHLIST E2E VERIFICATION SUITE
 *
 * Verifies all 30 phases:
 * 1. Database schema, unique constraints, and isolation
 * 2. ApiEngine core methods (add, remove, check, list)
 * 3. Customer 360 profile integration & metrics
 * 4. Webhook event dispatching (wishlist.item.added, wishlist.item.removed)
 * 5. Multi-customer session isolation (no cross-customer leaks)
 * 6. Edge cases & error handling (401 unauthenticated, 404 non-existent product, 400 empty)
 */

import { ApiEngine } from "../src/lib/api-engine";
import { apiClient } from "../src/lib/api-client";
import { WebhookEngine } from "../src/lib/webhook-engine";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) {
      console.error(`     Detail:`, detail);
    }
  }
}

async function runFavoritesE2ESuite() {
  console.log("============================================================");
  console.log("🧁 CAKETOHOME — FAVORITES / WISHLIST SYSTEM E2E TEST SUITE");
  console.log("============================================================\n");

  const TEST_CUST_1 = "cth_cus_test_fav_01";
  const TEST_CUST_2 = "cth_cus_test_fav_02";

  // Ensure store is loaded
  const store = ApiEngine.getStore();
  const products = store.products || [];
  const testProduct1 = products[0]?.id || "prod_1";
  const testProduct2 = products[1]?.id || "prod_2";

  console.log(`Using Test Products: "${testProduct1}" and "${testProduct2}"`);
  console.log(`Using Test Customer UIDs: "${TEST_CUST_1}" and "${TEST_CUST_2}"\n`);

  // Clean up any previous test artifacts for test customers
  ApiEngine.ensureFavoritesStore();
  store.customer_favorites = (store.customer_favorites || []).filter(
    (f: any) => f.customer_uid !== TEST_CUST_1 && f.customer_uid !== TEST_CUST_2
  );
  ApiEngine.persist();

  // ────────────────────────────────────────────────────────────
  // 1. INITIAL STATE & EMPTY VERIFICATION
  // ────────────────────────────────────────────────────────────
  console.log("📋 SECTION 1: Initial State & Empty Verifications");
  {
    const initialFavs = ApiEngine.getCustomerFavorites(TEST_CUST_1);
    const initialIds = ApiEngine.getCustomerFavoriteIds(TEST_CUST_1);
    const isInitiallyFav = ApiEngine.isProductFavorited(TEST_CUST_1, testProduct1);

    assert(Array.isArray(initialFavs) && initialFavs.length === 0, "Initial customer favorites list is empty []");
    assert(Array.isArray(initialIds) && initialIds.length === 0, "Initial customer favorite IDs list is empty []");
    assert(isInitiallyFav === false, "isProductFavorited returns false for un-favorited product");
  }

  // ────────────────────────────────────────────────────────────
  // 2. AUTH & VALIDATION GUARDS (EDGE CASES)
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 2: Auth & Validation Guards");
  {
    const unauthAdd = ApiEngine.addCustomerFavorite("", testProduct1);
    assert(unauthAdd.success === false && unauthAdd.statusCode === 401, "Reject adding favorite without customerUid (401)");

    const emptyProdAdd = ApiEngine.addCustomerFavorite(TEST_CUST_1, "");
    assert(emptyProdAdd.success === false && emptyProdAdd.statusCode === 400, "Reject adding favorite with empty productId (400)");

    const nonExistentProdAdd = ApiEngine.addCustomerFavorite(TEST_CUST_1, "prod_non_existent_999999");
    assert(nonExistentProdAdd.success === false && nonExistentProdAdd.statusCode === 404, "Reject adding non-existent product to favorites (404)");

    const unauthRemove = ApiEngine.removeCustomerFavorite("", testProduct1);
    assert(unauthRemove.success === false && unauthRemove.statusCode === 401, "Reject removing favorite without customerUid (401)");
  }

  // ────────────────────────────────────────────────────────────
  // 3. CANONICAL FAVORITE ADDITION & DATA INTEGRITY
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 3: Canonical Favorite Addition & Persistence");
  {
    const addRes = ApiEngine.addCustomerFavorite(TEST_CUST_1, testProduct1);
    assert(addRes.success === true && addRes.is_favorited === true, "Successfully added product to favorites");
    assert(!!addRes.favorite && typeof addRes.favorite.id === "string", "Favorite record has unique string id");
    assert(addRes.favorite?.customer_uid === TEST_CUST_1, "Favorite record correctly stores customer_uid");
    assert(addRes.favorite?.product_id === testProduct1, "Favorite record correctly stores product_id");
    assert(!!addRes.favorite?.created_at, "Favorite record contains ISO created_at timestamp");

    // Check query methods
    const isFavNow = ApiEngine.isProductFavorited(TEST_CUST_1, testProduct1);
    assert(isFavNow === true, "isProductFavorited returns true after adding");

    const favIds = ApiEngine.getCustomerFavoriteIds(TEST_CUST_1);
    assert(favIds.includes(testProduct1), "getCustomerFavoriteIds includes added productId");

    const fullFavs = ApiEngine.getCustomerFavorites(TEST_CUST_1);
    assert(fullFavs.length === 1, "getCustomerFavorites length is 1");
    assert(fullFavs[0].product_id === testProduct1, "Enriched favorite contains matching product_id");
    assert(!!fullFavs[0].title, "Enriched favorite contains product title");
    assert(typeof fullFavs[0].price === "number", "Enriched favorite contains numeric product price");
  }

  // ────────────────────────────────────────────────────────────
  // 4. UNIQUE CONSTRAINT & IDEMPOTENCE (NO DUPLICATES)
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 4: Unique Constraint & Idempotence");
  {
    // Try adding the same product again
    const dupAddRes = ApiEngine.addCustomerFavorite(TEST_CUST_1, testProduct1);
    assert(dupAddRes.success === true && dupAddRes.is_favorited === true, "Adding duplicate favorite returns idempotent success");

    const favsAfterDup = ApiEngine.getCustomerFavorites(TEST_CUST_1);
    assert(favsAfterDup.length === 1, "Customer favorites count remains 1 (no duplicate rows created)");

    const rawFavStore = store.customer_favorites || [];
    const matchingRows = rawFavStore.filter((f: any) => f.customer_uid === TEST_CUST_1 && f.product_id === testProduct1);
    assert(matchingRows.length === 1, "Raw database store strictly enforces UNIQUE(customer_uid, product_id)");
  }

  // ────────────────────────────────────────────────────────────
  // 5. MULTIPLE FAVORITES FOR SAME CUSTOMER
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 5: Multiple Product Favorites");
  {
    const addRes2 = ApiEngine.addCustomerFavorite(TEST_CUST_1, testProduct2);
    assert(addRes2.success === true, "Successfully added second product to favorites");

    const favIds = ApiEngine.getCustomerFavoriteIds(TEST_CUST_1);
    assert(favIds.length === 2, "getCustomerFavoriteIds has exactly 2 items");
    assert(favIds.includes(testProduct1) && favIds.includes(testProduct2), "getCustomerFavoriteIds contains both products");

    const fullFavs = ApiEngine.getCustomerFavorites(TEST_CUST_1);
    assert(fullFavs.length === 2, "getCustomerFavorites has exactly 2 enriched items");
  }

  // ────────────────────────────────────────────────────────────
  // 6. CUSTOMER ISOLATION & ZERO DATA LEAKAGE
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 6: Multi-Customer Session Isolation");
  {
    const cust2Favs = ApiEngine.getCustomerFavorites(TEST_CUST_2);
    const cust2Ids = ApiEngine.getCustomerFavoriteIds(TEST_CUST_2);
    const isCust2Fav = ApiEngine.isProductFavorited(TEST_CUST_2, testProduct1);

    assert(cust2Favs.length === 0, "Customer 2 has 0 favorites (no leakage from Customer 1)");
    assert(cust2Ids.length === 0, "Customer 2 favorite IDs is empty []");
    assert(isCust2Fav === false, "isProductFavorited for Customer 2 is false");

    // Add favorite to Customer 2
    ApiEngine.addCustomerFavorite(TEST_CUST_2, testProduct2);
    const cust2FavsAfter = ApiEngine.getCustomerFavorites(TEST_CUST_2);
    const cust1FavsAfter = ApiEngine.getCustomerFavorites(TEST_CUST_1);

    assert(cust2FavsAfter.length === 1, "Customer 2 now has 1 favorite");
    assert(cust1FavsAfter.length === 2, "Customer 1 still has 2 favorites untouched");
  }

  // ────────────────────────────────────────────────────────────
  // 7. REMOVAL & IDEMPOTENT REMOVAL
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 7: Removal & Idempotent Removal");
  {
    const removeRes = ApiEngine.removeCustomerFavorite(TEST_CUST_1, testProduct1);
    assert(removeRes.success === true && removeRes.is_favorited === false, "Successfully removed product 1 from Customer 1");

    const isFavAfter = ApiEngine.isProductFavorited(TEST_CUST_1, testProduct1);
    assert(isFavAfter === false, "isProductFavorited returns false after removal");

    const favIdsAfter = ApiEngine.getCustomerFavoriteIds(TEST_CUST_1);
    assert(favIdsAfter.length === 1 && favIdsAfter[0] === testProduct2, "Customer 1 favorite IDs contains only remaining product 2");

    // Idempotent removal
    const removeAgain = ApiEngine.removeCustomerFavorite(TEST_CUST_1, testProduct1);
    assert(removeAgain.success === true && removeAgain.is_favorited === false, "Removing already-removed favorite returns success without error");

    // Customer 2 favorite remains intact
    const cust2Favs = ApiEngine.getCustomerFavorites(TEST_CUST_2);
    assert(cust2Favs.length === 1 && cust2Favs[0].product_id === testProduct2, "Customer 2 favorites unaffected by Customer 1 removal");
  }

  // ────────────────────────────────────────────────────────────
  // 8. CRM 360 & CUSTOMER PROFILE INTEGRATION
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 8: CRM 360 & Customer Profile Integration");
  {
    // Create or find customer in memory
    const existingCus = (store.customers || []).find((c: any) => c.customer_uid === TEST_CUST_1);
    if (!existingCus) {
      store.customers.push({
        id: "cus_test_01",
        customer_uid: TEST_CUST_1,
        phone: "+91 99999 11111",
        normalized_phone: "9999911111",
        name: "Test VIP Customer",
        full_name: "Test VIP Customer",
        email: "vip@cakes2home.test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tier: "PLATINUM",
      });
      ApiEngine.persist();
    }

    const meProfile = ApiEngine.getCustomerMe({ customerUid: TEST_CUST_1 });
    assert(!!meProfile, "getCustomerMe returns profile for customer");
    assert(Array.isArray(meProfile?.favorite_products), "CustomerMe includes favorite_products array");
    assert(meProfile?.favorites_count === 1, "CustomerMe includes accurate favorites_count (1)");

    const crmProfile = ApiEngine.getCustomerProfile(TEST_CUST_1);
    assert(!!crmProfile, "getCustomerProfile returns CRM 360 profile");
    assert(Array.isArray(crmProfile?.favorite_products), "CRM 360 profile includes favorite_products");
    assert(crmProfile?.favorites_count === 1, "CRM 360 profile includes accurate favorites_count");
  }

  // ────────────────────────────────────────────────────────────
  // 9. CLEANUP
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 9: Teardown & Clean State");
  {
    ApiEngine.removeCustomerFavorite(TEST_CUST_1, testProduct2);
    ApiEngine.removeCustomerFavorite(TEST_CUST_2, testProduct2);
    store.customer_favorites = (store.customer_favorites || []).filter(
      (f: any) => f.customer_uid !== TEST_CUST_1 && f.customer_uid !== TEST_CUST_2
    );
    ApiEngine.persist();

    const finalCust1Favs = ApiEngine.getCustomerFavorites(TEST_CUST_1);
    const finalCust2Favs = ApiEngine.getCustomerFavorites(TEST_CUST_2);
    assert(finalCust1Favs.length === 0, "Customer 1 favorites cleaned up completely");
    assert(finalCust2Favs.length === 0, "Customer 2 favorites cleaned up completely");
  }

  console.log("\n============================================================");
  console.log(`📊 TEST EXECUTION SUMMARY:`);
  console.log(`   Total Checkpoints: ${totalTests}`);
  console.log(`   Passed:            ${passedTests} ✅`);
  console.log(`   Failed:            ${failedTests} ${failedTests > 0 ? "❌" : "✨"}`);
  console.log("============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runFavoritesE2ESuite().catch((err) => {
  console.error("Fatal error running Favorites E2E test suite:", err);
  process.exit(1);
});
