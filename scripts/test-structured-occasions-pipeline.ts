import { ApiEngine } from "../frontend/src/lib/api-engine";

async function runStructuredOccasionTests() {
  console.log("=================================================");
  console.log("TESTING STRUCTURED OCCASIONS TAXONOMY & ENGINE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || "Assertion failed"}`);
      failed++;
    }
  }

  try {
    // Test 1: Seed Occasions Listing
    const occasions = ApiEngine.listOccasions();
    assert(
      occasions.length >= 24,
      "Occasion Seed Database",
      `Expected at least 24 seed occasions, got ${occasions.length}`
    );

    const birthdayOcc = ApiEngine.getOccasionBySlug("birthday");
    assert(
      birthdayOcc !== null && birthdayOcc.name === "Birthday" && birthdayOcc.icon === "🎂",
      "Get Occasion by Slug",
      `Expected Birthday occasion with 🎂 icon`
    );

    // Test 2: Migration of Legacy Occasion Strings
    const migResult = ApiEngine.migrateOccasions();
    assert(
      migResult !== null && typeof migResult.migratedProducts === "number",
      "Legacy Occasion Migration",
      `Migration returned ${migResult.migratedProducts} migrated products`
    );

    // Test 3: Product Multi-Select Occasion Assignment
    const testProd = ApiEngine.createAdminProduct({
      title: "Royal Belgian Truffle Milestone Cake",
      name: "Royal Belgian Truffle Milestone Cake",
      price: 899,
      occasion_ids: ["occ_anniversary", "occ_wedding", "occ_valentines_day"],
      primary_category_id: "pcat_chocolate",
      is_bestseller: true,
    });

    assert(
      Array.isArray(testProd.occasion_ids) &&
      testProd.occasion_ids.includes("occ_anniversary") &&
      testProd.occasion_ids.includes("occ_wedding") &&
      testProd.occasion_ids.includes("occ_valentines_day"),
      "Product Multi-Select Occasion Persistence",
      `Product occasion_ids: ${JSON.stringify(testProd.occasion_ids)}`
    );

    // Test 4: Occasion Products Discovery
    const anniversaryProds = ApiEngine.getOccasionProducts("anniversary");
    const hasMilestoneCake = anniversaryProds.some((p: any) => p.id === testProd.id || p.product_id === testProd.id);
    assert(
      hasMilestoneCake,
      "Occasion Products Discovery by Slug",
      `Expected anniversary cake to be found in /occasions/anniversary`
    );

    // Test 5: Category Occasion Mapping
    const testCat = ApiEngine.createPimCategory({
      name: "Romance & Milestone Delights",
      slug: "romance-milestones",
      occasion_ids: ["occ_anniversary", "occ_valentines_day", "occ_engagement"],
    });

    assert(
      Array.isArray(testCat.occasion_ids) && testCat.occasion_ids.includes("occ_engagement"),
      "Category Multi-Select Occasion Mapping",
      `Category occasion_ids: ${JSON.stringify(testCat.occasion_ids)}`
    );

    // Test 6: Smart Cross-Sell Recommendations with Occasion
    const crossSellAccs = ApiEngine.getRecommendedAccessories(testProd.id, "product");
    assert(
      crossSellAccs.length > 0,
      "Smart Cross-Sell Accessories for Occasion Cake",
      `Expected recommendations for anniversary cake, got ${crossSellAccs.length}`
    );

    // Test 7: Smart Upsell & Similar Occasion Products
    const recs = ApiEngine.getRecommendedProducts(testProd.id, "anniversary", { limit: 5 });
    assert(
      Array.isArray(recs.related) && Array.isArray(recs.upsells) && Array.isArray(recs.sameOccasion),
      "Product Upsell & Occasion Recommendations Structure",
      `Recs structure verified`
    );

    // Test 8: Super Admin Occasion CRUD & Soft-Archival
    const customOcc = ApiEngine.createOccasion({
      name: "Silver Jubilee Celebration",
      slug: "silver-jubilee",
      icon: "🥈",
      description: "25th wedding anniversary and silver jubilee milestone parties",
    });

    assert(
      customOcc.id.includes("silver_jubilee") || customOcc.id.startsWith("occ_"),
      "Admin Create Custom Occasion",
      `Created occasion ID: ${customOcc.id}`
    );

    const updatedOcc = ApiEngine.updateOccasion(customOcc.id, {
      description: "Updated description for 25th celebration",
    });
    assert(
      updatedOcc?.description === "Updated description for 25th celebration",
      "Admin Update Occasion",
      `Updated description mismatch`
    );

    const archiveRes = ApiEngine.archiveOccasion(customOcc.id);
    assert(
      archiveRes.success === true,
      "Admin Soft-Archive Occasion",
      `Failed to soft-archive occasion`
    );

    const restoreRes = ApiEngine.restoreOccasion(customOcc.id);
    assert(
      restoreRes.success === true,
      "Admin Restore Occasion",
      `Failed to restore occasion`
    );

  } catch (err: any) {
    console.error("Test execution threw error:", err);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStructuredOccasionTests();
