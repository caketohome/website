/**
 * CakeToHome CMS Page Builder — PostgreSQL Persistence Cycle Test
 * 
 * Verifies real database persistence according to Master Spec:
 * Create page -> add sections (Hero, Product Grid, Category Grid, FAQ, CTA, Delivery, Scroll Story Animation)
 * -> configure -> save -> query PostgreSQL -> verify -> fresh connection -> reload
 * -> update -> verify -> duplicate -> verify -> reorder -> verify -> delete -> cleanup
 */

import { dbQuery } from "../src/lib/db";
import { persistCmsPageToDb, deleteCmsPageFromDb } from "../src/lib/db-persistence";
import { CmsRepository } from "../src/lib/repositories/cms.repository";
import { getDefaultConfig } from "../src/lib/cms/section-registry";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPersistenceTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME CMS PAGE BUILDER — POSTGRESQL PERSISTENCE TEST (LIVE DATABASE)");
  console.log("================================================================================\n");

  const testSlug = `test-page-${Date.now()}`;
  const testId = `cmspg_${Date.now()}`;

  const targetSectionTypes = [
    "hero",
    "product_grid",
    "category_grid",
    "faq",
    "cta",
    "location_coverage",
    "kitchen_story",
  ];

  console.log("Step 1: Constructing CMS page with 7 core section types...");
  const initialSections = targetSectionTypes.map((type, idx) => ({
    id: `sec_${type}_${idx}`,
    type,
    name: `Test ${type}`,
    order: idx,
    enabled: true,
    config: {
      ...getDefaultConfig(type),
      test_marker: `initial_${type}`,
    },
  }));

  const testPage = {
    id: testId,
    title: "Automated Persistence Verification Page",
    slug: testSlug,
    type: "landing",
    status: "draft",
    meta_title: "Persistence Test Meta Title",
    meta_description: "Automated test page description",
    canonical_url: `https://caketohome.com/${testSlug}`,
    og_image: "",
    sections: initialSections,
    draft_config: { version: 1, last_edited: "test_runner" },
    published_config: null,
    version_history: [],
  };

  try {
    // Step 2: Save to PostgreSQL
    console.log("\nStep 2: Persisting page to PostgreSQL via persistCmsPageToDb()...");
    await persistCmsPageToDb(testPage);
    console.log("✅ Page persisted to PostgreSQL.");

    // Step 3: Direct SQL Query Verification
    console.log("\nStep 3: Querying PostgreSQL directly via raw SQL...");
    const rawRes = await dbQuery(`SELECT * FROM "cms_page" WHERE "id" = $1 LIMIT 1`, [testId]);
    assert(rawRes.rows.length === 1, "Raw SQL returned exactly 1 record for test page");
    const rawRecord = rawRes.rows[0];
    assert(rawRecord.slug === testSlug, "Raw slug matches expected");
    const rawBlocks = typeof rawRecord.blocks === "string" ? JSON.parse(rawRecord.blocks) : rawRecord.blocks;
    assert(rawBlocks.sections.length === 7, `Raw SQL record contains 7 sections (got ${rawBlocks.sections.length})`);

    // Step 4: Fresh Query via CmsRepository (simulating server restart / fresh session)
    console.log("\nStep 4: Reloading page via CmsRepository.findPageBySlug()...");
    const loadedPage = await CmsRepository.findPageBySlug(testSlug);
    assert(loadedPage !== null, "CmsRepository loaded page successfully");
    assert(loadedPage?.id === testId, "Loaded page ID matches");
    assert(loadedPage?.sections.length === 7, "Loaded page has all 7 sections");

    // Verify all 7 section types exist and configs are intact
    for (const type of targetSectionTypes) {
      const sec = loadedPage?.sections.find((s: any) => s.type === type);
      assert(!!sec, `Section '${type}' restored intact`);
      assert(sec.config.test_marker === `initial_${type}`, `Section '${type}' config preserved`);
    }

    // Step 5: Update Section (Modify Hero headline & FAQ items)
    console.log("\nStep 5: Updating sections (Hero headline & FAQ items)...");
    const heroSec = loadedPage!.sections.find((s: any) => s.type === "hero");
    heroSec.config.headline = "Updated Fresh Baked Truffles Bangalore";
    heroSec.config.test_marker = "updated_hero";

    const faqSec = loadedPage!.sections.find((s: any) => s.type === "faq");
    faqSec.config.faqs = [
      { q: "Is midnight delivery available?", a: "Yes, 11:30 PM - 12:05 AM across Bangalore." },
    ];

    await persistCmsPageToDb(loadedPage);
    console.log("✅ Updates persisted to PostgreSQL.");

    // Step 6: Reload and verify update
    console.log("\nStep 6: Reloading from PostgreSQL and verifying updates...");
    const reloadedAfterUpdate = await CmsRepository.findPageBySlug(testSlug);
    const updatedHero = reloadedAfterUpdate?.sections.find((s: any) => s.type === "hero");
    assert(updatedHero.config.headline === "Updated Fresh Baked Truffles Bangalore", "Hero headline update confirmed in DB");
    assert(updatedHero.config.test_marker === "updated_hero", "Hero marker update confirmed in DB");
    const updatedFaq = reloadedAfterUpdate?.sections.find((s: any) => s.type === "faq");
    assert(updatedFaq.config.faqs.length === 1, "FAQ update confirmed in DB");

    // Step 7: Duplicate Section
    console.log("\nStep 7: Duplicating a section (CTA duplicate)...");
    const ctaSec = reloadedAfterUpdate!.sections.find((s: any) => s.type === "cta");
    const duplicatedCta = {
      ...ctaSec,
      id: `sec_cta_dup_${Date.now()}`,
      name: `${ctaSec.name} (Copy)`,
      order: reloadedAfterUpdate!.sections.length,
    };
    reloadedAfterUpdate!.sections.push(duplicatedCta);
    await persistCmsPageToDb(reloadedAfterUpdate);

    const reloadedAfterDup = await CmsRepository.findPageBySlug(testSlug);
    assert(reloadedAfterDup?.sections.length === 8, `Duplication verified (8 sections in DB, got ${reloadedAfterDup?.sections.length})`);

    // Step 8: Reorder Sections (Move CTA duplicate to index 0)
    console.log("\nStep 8: Reordering sections...");
    const sectionsToReorder = [...reloadedAfterDup!.sections];
    const lastSec = sectionsToReorder.pop()!;
    sectionsToReorder.unshift(lastSec);
    sectionsToReorder.forEach((s, idx) => { s.order = idx; });
    reloadedAfterDup!.sections = sectionsToReorder;
    await persistCmsPageToDb(reloadedAfterDup);

    const reloadedAfterReorder = await CmsRepository.findPageBySlug(testSlug);
    assert(reloadedAfterReorder?.sections[0].id === duplicatedCta.id, "Reordering verified: duplicated CTA is at index 0 in DB");

    // Step 9: Delete Section (Remove duplicated CTA)
    console.log("\nStep 9: Deleting duplicated section...");
    reloadedAfterReorder!.sections = reloadedAfterReorder!.sections.filter((s: any) => s.id !== duplicatedCta.id);
    await persistCmsPageToDb(reloadedAfterReorder);

    const reloadedAfterDelete = await CmsRepository.findPageBySlug(testSlug);
    assert(reloadedAfterDelete?.sections.length === 7, `Delete verified (7 sections remaining in DB, got ${reloadedAfterDelete?.sections.length})`);

    // Step 10: Clean up test page from PostgreSQL
    console.log("\nStep 10: Cleaning up test page record from PostgreSQL...");
    await dbQuery(`DELETE FROM "cms_page" WHERE "id" = $1`, [testId]);
    const finalCheck = await dbQuery(`SELECT * FROM "cms_page" WHERE "id" = $1`, [testId]);
    assert(finalCheck.rows.length === 0, "Test record cleaned up successfully from database");

    console.log("\n================================================================================");
    console.log("🎉 ALL POSTGRESQL PERSISTENCE CYCLE TESTS PASSED WITH 100% SUCCESS");
    console.log("================================================================================");
  } catch (err) {
    console.error("Persistence test failed with error:", err);
    // Cleanup on failure
    await dbQuery(`DELETE FROM "cms_page" WHERE "id" = $1`, [testId]).catch(() => {});
    process.exit(1);
  } finally {
    // End pool connection
    const { closeDbPool } = await import("../src/lib/db");
    await closeDbPool().catch(() => {});
  }
}

runPersistenceTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
