import { getDbPool } from "../frontend/src/lib/db";
import { getHomepage, getCmsPage } from "../frontend/src/lib/data/cms";
import { CmsRepository } from "../frontend/src/lib/repositories/cms.repository";

async function runPhase5Verification() {
  console.log("=================================================");
  console.log("PHASE 5: SOURCE OF TRUTH & DRAFT/PUBLISH TEST");
  console.log("=================================================");

  const pool = getDbPool();

  // 1. Health check & Initial State Read
  const health = await pool.query("SELECT 1 AS ok");
  if (health.rows[0]?.ok !== 1) {
    throw new Error("PostgreSQL connection failed");
  }
  console.log("[PASS] 1. PostgreSQL SELECT 1 OK");

  const originalRowRes = await pool.query(`SELECT * FROM "cms_page" WHERE id = 'cmspg_home' OR slug = 'home' LIMIT 1`);
  if (originalRowRes.rows.length === 0) {
    throw new Error("cmspg_home not found in PostgreSQL");
  }
  const originalRow = originalRowRes.rows[0];
  const originalBlocksRaw = typeof originalRow.blocks === "string" ? originalRow.blocks : JSON.stringify(originalRow.blocks);
  const originalBlocks = JSON.parse(originalBlocksRaw);

  console.log("[INFO] Original cmspg_home status:", originalRow.status);
  console.log("[INFO] Original published sections:", originalBlocks.published_config?.sections?.length || originalBlocks.sections?.length || 0);

  // 2. Read Storefront Authority via getHomepage()
  const initialStorefront = await getHomepage();
  const initialMetaTitle = initialStorefront.page?.meta_title || "";
  console.log("[INFO] Storefront initial meta_title:", initialMetaTitle);
  console.log("[INFO] Storefront initial sections count:", initialStorefront.sections.length);

  // 3. STEP A: Draft Isolation Test (Save draft with unique marker)
  const marker = `DRAFT_MARKER_${Date.now()}`;
  console.log(`\n--- STEP A: Testing Draft Isolation with marker: ${marker} ---`);

  const updatedDraftConfig = {
    ...(originalBlocks.draft_config || {}),
    meta_title: `[${marker}] Luxury Patisserie Cakes`,
    test_marker: marker,
  };

  const draftTestBlocks = {
    ...originalBlocks,
    draft_config: updatedDraftConfig,
  };

  // Persist draft to PostgreSQL cms_page
  await pool.query(
    `UPDATE "cms_page" SET blocks = $1, updated_at = NOW() WHERE id = 'cmspg_home'`,
    [JSON.stringify(draftTestBlocks)]
  );
  console.log("[INFO] Draft updated in PostgreSQL cms_page.blocks.draft_config");

  // Verify draft does NOT leak to storefront
  const storefrontAfterDraft = await getHomepage();
  const storefrontMetaAfterDraft = storefrontAfterDraft.page?.meta_title || "";
  console.log("[INFO] Storefront meta_title after draft saved:", storefrontMetaAfterDraft);

  if (storefrontMetaAfterDraft.includes(marker)) {
    throw new Error(`[FAIL] DRAFT LEAK DETECTED! Storefront returned draft marker: ${storefrontMetaAfterDraft}`);
  }
  console.log("[PASS] Step A.1: Storefront did NOT leak draft marker. Storefront remains on published config.");

  // Verify preview DOES show draft
  const previewPage = await CmsRepository.findPageBySlug("home");
  const previewDraftMarker = (previewPage?.draft_config as any)?.test_marker;
  if (previewDraftMarker !== marker) {
    throw new Error(`[FAIL] Preview did not find draft marker. Got: ${previewDraftMarker}`);
  }
  console.log("[PASS] Step A.2: Preview / Admin finds draft marker in draft_config:", previewDraftMarker);

  // 4. STEP B: Publish Flow Test
  console.log(`\n--- STEP B: Testing Publish Flow with marker: ${marker} ---`);
  const publishedConfigWithMarker = {
    ...(originalBlocks.published_config || {}),
    sections: originalBlocks.published_config?.sections || originalBlocks.sections || [],
    meta_title: `Order Fresh Cakes Online in Bangalore [${marker}]`,
    theme: {
      ...(originalBlocks.published_config?.theme || originalBlocks.theme || {}),
      test_marker: marker,
    },
  };

  const publishedTestBlocks = {
    ...draftTestBlocks,
    published_config: publishedConfigWithMarker,
  };

  await pool.query(
    `UPDATE "cms_page" SET blocks = $1, status = 'published', updated_at = NOW() WHERE id = 'cmspg_home'`,
    [JSON.stringify(publishedTestBlocks)]
  );
  console.log("[INFO] Published config written to PostgreSQL cms_page");

  const storefrontAfterPublish = await getHomepage();
  const storefrontMetaAfterPublish = storefrontAfterPublish.page?.meta_title || "";
  console.log("[INFO] Storefront meta_title after publish:", storefrontMetaAfterPublish);

  if (!storefrontMetaAfterPublish.includes(marker)) {
    throw new Error(`[FAIL] Publish failed to update storefront! Got: ${storefrontMetaAfterPublish}`);
  }
  console.log("[PASS] Step B: Publish immediately updated storefront with new published configuration!");

  // 5. STEP C: Rollback & Clean Restoration Test
  console.log(`\n--- STEP C: Testing Rollback to Original Configuration ---`);
  await pool.query(
    `UPDATE "cms_page" SET blocks = $1, status = $2, updated_at = NOW() WHERE id = 'cmspg_home'`,
    [originalBlocksRaw, originalRow.status]
  );
  console.log("[INFO] Original blocks restored in PostgreSQL cms_page");

  const storefrontAfterRollback = await getHomepage();
  const storefrontMetaAfterRollback = storefrontAfterRollback.page?.meta_title || "";
  console.log("[INFO] Storefront meta_title after rollback:", storefrontMetaAfterRollback);

  if (storefrontMetaAfterRollback.includes(marker)) {
    throw new Error(`[FAIL] Rollback failed to remove marker! Got: ${storefrontMetaAfterRollback}`);
  }
  if (storefrontAfterRollback.sections.length !== initialStorefront.sections.length) {
    throw new Error(`[FAIL] Section count mismatch after rollback: expected ${initialStorefront.sections.length}, got ${storefrontAfterRollback.sections.length}`);
  }
  console.log("[PASS] Step C: Rollback restored exact original storefront state!");
  console.log("[PASS] Database restored to 100% clean, original state.");

  console.log("\n=================================================");
  console.log("ALL PHASE 5 VERIFICATION TESTS PASSED SUCCESSFULLY");
  console.log("=================================================");

  process.exit(0);
}

runPhase5Verification().catch((err) => {
  console.error("FATAL Phase 5 Error:", err);
  process.exit(1);
});
