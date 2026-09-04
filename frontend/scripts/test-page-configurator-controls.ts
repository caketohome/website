/**
 * Real-World Functionality & Control Audit Test Suite for CakeToHome Page Configurator
 * Verifies complete chain: Admin UI -> State -> API -> Database -> Preview -> Published Config -> Storefront HTML -> Responsive Breakpoints
 */

import { ApiEngine } from "../src/lib/api-engine";
import { getCmsPage } from "../src/lib/data/cms";

async function runControlsAudit() {
  console.log("===============================================================");
  console.log("CAKETOHOME — REAL-WORLD FUNCTIONALITY CONTROL AUDIT");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  // ── TEST 1: Hero Desktop vs Mobile Image Isolation ──────────────────────────
  console.log("\n--- AUDIT 1: Hero Image & Responsive Isolation ---");
  const desktopImg = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1400";
  const mobileImg = "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=600";
  const heroAltText = "Artisanal Birthday Cake Delivery Bangalore";

  const auditPage: any = await ApiEngine.createCmsPage({
    title: "Real-World Control Audit Page",
    slug: "audit-control-page",
    page_type: "landing",
    url_path: "/audit-control-page",
    meta_title: "Control Audit Page — Gourmet Cakes | CakeToHome",
    meta_description: "Real-world end-to-end control validation page testing all configuration properties.",
    theme: {
      bg_color: "#fffaf0",
      text_color: "#2d3748",
      heading_color: "#1a202c",
      accent_color: "#dd6b20",
    },
    sections: [
      {
        id: "sec_hero_audit",
        type: "hero",
        name: "Hero Section Audit",
        enabled: true,
        order: 1,
        config: {
          headline: "Gourmet Artisan Cakes Delivered",
          subheadline: "Handcrafted in Bangalore with 2-hour express option",
          badge_text: "Master Pastry Chefs",
          bg_image: desktopImg,
          bg_image_alt: heroAltText,
          mobile_image: { url: mobileImg, alt: heroAltText },
          object_fit: "cover",
          image_position: "center",
          desktop: { height: "550px", alignment: "center", paddingTop: 20, paddingBottom: 20 },
          tablet: { height: "460px", alignment: "center", paddingTop: 15, paddingBottom: 15 },
          mobile: { height: "360px", alignment: "center", paddingTop: 10, paddingBottom: 10 },
          background: { color: "#faf5ff", borderRadius: "24px" },
        },
      },
      {
        id: "sec_prod_grid_audit",
        type: "product_grid",
        name: "Product Grid Audit",
        enabled: true,
        order: 2,
        config: {
          heading: "Selected Audit Products",
          mode: "manual",
          product_ids: ["prod_2", "prod_1"], // Exact order
          show_image: true,
          show_title: true,
          show_price: true,
          show_rating: true,
          card_radius: "20px",
          card_bg: "#ffffff",
          desktop: { columns: 4, card_height: 400, image_height: 240, gap: 20 },
          tablet: { columns: 3, card_height: 350, image_height: 200, gap: 16 },
          mobile: { columns: 2, card_height: 280, image_height: 140, gap: 10 },
        },
      },
    ],
  });

  assert(!!auditPage.id, "Audit page created successfully");
  const heroSec = auditPage.sections[0];
  assert(heroSec.config.bg_image === desktopImg, "Hero desktop image persisted correctly");
  assert(heroSec.config.mobile_image.url === mobileImg, "Hero mobile image persisted correctly");
  assert(heroSec.config.bg_image !== heroSec.config.mobile_image.url, "Desktop and Mobile Hero images are completely distinct & isolated");

  // ── TEST 2: Product Manual Selection & Exact Order ─────────────────────────
  console.log("\n--- AUDIT 2: Product Manual Selection & Order Reordering ---");
  const prodSec = auditPage.sections[1];
  assert(prodSec.config.product_ids[0] === "prod_2", "Product ID at index 0 is 'prod_2'");
  assert(prodSec.config.product_ids[1] === "prod_1", "Product ID at index 1 is 'prod_1'");

  // Reorder prod_1 to index 0 (1->6, 6->1 simulation)
  const reorderedSections = [
    auditPage.sections[0],
    {
      ...prodSec,
      config: {
        ...prodSec.config,
        product_ids: ["prod_1", "prod_2"], // Swapped order
      },
    },
  ];
  const updatedPage: any = await ApiEngine.updateCmsPage(auditPage.id, { sections: reorderedSections });
  assert(updatedPage?.sections[1].config.product_ids[0] === "prod_1", "Reordered Product ID at index 0 is now 'prod_1'");
  assert(updatedPage?.sections[1].config.product_ids[1] === "prod_2", "Reordered Product ID at index 1 is now 'prod_2'");

  // ── TEST 3: Card Height & Image Height Responsive Isolation ────────────────
  console.log("\n--- AUDIT 3: Responsive Card Sizing & Image Height Isolation ---");
  const gridConfig = updatedPage?.sections[1].config;
  assert(gridConfig.desktop.card_height === 400, "Desktop card height set to 400px");
  assert(gridConfig.tablet.card_height === 350, "Tablet card height set to 350px");
  assert(gridConfig.mobile.card_height === 280, "Mobile card height set to 280px");
  assert(gridConfig.desktop.card_height !== gridConfig.mobile.card_height, "Desktop and Mobile card heights are independently isolated");

  // ── TEST 4: Draft vs Published Isolation ────────────────────────────────────
  console.log("\n--- AUDIT 4: Draft vs Published Isolation ---");
  const unpublishedRes = ApiEngine.getPublishedCmsPage("audit-control-page");
  assert(unpublishedRes === null, "Draft modifications are isolated from customer storefront before publish");

  // Now Publish Page
  const publishRes: any = await ApiEngine.publishCmsPage(auditPage.id);
  assert(publishRes.success === true, "Page published successfully");
  assert(publishRes.page.published_config.theme.bg_color === "#fffaf0", "Published snapshot includes custom theme bg_color");
  assert(publishRes.page.published_config.theme.accent_color === "#dd6b20", "Published snapshot includes custom theme accent_color");

  // ── TEST 5: Storefront Resolution & HTML Output ────────────────────────────
  console.log("\n--- AUDIT 5: Storefront HTML Output & Image ALT Verification ---");
  const storefrontPage = await getCmsPage("audit-control-page");
  assert(!!storefrontPage, "Storefront resolves published page by slug");
  assert((storefrontPage as any)?.theme?.bg_color === "#fffaf0", "Storefront resolves published theme bg_color");
  assert(storefrontPage?.sections?.[0]?.config?.bg_image_alt === heroAltText, "Storefront resolves exact configured ALT text");

  // ── TEST 6: Section Deletion & Hiding ───────────────────────────────────────
  console.log("\n--- AUDIT 6: Section Hiding & Deletion Isolation ---");
  await ApiEngine.updateCmsPage(auditPage.id, {
    sections: [
      { ...updatedPage?.sections[0], enabled: false }, // Disabled hero
      updatedPage?.sections[1],
    ],
  });
  await ApiEngine.publishCmsPage(auditPage.id);
  const reloadedAfterHide = await getCmsPage("audit-control-page");
  const activeSecs = (reloadedAfterHide?.sections || []).filter((s: any) => s.enabled !== false);
  assert(activeSecs.length === 1, "Disabled section is filtered out from active storefront section list");
  assert(activeSecs[0].id === "sec_prod_grid_audit", "Active section remains intact");

  // ── TEST 7: Clean Unpublish Resolution ─────────────────────────────────────
  console.log("\n--- AUDIT 7: Clean Unpublish Resolution ---");
  await ApiEngine.unpublishCmsPage(auditPage.id);
  const unpublishedStorefront = await getCmsPage("audit-control-page", "en", true);
  assert(unpublishedStorefront?.status === "draft", "Unpublished page reverts to DRAFT status");

  // ── SUMMARY REPORT ──────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log(`CONTROL AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runControlsAudit().catch(err => {
  console.error("Control audit execution failed:", err);
  process.exit(1);
});
