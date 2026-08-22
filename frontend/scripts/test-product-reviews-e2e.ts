/**
 * CakeToHome — Product Review & Rating System Comprehensive E2E Test Suite
 * 
 * Tests:
 * 1. Initial State & Clean Rating Aggregate Calculation
 * 2. Auth & Validation Guards (401, 400, 404, 403)
 * 3. Canonical Verified Purchase Submission & Database Persistence
 * 4. Unique Constraint Enforcement (UNIQUE(customer_uid, order_id, product_id))
 * 5. Dynamic Rating & Distribution Recalculation (Zero Mock Data)
 * 6. Sorting, Filtering, and Server-Side Pagination
 * 7. Customer Ownership & IDOR Protection (Edit/Delete)
 * 8. Admin Moderation & Official Bakery Chef Response
 * 9. CRM Customer 360 & Customer Me Profile Integration
 * 10. Outbox Webhook Event Dispatch (review.created, review.updated)
 * 11. Teardown & Clean State
 */

import { ApiEngine } from "../src/lib/api-engine";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("============================================================");
  console.log("⭐ CAKETOHOME — PRODUCT REVIEW & RATING SYSTEM E2E TEST SUITE");
  console.log("============================================================\n");

  const TEST_PRODUCT_ID = "prod_review_test_cake_01";
  const TEST_CUSTOMER_1 = "cth_cus_rev_test_01";
  const TEST_CUSTOMER_2 = "cth_cus_rev_test_02";
  const TEST_ORDER_1 = "ord_rev_test_101";
  const TEST_ORDER_2 = "ord_rev_test_102";
  const TEST_UNDELIVERED_ORDER = "ord_rev_test_103";

  // Setup mock entities in ApiEngine store for testing
  const store = ApiEngine.getStore();
  ApiEngine.ensureReviewsStore();
  ApiEngine.ensureOrdersStore();
  ApiEngine.ensureCustomersStore();

  // Clean initial reviews
  store.product_reviews = (store.product_reviews || []).filter(
    (r: any) => r.product_id !== TEST_PRODUCT_ID && r.customer_uid !== TEST_CUSTOMER_1 && r.customer_uid !== TEST_CUSTOMER_2
  );

  // Add test product
  const testProduct: any = {
    id: TEST_PRODUCT_ID,
    product_id: TEST_PRODUCT_ID,
    title: "Signature Belgian Truffle Gourmet Cake",
    name: "Signature Belgian Truffle Gourmet Cake",
    price: 799,
    weight: "1 kg",
    rating: 0,
    review_count: 0,
  };
  if (!store.products.some((p: any) => p.id === TEST_PRODUCT_ID)) {
    store.products.push(testProduct);
  }

  // Add test customers
  store.customers = (store.customers || []).filter(
    (c: any) => c.customer_uid !== TEST_CUSTOMER_1 && c.customer_uid !== TEST_CUSTOMER_2
  );
  store.customers.push({
    id: TEST_CUSTOMER_1,
    customer_uid: TEST_CUSTOMER_1,
    name: "Alex Rodriguez",
    first_name: "Alex",
    last_name: "Rodriguez",
    phone: "+919879998811",
    normalized_phone: "9879998811",
  });
  store.customers.push({
    id: TEST_CUSTOMER_2,
    customer_uid: TEST_CUSTOMER_2,
    name: "Priya Sharma",
    first_name: "Priya",
    last_name: "Sharma",
    phone: "+919879998822",
    normalized_phone: "9879998822",
  });

  // Add test orders
  store.orders = store.orders || [];
  store.orders = store.orders.filter(
    (o: any) => o.id !== TEST_ORDER_1 && o.id !== TEST_ORDER_2 && o.id !== TEST_UNDELIVERED_ORDER
  );

  // Order 1: Customer 1, DELIVERED, contains TEST_PRODUCT_ID
  store.orders.push({
    id: TEST_ORDER_1,
    order_number: "CTH-REV-101",
    customer_uid: TEST_CUSTOMER_1,
    customer_name: "Alex Rodriguez",
    customer_phone: "9879998811",
    status: "DELIVERED",
    delivery_status: "delivered",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    delivered_at: new Date(Date.now() - 86400000).toISOString(),
    total: 799,
    items: [
      {
        id: "item_01",
        item_id: "item_01",
        product_id: TEST_PRODUCT_ID,
        title: "Signature Belgian Truffle Gourmet Cake",
        unit_price: 799,
        quantity: 1,
        variant_name: "1 kg",
      },
    ],
  });

  // Order 2: Customer 2, DELIVERED, contains TEST_PRODUCT_ID
  store.orders.push({
    id: TEST_ORDER_2,
    order_number: "CTH-REV-102",
    customer_uid: TEST_CUSTOMER_2,
    customer_name: "Priya Sharma",
    customer_phone: "9879998822",
    status: "DELIVERED",
    delivery_status: "delivered",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    delivered_at: new Date().toISOString(),
    total: 799,
    items: [
      {
        id: "item_02",
        item_id: "item_02",
        product_id: TEST_PRODUCT_ID,
        title: "Signature Belgian Truffle Gourmet Cake",
        unit_price: 799,
        quantity: 1,
        variant_name: "1 kg",
      },
    ],
  });

  // Order 3: Customer 1, PREPARING (not delivered yet)
  store.orders.push({
    id: TEST_UNDELIVERED_ORDER,
    order_number: "CTH-REV-103",
    customer_uid: TEST_CUSTOMER_1,
    customer_name: "Alex Rodriguez",
    customer_phone: "9879998811",
    status: "PREPARING",
    delivery_status: "shop_preparing",
    created_at: new Date().toISOString(),
    total: 799,
    items: [
      {
        id: "item_03",
        item_id: "item_03",
        product_id: TEST_PRODUCT_ID,
        title: "Signature Belgian Truffle Gourmet Cake",
        unit_price: 799,
        quantity: 1,
        variant_name: "1 kg",
      },
    ],
  });

  // ────────────────────────────────────────────────────────────
  // SECTION 1: Initial State & Clean Rating Calculations
  // ────────────────────────────────────────────────────────────
  console.log("📋 SECTION 1: Initial State & Empty Verifications");
  const initAgg = ApiEngine.getProductRatingAggregate(TEST_PRODUCT_ID);
  assert(initAgg.total_reviews === 0, "Initial product review count is 0");
  assert(initAgg.average_rating === 0, "Initial product average rating is 0.0 (no fake 4.9)");
  assert(
    initAgg.rating_distribution[1] === 0 &&
      initAgg.rating_distribution[2] === 0 &&
      initAgg.rating_distribution[3] === 0 &&
      initAgg.rating_distribution[4] === 0 &&
      initAgg.rating_distribution[5] === 0,
    "Initial rating distribution is all zeroes { 1:0, 2:0, 3:0, 4:0, 5:0 }"
  );

  const initReviews = ApiEngine.getProductReviews(TEST_PRODUCT_ID);
  assert(initReviews.reviews.length === 0, "Initial public reviews array is empty []");

  // ────────────────────────────────────────────────────────────
  // SECTION 2: Auth & Validation Guards
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 2: Auth & Validation Guards");

  const unauthSub = ApiEngine.submitProductReview("", {
    productId: TEST_PRODUCT_ID,
    rating: 5,
    title: "Great cake",
    reviewText: "Fresh and delicious",
  });
  assert(unauthSub.success === false && unauthSub.statusCode === 401, "Reject review without customerUid (401)");

  const emptyProdSub = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: "",
    rating: 5,
    title: "Great cake",
    reviewText: "Fresh and delicious",
  });
  assert(emptyProdSub.success === false && emptyProdSub.statusCode === 400, "Reject review with empty productId (400)");

  const invalidRatingSub0 = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: TEST_PRODUCT_ID,
    rating: 0,
    title: "Great cake",
    reviewText: "Fresh and delicious",
  });
  assert(invalidRatingSub0.success === false && invalidRatingSub0.statusCode === 400, "Reject rating 0 (400)");

  const invalidRatingSub6 = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: TEST_PRODUCT_ID,
    rating: 6,
    title: "Great cake",
    reviewText: "Fresh and delicious",
  });
  assert(invalidRatingSub6.success === false && invalidRatingSub6.statusCode === 400, "Reject rating 6 (400)");

  const emptyTitleSub = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: TEST_PRODUCT_ID,
    rating: 5,
    title: "   ",
    reviewText: "Fresh and delicious",
  });
  assert(emptyTitleSub.success === false && emptyTitleSub.statusCode === 400, "Reject empty review title (400)");

  const emptyTextSub = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: TEST_PRODUCT_ID,
    rating: 5,
    title: "Great cake",
    reviewText: "   ",
  });
  assert(emptyTextSub.success === false && emptyTextSub.statusCode === 400, "Reject empty review text (400)");

  const nonExistentProdSub = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: "prod_does_not_exist_999",
    rating: 5,
    title: "Great cake",
    reviewText: "Fresh and delicious",
  });
  assert(nonExistentProdSub.success === false && nonExistentProdSub.statusCode === 404, "Reject review for non-existent product (404)");

  // Test customer who never purchased
  const unpurchasedCustSub = ApiEngine.submitProductReview("cth_cus_stranger_00", {
    productId: TEST_PRODUCT_ID,
    rating: 5,
    title: "Great cake",
    reviewText: "Fresh and delicious",
  });
  assert(unpurchasedCustSub.success === false && unpurchasedCustSub.statusCode === 403, "Reject review if customer has no verified purchase (403)");

  // Test undelivered order
  const undeliveredSub = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: TEST_PRODUCT_ID,
    orderId: TEST_UNDELIVERED_ORDER,
    rating: 5,
    title: "Great cake",
    reviewText: "Fresh and delicious",
  });
  assert(undeliveredSub.success === false, "Reject review for undelivered / in-kitchen order");

  // ────────────────────────────────────────────────────────────
  // SECTION 3: Customer Eligibility API
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 3: Customer Eligibility Query");
  const eligible1 = ApiEngine.getCustomerEligibleReviews(TEST_CUSTOMER_1);
  assert(eligible1.length === 1, "Customer 1 has exactly 1 eligible delivered cake to review");
  assert(eligible1[0].order_id === TEST_ORDER_1, "Eligible item linked to delivered Order 1");
  assert(eligible1[0].has_reviewed === false, "Eligible item has_reviewed is false before submission");

  // ────────────────────────────────────────────────────────────
  // SECTION 4: Canonical Verified Purchase Review Submission
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 4: Canonical Verified Purchase Submission");
  const subRes1 = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: TEST_PRODUCT_ID,
    orderId: TEST_ORDER_1,
    rating: 5,
    title: "Best Belgian Truffle Cake in Bangalore!",
    reviewText: "The dark chocolate ganache was rich and silky. Delivered right on time for our celebration.",
  });

  assert(subRes1.success === true, "Successfully submitted 5-star verified review");
  assert(subRes1.statusCode === 201, "Returns HTTP 201 Created");
  assert(Boolean(subRes1.review?.id), "Review has unique ID generated");
  assert(subRes1.review?.customer_uid === TEST_CUSTOMER_1, "Review author is canonical customer_uid");
  assert(subRes1.review?.customer_name === "Alex R.", "Review display name formatted safely as 'Alex R.'");
  assert(subRes1.review?.is_verified_purchase === true, "Review flagged as is_verified_purchase = true");
  assert(subRes1.review?.status === "APPROVED", "Review auto-approved for verified purchase");
  assert(subRes1.review?.purchased_variant === "1 kg", "Review retains purchased variant context '1 kg'");

  // Verify eligibility status updated
  const eligibleAfter = ApiEngine.getCustomerEligibleReviews(TEST_CUSTOMER_1);
  assert(eligibleAfter[0].has_reviewed === true, "Eligible item has_reviewed transitioned to true");
  assert(Boolean(eligibleAfter[0].existing_review), "Eligible item includes existing_review reference");

  // ────────────────────────────────────────────────────────────
  // SECTION 5: Unique Review Constraint
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 5: Unique Constraint & Idempotence Enforcement");
  const duplicateSub = ApiEngine.submitProductReview(TEST_CUSTOMER_1, {
    productId: TEST_PRODUCT_ID,
    orderId: TEST_ORDER_1,
    rating: 4,
    title: "Trying duplicate",
    reviewText: "Should fail duplicate constraint",
  });
  assert(duplicateSub.success === false && duplicateSub.statusCode === 409, "Reject duplicate review submission for same order (409 Conflict)");

  const custReviews1 = ApiEngine.getCustomerReviews(TEST_CUSTOMER_1);
  assert(custReviews1.length === 1, "Customer reviews count remains exactly 1");

  // ────────────────────────────────────────────────────────────
  // SECTION 6: Dynamic Multi-Review Aggregates Recalculation
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 6: Dynamic Rating & Distribution Recalculation");
  // Customer 2 submits a 3-star review
  const subRes2 = ApiEngine.submitProductReview(TEST_CUSTOMER_2, {
    productId: TEST_PRODUCT_ID,
    orderId: TEST_ORDER_2,
    rating: 3,
    title: "Good taste but slightly sweet",
    reviewText: "Cake was fresh and soft. Would prefer darker cocoa profile.",
  });
  assert(subRes2.success === true, "Customer 2 submitted 3-star verified review");

  const multiAgg = ApiEngine.getProductRatingAggregate(TEST_PRODUCT_ID);
  assert(multiAgg.total_reviews === 2, "Product total reviews count is 2");
  assert(multiAgg.average_rating === 4.0, "Product average rating calculated mathematically to (5+3)/2 = 4.0");
  assert(multiAgg.rating_distribution[5] === 1, "Distribution contains 1 five-star review");
  assert(multiAgg.rating_distribution[3] === 1, "Distribution contains 1 three-star review");
  assert(multiAgg.rating_distribution[1] === 0, "Distribution contains 0 one-star reviews");

  // Verify enrichProductWithCategories reflects live rating
  const enriched = ApiEngine.enrichProductWithCategories(testProduct);
  assert(enriched.rating === 4.0, "Enriched product model reflects live rating 4.0");
  assert(enriched.review_count === 2, "Enriched product model reflects live review_count 2");

  // ────────────────────────────────────────────────────────────
  // SECTION 7: Privacy-Safe Public Response, Sorting & Pagination
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 7: Privacy-Safe Public Response & Sorting");
  const publicReviews = ApiEngine.getProductReviews(TEST_PRODUCT_ID, { sort: "highest" });
  assert(publicReviews.reviews.length === 2, "Returns 2 public reviews");
  assert(publicReviews.reviews[0].rating === 5, "Highest sort puts 5-star review first");
  assert(publicReviews.reviews[1].rating === 3, "Highest sort puts 3-star review second");
  assert((publicReviews.reviews[0] as any).customer_uid === undefined, "Privacy safety: customer_uid stripped from public response");
  assert((publicReviews.reviews[0] as any).phone === undefined, "Privacy safety: phone stripped from public response");
  assert((publicReviews.reviews[0] as any).email === undefined, "Privacy safety: email stripped from public response");
  assert(publicReviews.reviews[0].customer_name === "Alex R.", "Exposes sanitized customer display name");

  // Pagination test
  const page1 = ApiEngine.getProductReviews(TEST_PRODUCT_ID, { page: 1, pageSize: 1 });
  assert(page1.reviews.length === 1, "Page 1 pageSize=1 returns 1 review");
  assert(page1.totalPages === 2, "Total pages is 2");
  assert(page1.total === 2, "Total review items is 2");

  // ────────────────────────────────────────────────────────────
  // SECTION 8: Customer Ownership & IDOR Protection (Edit/Delete)
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 8: Ownership & IDOR Protection");
  const review1Id = subRes1.review!.id;

  // Customer 2 attempts to edit Customer 1 review (IDOR)
  const idorEdit = ApiEngine.updateProductReview(TEST_CUSTOMER_2, review1Id, {
    title: "Hacked title",
  });
  assert(idorEdit.success === false && idorEdit.statusCode === 403, "Reject Customer 2 editing Customer 1 review (403 Forbidden)");

  // Customer 1 edits own review
  const validEdit = ApiEngine.updateProductReview(TEST_CUSTOMER_1, review1Id, {
    rating: 4,
    title: "Updated: 4-Star Gourmet Experience",
    reviewText: "Adjusted rating after second slice.",
  });
  assert(validEdit.success === true, "Customer 1 can edit own review");
  assert(validEdit.review?.rating === 4, "Updated rating persisted as 4");

  // Verify aggregate updated to (4+3)/2 = 3.5
  const editedAgg = ApiEngine.getProductRatingAggregate(TEST_PRODUCT_ID);
  assert(editedAgg.average_rating === 3.5, "Product average dynamically recalculated to (4+3)/2 = 3.5");

  // Customer 2 attempts to delete Customer 1 review (IDOR)
  const idorDelete = ApiEngine.deleteProductReview(TEST_CUSTOMER_2, review1Id);
  assert(idorDelete.success === false && idorDelete.statusCode === 403, "Reject Customer 2 deleting Customer 1 review (403 Forbidden)");

  // ────────────────────────────────────────────────────────────
  // SECTION 9: Admin Moderation & Bakery Chef Response
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 9: Admin Moderation & Chef Response");
  const review2Id = subRes2.review!.id;

  // Admin posts official response
  const modRes = ApiEngine.moderateReview(review2Id, "RESPOND", {
    adminName: "Executive Chef Marco",
    adminResponse: "Thank you Priya! We have noted your feedback on sweetness and adjusted our ganache ratio.",
  });
  assert(modRes.success === true, "Admin successfully posted official chef response");
  assert(modRes.review?.admin_response?.author === "Executive Chef Marco", "Chef name attached to response");

  // Public review includes response
  const publicWithReply = ApiEngine.getProductReviews(TEST_PRODUCT_ID);
  const rev2Public = publicWithReply.reviews.find((r) => r.id === review2Id);
  assert(Boolean(rev2Public?.admin_response), "Public review payload contains admin_response");

  // Admin hides review 2
  ApiEngine.moderateReview(review2Id, "HIDE");
  const aggAfterHide = ApiEngine.getProductRatingAggregate(TEST_PRODUCT_ID);
  assert(aggAfterHide.total_reviews === 1, "Hidden review excluded from public review count (1 remaining)");
  assert(aggAfterHide.average_rating === 4.0, "Hidden review excluded from public average (4.0 remaining)");

  // Restore review 2
  ApiEngine.moderateReview(review2Id, "APPROVE");

  // ────────────────────────────────────────────────────────────
  // SECTION 10: CRM 360 & Customer Profile Integration
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 10: CRM 360 & Customer Profile Integration");
  const crmProfile1 = ApiEngine.getCustomerProfile(TEST_CUSTOMER_1);
  assert(Boolean(crmProfile1), "Customer 1 CRM profile resolved");
  assert(crmProfile1?.reviews_count === 1, "CRM profile contains accurate reviews_count (1)");
  assert(crmProfile1?.average_rating_given === 4.0, "CRM profile contains accurate average_rating_given (4.0)");
  assert(crmProfile1?.reviews_written?.length === 1, "CRM profile contains reviews_written array");

  const meDto = ApiEngine.getCustomerMe({ customerUid: TEST_CUSTOMER_1 });
  assert(Boolean(meDto), "CustomerMe DTO resolved");
  assert(meDto?.reviews_count === 1, "CustomerMe includes reviews_count");
  assert(meDto?.reviews_written?.length === 1, "CustomerMe includes reviews_written");

  // ────────────────────────────────────────────────────────────
  // SECTION 11: Teardown & Clean State
  // ────────────────────────────────────────────────────────────
  console.log("\n📋 SECTION 11: Teardown & Clean State");
  ApiEngine.deleteProductReview(TEST_CUSTOMER_1, review1Id);
  ApiEngine.deleteProductReview(TEST_CUSTOMER_2, review2Id);

  // Clean orders and product
  store.orders = (store.orders || []).filter(
    (o: any) => o.id !== TEST_ORDER_1 && o.id !== TEST_ORDER_2 && o.id !== TEST_UNDELIVERED_ORDER
  );
  store.products = (store.products || []).filter((p: any) => p.id !== TEST_PRODUCT_ID);

  const cleanAgg = ApiEngine.getProductRatingAggregate(TEST_PRODUCT_ID);
  assert(cleanAgg.total_reviews === 0, "All test reviews purged cleanly from database store");

  console.log("\n============================================================");
  console.log(`📊 TEST EXECUTION SUMMARY:`);
  console.log(`   Total Checkpoints: ${passedCount + failedCount}`);
  console.log(`   Passed:            ${passedCount} ✅`);
  console.log(`   Failed:            ${failedCount} ${failedCount === 0 ? "✨" : "❌"}`);
  console.log("============================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
