/**
 * CakeToHome - PIM Single Option Source of Truth E2E Test Suite
 *
 * Verifies:
 * 1. Zero-Option Rule: When PIM has 0 of 5 flavors or 0 of 4 shapes selected,
 *    storefront options API returns empty arrays and disabled selection flags.
 *    Zero fallback to product.flavour or global masters.
 * 2. Explicit Option Mapping: When PIM maps specific flavors/shapes, only those
 *    mapped options are returned with their configured price modifiers.
 * 3. Master Catalog Isolation: Global master variant options are never leaked to
 *    the customer storefront without an explicit product mapping.
 * 4. PIM Toggle Rules: When show_flavour or show_shape is false, options are suppressed.
 * 5. Cross-Product Isolation: Options on Product A never leak to Product B.
 * 6. Checkout Validation & Option Security: validateCheckout rejects unmapped or disabled options.
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
  }
}

async function runTests() {
  console.log("\n=======================================================================");
  console.log("  CAKETOHOME: PIM SINGLE OPTION SOURCE OF TRUTH E2E SUITE");
  console.log("=======================================================================\n");

  const targetProdId = "prod_2"; // Classic Red Velvet Cream Cheese Cake
  const otherProdId = "prod_3";  // Fresh Alphonso Mango Mousse Cake

  // ── PHASE 1: ZERO-OPTION RULE (0 of 5 Selected in PIM) ───────────────────
  console.log("▶ Phase 1: Zero-Option PIM State Enforcement");

  // Save 0 flavors and 0 shapes for prod_2
  const saveFlvRes0 = ApiEngine.saveProductFlavorMappings(targetProdId, []);
  const saveShpRes0 = ApiEngine.saveProductShapeMappings(targetProdId, []);

  assert(saveFlvRes0.success === true, "saveProductFlavorMappings succeeds with empty mappings array");
  assert(saveShpRes0.success === true, "saveProductShapeMappings succeeds with empty mappings array");

  // Query product mappings directly
  const mappedFlavors0 = ApiEngine.getProductFlavorMappings(targetProdId);
  const mappedShapes0 = ApiEngine.getProductShapeMappings(targetProdId);

  assert(Array.isArray(mappedFlavors0) && mappedFlavors0.length === 0, "getProductFlavorMappings returns empty array for 0 selections");
  assert(Array.isArray(mappedShapes0) && mappedShapes0.length === 0, "getProductShapeMappings returns empty array for 0 selections");

  // Query customer storefront options API for prod_2
  const storefrontOptions0 = ApiEngine.getStorefrontProductOptions(targetProdId);

  assert(storefrontOptions0.flavors.length === 0, "Storefront options flavors is empty when 0 selected in PIM");
  assert(storefrontOptions0.enable_flavor_selection === false, "Storefront enable_flavor_selection is false when 0 selected in PIM");
  assert(storefrontOptions0.shapes.length === 0, "Storefront options shapes is empty when 0 selected in PIM");
  assert(storefrontOptions0.enable_shape_selection === false, "Storefront enable_shape_selection is false when 0 selected in PIM");
  assert(storefrontOptions0.fillings.length === 0, "Storefront options fillings is empty when not configured");
  assert(storefrontOptions0.creams.length === 0, "Storefront options creams is empty when not configured");

  // Verify it did NOT leak product.flavour ("Red Velvet")
  const leakedFlavour = storefrontOptions0.flavors.some((f: any) => f.name === "Red Velvet" || f.name === "Belgian Dark Chocolate");
  assert(!leakedFlavour, "Zero leakage of product.flavour or Belgian Dark Chocolate when 0 flavors mapped");

  // Verify it did NOT leak default Round or 2-Tier Designer shapes
  const leakedShape = storefrontOptions0.shapes.some((s: any) => s.name === "Round" || s.name === "2-Tier Designer");
  assert(!leakedShape, "Zero leakage of global shapes when 0 shapes mapped");

  // ── PHASE 2: EXPLICIT SINGLE & MULTI OPTION SELECTION ───────────────────
  console.log("\n▶ Phase 2: Explicit Product-Scoped Option Selection & Price Modifiers");

  // Map 1 specific flavor: "Red Velvet Supreme"
  const flvMapping1 = [
    { flavor_id: "flv_rv_01", name: "Red Velvet Supreme", display_name: "Red Velvet Supreme", price_override: 50 },
  ];
  ApiEngine.saveProductFlavorMappings(targetProdId, flvMapping1);

  const storefrontOptions1 = ApiEngine.getStorefrontProductOptions(targetProdId);
  assert(storefrontOptions1.flavors.length === 1, "Storefront returns exactly 1 flavor when 1 mapped in PIM");
  assert(storefrontOptions1.flavors[0].name === "Red Velvet Supreme", "Mapped flavor name matches PIM selection exactly");
  assert(storefrontOptions1.flavors[0].price_modifier === 50, "Mapped flavor price modifier matches PIM override (+₹50)");
  assert(storefrontOptions1.enable_flavor_selection === true, "enable_flavor_selection is true when 1+ flavors mapped");

  // Map 2 specific shapes: "Round" (+₹0) and "Heart" (+₹150)
  const shpMapping2 = [
    { shape_id: "opt_s_01", name: "Round", display_name: "Round", price_override: 0 },
    { shape_id: "opt_s_02", name: "Heart", display_name: "Heart", price_override: 150 },
  ];
  ApiEngine.saveProductShapeMappings(targetProdId, shpMapping2);

  const storefrontOptions2 = ApiEngine.getStorefrontProductOptions(targetProdId);
  assert(storefrontOptions2.shapes.length === 2, "Storefront returns exactly 2 shapes when 2 mapped in PIM");
  assert(storefrontOptions2.shapes[0].name === "Round" && storefrontOptions2.shapes[0].price_modifier === 0, "Shape 1 is Round with ₹0 surcharge");
  assert(storefrontOptions2.shapes[1].name === "Heart" && storefrontOptions2.shapes[1].price_modifier === 150, "Shape 2 is Heart with ₹150 surcharge");
  assert(!storefrontOptions2.shapes.some((s: any) => s.name === "Square"), "Unmapped shape 'Square' is NOT visible");
  assert(!storefrontOptions2.shapes.some((s: any) => s.name === "2-Tier Designer"), "Unmapped shape '2-Tier Designer' is NOT visible");

  // ── PHASE 3: PIM DISPLAY TOGGLE RULES ────────────────────────────────────
  console.log("\n▶ Phase 3: PIM Display Rules (Show/Hide Toggle Suppresses Customer Options)");

  // Disable show_shape via PIM config
  ApiEngine.updateAdminProductPimConfig(targetProdId, { show_shape: false });

  const storefrontOptionsDisabledShape = ApiEngine.getStorefrontProductOptions(targetProdId);
  assert(storefrontOptionsDisabledShape.enable_shape_selection === false, "enable_shape_selection is false when PIM show_shape is false");
  assert(storefrontOptionsDisabledShape.shapes.length === 0, "shapes array is empty when PIM show_shape is false");

  // Re-enable show_shape
  ApiEngine.updateAdminProductPimConfig(targetProdId, { show_shape: true });

  // ── PHASE 4: CROSS-PRODUCT OPTION ISOLATION ──────────────────────────────
  console.log("\n▶ Phase 4: Cross-Product Option Isolation");

  // Map otherProdId (Mango Cake) with Mango Royale flavor and Square shape only
  ApiEngine.saveProductFlavorMappings(otherProdId, [
    { flavor_id: "flv_mango_01", name: "Alphonso Mango Royale", price_override: 0 },
  ]);
  ApiEngine.saveProductShapeMappings(otherProdId, [
    { shape_id: "opt_s_03", name: "Square", price_override: 200 },
  ]);

  const prod2Options = ApiEngine.getStorefrontProductOptions(targetProdId);
  const prod3Options = ApiEngine.getStorefrontProductOptions(otherProdId);

  assert(!prod2Options.flavors.some((f: any) => f.name === "Alphonso Mango Royale"), "Product 2 does not have Product 3's Mango flavor");
  assert(prod3Options.flavors.some((f: any) => f.name === "Alphonso Mango Royale"), "Product 3 has its own Mango flavor");
  assert(!prod2Options.shapes.some((s: any) => s.name === "Square"), "Product 2 does not have Product 3's Square shape");
  assert(prod3Options.shapes.some((s: any) => s.name === "Square"), "Product 3 has its Square shape");

  // ── PHASE 5: CHECKOUT INTEGRITY & UNAUTHORIZED OPTION REJECTION ──────────
  console.log("\n▶ Phase 5: Checkout Backend Authorization & Option Rejection");

  // Attempt checkout of prod_2 with unauthorized shape "Square" (prod_2 only has Round and Heart)
  const cartWithUnauthorizedShape = {
    cart_id: "cart_opt_test_01",
    items: [
      {
        id: "item_opt_01",
        product_id: targetProdId,
        title: "Classic Red Velvet Cream Cheese Cake",
        quantity: 1,
        unit_price: 749,
        shape: "Square", // UNAUTHORIZED for prod_2
        flavour: "Red Velvet Supreme",
      },
    ],
  };

  const checkoutValidationUnauthorized = ApiEngine.validateCheckout({
    cart_id: "cart_opt_test_01",
    items: cartWithUnauthorizedShape.items,
    pincode: "560038",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_morning",
    delivery_type: "delivery",
  });

  assert(
    checkoutValidationUnauthorized.errors.some((e: any) => e.code === "INVALID_SHAPE_OPTION"),
    "validateCheckout rejects unauthorized shape with INVALID_SHAPE_OPTION error"
  );

  // Attempt checkout with unauthorized flavor
  const cartWithUnauthorizedFlavor = {
    cart_id: "cart_opt_test_02",
    items: [
      {
        id: "item_opt_02",
        product_id: targetProdId,
        title: "Classic Red Velvet Cream Cheese Cake",
        quantity: 1,
        unit_price: 749,
        shape: "Heart", // Valid
        flavour: "Black Forest Special", // UNAUTHORIZED for prod_2
      },
    ],
  };

  const checkoutValidationUnauthorizedFlavor = ApiEngine.validateCheckout({
    cart_id: "cart_opt_test_02",
    items: cartWithUnauthorizedFlavor.items,
    pincode: "560038",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_morning",
    delivery_type: "delivery",
  });

  assert(
    checkoutValidationUnauthorizedFlavor.errors.some((e: any) => e.code === "INVALID_FLAVOR_OPTION"),
    "validateCheckout rejects unauthorized flavor with INVALID_FLAVOR_OPTION error"
  );

  // Attempt checkout with authorized options (Heart + Red Velvet Supreme)
  const cartWithAuthorizedOptions = {
    cart_id: "cart_opt_test_03",
    items: [
      {
        id: "item_opt_03",
        product_id: targetProdId,
        title: "Classic Red Velvet Cream Cheese Cake",
        quantity: 1,
        unit_price: 749,
        shape: "Heart",
        flavour: "Red Velvet Supreme",
      },
    ],
  };

  const checkoutValidationAuthorized = ApiEngine.validateCheckout({
    cart_id: "cart_opt_test_03",
    items: cartWithAuthorizedOptions.items,
    pincode: "560038",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_morning",
    delivery_type: "delivery",
  });

  const hasShapeOrFlvError = checkoutValidationAuthorized.errors.some(
    (e: any) => e.code === "INVALID_SHAPE_OPTION" || e.code === "INVALID_FLAVOR_OPTION"
  );
  assert(!hasShapeOrFlvError, "validateCheckout allows valid, mapped product options without errors");

  // ── TEST SUMMARY ─────────────────────────────────────────────────────────
  console.log("\n=======================================================================");
  console.log(`  E2E TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=======================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
