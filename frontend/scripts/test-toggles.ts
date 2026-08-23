import assert from "assert";
import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage } from "../src/lib/data/cms";

async function testToggles() {
  console.log("================================================================================");
  console.log("🧪 STEP 11: TARGETED CMS TOGGLE & FIELD PERSISTENCE TESTS");
  console.log("================================================================================");

  const home = await getHomepage();
  assert(home.page, "Homepage exists");
  const pageId = home.page.id;

  // ── TEST A: enabled = false ──
  console.log("\n🅰️  TEST A: announcement_bar.enabled = false");
  let draftA = ApiEngine.updateCmsPage(pageId, {
    ...home.page,
    announcement_bar: { ...home.page.announcement_bar, enabled: false },
  });
  ApiEngine.publishCmsPage(pageId);
  let readA = ApiEngine.getCmsPage(pageId);
  let liveA = await getHomepage();
  console.log("   • Draft enabled:", readA.announcement_bar?.enabled);
  console.log("   • Published config enabled:", readA.published_config?.announcement_bar?.enabled);
  console.log("   • Live getHomepage enabled:", liveA.announcementBar?.enabled);
  assert.strictEqual(readA.announcement_bar?.enabled, false, "Draft enabled is false");
  assert.strictEqual(readA.published_config?.announcement_bar?.enabled, false, "Published enabled is false");
  assert.strictEqual(liveA.announcementBar?.enabled, false, "Live storefront enabled is false");
  console.log("   ✅ TEST A: PASS");

  // ── TEST B: enabled = true ──
  console.log("\n🅱️  TEST B: announcement_bar.enabled = true");
  let draftB = ApiEngine.updateCmsPage(pageId, {
    ...home.page,
    announcement_bar: { ...home.page.announcement_bar, enabled: true },
  });
  ApiEngine.publishCmsPage(pageId);
  let readB = ApiEngine.getCmsPage(pageId);
  let liveB = await getHomepage();
  console.log("   • Draft enabled:", readB.announcement_bar?.enabled);
  console.log("   • Published config enabled:", readB.published_config?.announcement_bar?.enabled);
  console.log("   • Live getHomepage enabled:", liveB.announcementBar?.enabled);
  assert.strictEqual(readB.announcement_bar?.enabled, true, "Draft enabled is true");
  assert.strictEqual(readB.published_config?.announcement_bar?.enabled, true, "Published enabled is true");
  assert.strictEqual(liveB.announcementBar?.enabled, true, "Live storefront enabled is true");
  console.log("   ✅ TEST B: PASS");

  // ── TEST C: action_enabled = false ──
  console.log("\n🅲  TEST C: announcement_bar.action_enabled = false");
  let draftC = ApiEngine.updateCmsPage(pageId, {
    ...home.page,
    announcement_bar: { ...home.page.announcement_bar, enabled: true, action_enabled: false },
  });
  ApiEngine.publishCmsPage(pageId);
  let readC = ApiEngine.getCmsPage(pageId);
  let liveC = await getHomepage();
  console.log("   • Draft action_enabled:", readC.announcement_bar?.action_enabled);
  console.log("   • Published config action_enabled:", readC.published_config?.announcement_bar?.action_enabled);
  console.log("   • Live getHomepage action_enabled:", liveC.announcementBar?.action_enabled);
  assert.strictEqual(readC.announcement_bar?.action_enabled, false, "Draft action_enabled is false");
  assert.strictEqual(readC.published_config?.announcement_bar?.action_enabled, false, "Published action_enabled is false");
  assert.strictEqual(liveC.announcementBar?.action_enabled, false, "Live storefront action_enabled is false");
  console.log("   ✅ TEST C: PASS");

  // ── TEST D: action_enabled = true ──
  console.log("\n🅳  TEST D: announcement_bar.action_enabled = true");
  let draftD = ApiEngine.updateCmsPage(pageId, {
    ...home.page,
    announcement_bar: { ...home.page.announcement_bar, enabled: true, action_enabled: true },
  });
  ApiEngine.publishCmsPage(pageId);
  let readD = ApiEngine.getCmsPage(pageId);
  let liveD = await getHomepage();
  console.log("   • Draft action_enabled:", readD.announcement_bar?.action_enabled);
  console.log("   • Published config action_enabled:", readD.published_config?.announcement_bar?.action_enabled);
  console.log("   • Live getHomepage action_enabled:", liveD.announcementBar?.action_enabled);
  assert.strictEqual(readD.announcement_bar?.action_enabled, true, "Draft action_enabled is true");
  assert.strictEqual(readD.published_config?.announcement_bar?.action_enabled, true, "Published action_enabled is true");
  assert.strictEqual(liveD.announcementBar?.action_enabled, true, "Live storefront action_enabled is true");
  console.log("   ✅ TEST D: PASS");

  // ── TEST E: scrolling_text = 'CMS_SCROLL_TEST_001' ──
  console.log("\n🅴  TEST E: announcement_bar.scrolling_text = 'CMS_SCROLL_TEST_001'");
  let draftE = ApiEngine.updateCmsPage(pageId, {
    ...home.page,
    announcement_bar: {
      ...home.page.announcement_bar,
      enabled: true,
      display_mode: "marquee",
      scrolling_text: "CMS_SCROLL_TEST_001",
    },
  });
  ApiEngine.publishCmsPage(pageId);
  let readE = ApiEngine.getCmsPage(pageId);
  let liveE = await getHomepage();
  console.log("   • Draft scrolling_text:", readE.announcement_bar?.scrolling_text);
  console.log("   • Published config scrolling_text:", readE.published_config?.announcement_bar?.scrolling_text);
  console.log("   • Live getHomepage scrolling_text:", liveE.announcementBar?.scrolling_text);
  assert.strictEqual(readE.announcement_bar?.scrolling_text, "CMS_SCROLL_TEST_001", "Draft scrolling_text matches");
  assert.strictEqual(readE.published_config?.announcement_bar?.scrolling_text, "CMS_SCROLL_TEST_001", "Published scrolling_text matches");
  assert.strictEqual(liveE.announcementBar?.scrolling_text, "CMS_SCROLL_TEST_001", "Live storefront scrolling_text matches");
  console.log("   ✅ TEST E: PASS");

  console.log("\n================================================================================");
  console.log("🎉 ALL 5 TARGETED TOGGLE TESTS PASSED (100% PASS)");
  console.log("================================================================================");
}

testToggles().catch((err) => {
  console.error("❌ TOGGLE TEST FAILED:", err);
  process.exit(1);
});
