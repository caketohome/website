/**
 * CakeToHome — PIM Product Weight Option & Pricing Matrix Master E2E Test Suite
 * Validates:
 * 1. Rapid continuous weight additions (0.5kg, 0.75kg, 1kg, 1.5kg, 2kg, 2.5kg, 3kg, 4kg)
 * 2. Unit normalization ("1000 g" === "1 kg", "750 gm" === "0.75 kg", "2.5kg" === "2.5 kg")
 * 3. Duplicate physical weight prevention
 * 4. Deterministic numerical sorting by grams (500g < 750g < 1000g < 1500g < 2000g < 2500g < 3000g)
 * 5. Immutable row deletion and re-addition
 * 6. Database persistence & synchronization with product base price & variants
 * 7. Storefront product detail & dynamic pricing consumption
 */

import { ApiEngine } from "../src/lib/api-engine";
import {
  parseAndNormalizeWeight,
  sortWeightOptions,
  getNextSuggestedWeight,
  createDefaultWeightMatrix,
  ProductWeightOption,
} from "../src/lib/util/weight-matrix";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runPimWeightMatrixE2ETestSuite() {
  console.log("================================================================================");
  console.log("🚀 STARTING CAKETOHOME PIM WEIGHT & VARIANT MATRIX E2E SUITE");
  console.log("================================================================================\n");

  const testProductId = `prod_pim_matrix_${Date.now()}`;

  // ── TEST GROUP 1: Unit Normalization & Gram Calculation ──
  console.log("TEST GROUP 1: Unit Normalization & Physical Gram Calculation");
  const test1 = parseAndNormalizeWeight("0.75 kg");
  assert(test1.normalized_grams === 750 && test1.weight_unit === "kg", "0.75 kg -> 750 grams");

  const test2 = parseAndNormalizeWeight("750 g");
  assert(test2.normalized_grams === 750 && test2.weight_unit === "g", "750 g -> 750 grams");

  const test3 = parseAndNormalizeWeight("1.5kg");
  assert(test3.normalized_grams === 1500 && test3.weight_name === "1.5 kg", "1.5kg -> 1500 grams normalized");

  const test4 = parseAndNormalizeWeight("1000 gm");
  assert(test4.normalized_grams === 1000 && test4.weight_name === "1 kg", "1000 gm normalized to 1 kg");

  const test5 = parseAndNormalizeWeight("2500 grams");
  assert(test5.normalized_grams === 2500 && test5.weight_name === "2.5 kg", "2500 grams normalized to 2.5 kg");

  // ── TEST GROUP 2: Sequential Standard Ladder Suggestions (Rapid 1-Click Multi-Add) ──
  console.log("\nTEST GROUP 2: Sequential Standard Ladder Suggestions");
  let currentMatrix: Array<{ weight_name: string; normalized_grams: number }> = [];

  const sugg1 = getNextSuggestedWeight(currentMatrix);
  assert(sugg1.name === "0.5 kg", "First suggestion on empty matrix is 0.5 kg");
  currentMatrix.push({ weight_name: sugg1.name, normalized_grams: 500 });

  const sugg2 = getNextSuggestedWeight(currentMatrix);
  assert(sugg2.name === "0.75 kg", "Next suggestion after 0.5 kg is 0.75 kg");
  currentMatrix.push({ weight_name: sugg2.name, normalized_grams: 750 });

  const sugg3 = getNextSuggestedWeight(currentMatrix);
  assert(sugg3.name === "1 kg", "Next suggestion after 0.75 kg is 1 kg");
  currentMatrix.push({ weight_name: sugg3.name, normalized_grams: 1000 });

  const sugg4 = getNextSuggestedWeight(currentMatrix);
  assert(sugg4.name === "1.5 kg", "Next suggestion after 1 kg is 1.5 kg");
  currentMatrix.push({ weight_name: sugg4.name, normalized_grams: 1500 });

  const sugg5 = getNextSuggestedWeight(currentMatrix);
  assert(sugg5.name === "2 kg", "Next suggestion after 1.5 kg is 2 kg");
  currentMatrix.push({ weight_name: sugg5.name, normalized_grams: 2000 });

  const sugg6 = getNextSuggestedWeight(currentMatrix);
  assert(sugg6.name === "2.5 kg", "Next suggestion after 2 kg is 2.5 kg");
  currentMatrix.push({ weight_name: sugg6.name, normalized_grams: 2500 });

  const sugg7 = getNextSuggestedWeight(currentMatrix);
  assert(sugg7.name === "3 kg", "Next suggestion after 2.5 kg is 3 kg");
  currentMatrix.push({ weight_name: sugg7.name, normalized_grams: 3000 });

  // ── TEST GROUP 3: Deterministic Numerical Sorting Invariant ──
  console.log("\nTEST GROUP 3: Deterministic Numerical Sorting");
  const unsortedList = [
    { weight_name: "3 kg", normalized_grams: 3000 },
    { weight_name: "0.5 kg", normalized_grams: 500 },
    { weight_name: "2 kg", normalized_grams: 2000 },
    { weight_name: "0.75 kg", normalized_grams: 750 },
    { weight_name: "1.5 kg", normalized_grams: 1500 },
    { weight_name: "1 kg", normalized_grams: 1000 },
  ];
  const sortedList = sortWeightOptions(unsortedList);
  assert(sortedList[0].weight_name === "0.5 kg", "First item after sort is 0.5 kg");
  assert(sortedList[1].weight_name === "0.75 kg", "Second item after sort is 0.75 kg");
  assert(sortedList[2].weight_name === "1 kg", "Third item after sort is 1 kg");
  assert(sortedList[3].weight_name === "1.5 kg", "Fourth item after sort is 1.5 kg");
  assert(sortedList[4].weight_name === "2 kg", "Fifth item after sort is 2 kg");
  assert(sortedList[5].weight_name === "3 kg", "Sixth item after sort is 3 kg");

  // ── TEST GROUP 4: Product Creation & Weight Matrix Persistence ──
  console.log("\nTEST GROUP 4: Product Creation & Multi-Weight Persistence");
  const createdProd = await ApiEngine.createAdminProduct({
    title: "Artisanal Belgian Black Forest Gateau",
    price: 649,
    selling_price: 649,
    cost_price: 320,
    mrp: 849,
    category: "Chocolate Cakes",
    occasion: "Birthday",
    occasion_ids: ["occ_birthday"],
  });
  const prodId = createdProd.id || createdProd.product_id;
  assert(!!prodId, `Created base product successfully (ID: ${prodId})`);

  // Save 7 distinct weight tiers for this product
  const weightTiersToSave = [
    { weight_name: "0.5 kg", selling_price: 499, mrp: 649, cost_price: 250, prep_time_minutes: 60, is_enabled: true },
    { weight_name: "0.75 kg", selling_price: 599, mrp: 749, cost_price: 300, prep_time_minutes: 60, is_enabled: true },
    { weight_name: "1 kg", selling_price: 749, mrp: 949, cost_price: 375, prep_time_minutes: 60, is_enabled: true },
    { weight_name: "1.5 kg", selling_price: 1099, mrp: 1399, cost_price: 550, prep_time_minutes: 120, is_enabled: true },
    { weight_name: "2 kg", selling_price: 1399, mrp: 1749, cost_price: 700, prep_time_minutes: 120, is_enabled: true },
    { weight_name: "2.5 kg", selling_price: 1699, mrp: 2099, cost_price: 850, prep_time_minutes: 180, is_enabled: true },
    { weight_name: "3 kg", selling_price: 1999, mrp: 2499, cost_price: 1000, prep_time_minutes: 180, is_enabled: true },
  ];

  const savedRecords: any[] = await ApiEngine.saveProductWeightPrices(prodId, weightTiersToSave);
  assert(savedRecords.length === 7, `Saved all 7 weight option tiers (returned ${savedRecords.length})`);

  // Check saved records integrity
  assert(savedRecords[0].weight_name === "0.5 kg" && savedRecords[0].selling_price === 499, "0.5 kg tier has price ₹499");
  assert(savedRecords[6].weight_name === "3 kg" && savedRecords[6].selling_price === 1999, "3 kg tier has price ₹1999");
  assert(savedRecords[0].id.startsWith("wp_"), "Auto-generated stable ID for weight record");

  // ── TEST GROUP 5: Database Query & Base Product Synchronization ──
  console.log("\nTEST GROUP 5: Query & Base Product Synchronization");
  const queriedPrices: any[] = await ApiEngine.getProductWeightPrices(prodId);
  assert(queriedPrices.length === 7, `getProductWeightPrices returns all 7 tiers (returned ${queriedPrices.length})`);

  const enrichedProduct: any = ApiEngine.getProductById(prodId);
  assert(enrichedProduct !== null, "getProductById successfully fetches product");
  assert(enrichedProduct.price === 499, `Product base price synchronized to lowest enabled tier: ₹${enrichedProduct.price}`);
  assert(Array.isArray(enrichedProduct.weight_prices) && enrichedProduct.weight_prices.length === 7, "Product has 7 attached weight_prices");
  assert(Array.isArray(enrichedProduct.weights) && enrichedProduct.weights.length === 7, "Product has 7 attached weight names");

  // ── TEST GROUP 6: Duplicate Prevention on Upsert ──
  console.log("\nTEST GROUP 6: Duplicate Weight Prevention");
  const duplicatePayload = [
    ...weightTiersToSave,
    { weight_name: "1000 g", selling_price: 749, mrp: 949, cost_price: 375 }, // Duplicate of 1 kg
    { weight_name: "500 gm", selling_price: 499, mrp: 649, cost_price: 250 }, // Duplicate of 0.5 kg
  ];
  const deduplicatedSaved: any[] = await ApiEngine.saveProductWeightPrices(prodId, duplicatePayload);
  assert(deduplicatedSaved.length === 7, `Duplicate physical weights (1000g, 500gm) rejected/deduplicated (length = ${deduplicatedSaved.length})`);

  // ── TEST GROUP 7: Row Deletion & Re-Addition Lifecycle ──
  console.log("\nTEST GROUP 7: Row Deletion & Re-Addition Lifecycle");
  // Delete the 0.75 kg row
  const without750 = deduplicatedSaved.filter((wp) => wp.weight_name !== "0.75 kg");
  const savedAfterDelete: any[] = await ApiEngine.saveProductWeightPrices(prodId, without750);
  assert(savedAfterDelete.length === 6, `Deleted 0.75 kg row, 6 rows remaining`);
  assert(!savedAfterDelete.some((wp) => wp.weight_name === "0.75 kg"), "0.75 kg confirmed absent");

  // Re-add 4 kg row
  const with4kg = [
    ...savedAfterDelete,
    { weight_name: "4 kg", selling_price: 2599, mrp: 3199, cost_price: 1300, prep_time_minutes: 240, is_enabled: true },
  ];
  const savedWith4kg: any[] = await ApiEngine.saveProductWeightPrices(prodId, with4kg);
  assert(savedWith4kg.length === 7, `Appended 4 kg tier, count back to 7`);
  assert(savedWith4kg[6].weight_name === "4 kg" && savedWith4kg[6].selling_price === 2599, "4 kg sorted at index 6");

  // ── TEST GROUP 8: Storefront Multi-Variant Price Calculation ──
  console.log("\nTEST GROUP 8: Storefront Multi-Variant Price Calculation");
  const latestProd: any = ApiEngine.getProductById(prodId);
  const tiers = latestProd.weight_prices;

  // Simulate customer selecting 0.5kg
  const selected05 = tiers.find((t: any) => t.weight_name === "0.5 kg");
  assert(selected05.selling_price === 499, "0.5 kg variant selects price ₹499");

  // Simulate customer selecting 2.5kg
  const selected25 = tiers.find((t: any) => t.weight_name === "2.5 kg");
  assert(selected25.selling_price === 1699, "2.5 kg variant selects price ₹1699");

  // Simulate customer selecting 4kg
  const selected4 = tiers.find((t: any) => t.weight_name === "4 kg");
  assert(selected4.selling_price === 2599, "4 kg variant selects price ₹2599");

  console.log("\n================================================================================");
  console.log("🎉 ALL 24 PIM WEIGHT MATRIX & PRICING VERIFICATIONS PASSED (100% SUCCESS)");
  console.log("================================================================================\n");
}

runPimWeightMatrixE2ETestSuite().catch((err) => {
  console.error("FATAL SUITE FAILURE:", err);
  process.exit(1);
});
