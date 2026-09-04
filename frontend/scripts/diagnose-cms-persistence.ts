import assert from "assert";
import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage, getCmsPage } from "../src/lib/data/cms";

async function diagnose() {
  console.log("================================================================================");
  console.log("🔍 STEP 1 & 2: CMS PERSISTENCE & CONTRACT DIAGNOSTIC");
  console.log("================================================================================");

  // 1. Read initial state
  const initial = await getHomepage();
  assert(initial.page, "Homepage exists");
  console.log("1. INITIAL STATE:");
  console.log("   • Page ID:", initial.page.id);
  console.log("   • Status:", initial.page.status);
  console.log("   • Existing announcement_bar:", JSON.stringify(initial.page.announcement_bar));
  console.log("   • Existing published announcement_bar:", JSON.stringify(initial.page.published_config?.announcement_bar));

  // 2. Mutate DRAFT with explicit test values
  const testPayload = {
    ...initial.page,
    announcement_bar: {
      enabled: true,
      display_mode: "static" as const,
      text: "CMS_PERSISTENCE_TEST_20260823",
      action_enabled: false,
      bg_color: "#e11d48",
    },
  };

  console.log("\n2. UPDATING DRAFT (ApiEngine.updateCmsPage)...");
  const updatedDraft: any = await ApiEngine.updateCmsPage(initial.page.id, testPayload);
  console.log("   • Returned Draft ID:", updatedDraft.id);
  console.log("   • Returned Draft announcement_bar.text:", updatedDraft.announcement_bar?.text);
  console.log("   • Returned Draft announcement_bar.action_enabled:", updatedDraft.announcement_bar?.action_enabled);
  console.log("   • Returned Draft announcement_bar.display_mode:", updatedDraft.announcement_bar?.display_mode);

  // Assert draft updated
  assert.strictEqual(updatedDraft.announcement_bar?.text, "CMS_PERSISTENCE_TEST_20260823", "Draft text persisted");
  assert.strictEqual(updatedDraft.announcement_bar?.action_enabled, false, "Draft action_enabled is false");
  assert.strictEqual(updatedDraft.announcement_bar?.display_mode, "static", "Draft display_mode is static");
  console.log("   ✅ Draft assertions PASSED");

  // 3. Verify Direct Read from ApiEngine
  const readBackDraft: any = ApiEngine.getCmsPage(initial.page.id);
  console.log("\n3. READ BACK DRAFT FROM STORAGE (ApiEngine.getCmsPage):");
  console.log("   • Read-back announcement_bar.text:", readBackDraft.announcement_bar?.text);
  console.log("   • Read-back announcement_bar.action_enabled:", readBackDraft.announcement_bar?.action_enabled);
  assert.strictEqual(readBackDraft.announcement_bar?.text, "CMS_PERSISTENCE_TEST_20260823");
  assert.strictEqual(readBackDraft.announcement_bar?.action_enabled, false);
  console.log("   ✅ Storage persistence verified");

  // 4. Publish Page
  console.log("\n4. PUBLISHING PAGE (ApiEngine.publishCmsPage)...");
  const pubResult: any = await ApiEngine.publishCmsPage(initial.page.id);
  console.log("   • Publish success:", pubResult.success);
  assert(pubResult.success, "Publish succeeded");
  console.log("   • Published config announcement_bar.text:", pubResult.page.published_config?.announcement_bar?.text);
  console.log("   • Published config announcement_bar.action_enabled:", pubResult.page.published_config?.announcement_bar?.action_enabled);
  assert.strictEqual(pubResult.page.published_config?.announcement_bar?.text, "CMS_PERSISTENCE_TEST_20260823");
  assert.strictEqual(pubResult.page.published_config?.announcement_bar?.action_enabled, false);
  console.log("   ✅ Published snapshot verified");

  // 5. Read via getHomepage() (Live Storefront Consumer)
  console.log("\n5. READ VIA getHomepage() (Live Storefront Contract):");
  const live = await getHomepage();
  console.log("   • Live announcementBar.text:", live.announcementBar?.text);
  console.log("   • Live announcementBar.action_enabled:", live.announcementBar?.action_enabled);
  console.log("   • Live announcementBar.display_mode:", live.announcementBar?.display_mode);
  assert.strictEqual(live.announcementBar?.text, "CMS_PERSISTENCE_TEST_20260823");
  assert.strictEqual(live.announcementBar?.action_enabled, false);
  assert.strictEqual(live.announcementBar?.display_mode, "static");
  console.log("   ✅ getHomepage() returns exact published snapshot");

  console.log("\n================================================================================");
  console.log("🎉 ALL PERSISTENCE TESTS PASSED");
  console.log("================================================================================");
}

diagnose().catch((err) => {
  console.error("❌ DIAGNOSTIC FAILED:", err);
  process.exit(1);
});
