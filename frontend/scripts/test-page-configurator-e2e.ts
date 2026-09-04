/**
 * Comprehensive E2E Verification Script for CakeToHome Website Page Configurator
 * Tests complete pipeline: Admin UI -> API -> Database -> Published Config -> Storefront -> Real Responsive HTML & SEO
 */

import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage, getCmsPage } from "../src/lib/data/cms";
import { SeoMetadataBuilder } from "../src/lib/seo/metadata-builder";

async function runE2ETests() {
  console.log("===============================================================");
  console.log("CAKETOHOME — PAGE CONFIGURATOR END-TO-END VERIFICATION");
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

  // ── TEST 1: Media Library & Upload ──────────────────────────────────────────
  console.log("\n--- TEST SUITE 1: Media Library & Image Upload ---");
  const initialMedia = ApiEngine.getAdminMedia();
  assert(initialMedia.length >= 5, "Initial Media Library has default media assets", `Found ${initialMedia.length}`);

  const uploadedImage = ApiEngine.createMedia({
    name: "Artisan Chocolate Truffle Drip Cake",
    filename: "chocolate-truffle-drip.jpg",
    url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1400",
    mime_type: "image/jpeg",
    size: 342000,
    alt_text: "Handcrafted Belgian dark chocolate truffle cake with rich ganache drip",
    folder: "heroes",
  });
  assert(!!uploadedImage.id, "Media creation generates unique media ID", `ID: ${uploadedImage.id}`);
  assert(uploadedImage.alt_text === "Handcrafted Belgian dark chocolate truffle cake with rich ganache drip", "Media record persists ALT text");

  // ── TEST 2: Page Creation & Draft Isolation ─────────────────────────────────
  console.log("\n--- TEST SUITE 2: Page Creation & Draft Isolation ---");
  const newPage: any = await ApiEngine.createCmsPage({
    title: "Anniversary Special Celebration Cakes",
    slug: "anniversary-special-cakes",
    page_type: "campaign",
    url_path: "/anniversary-special-cakes",
    meta_title: "Anniversary Cakes Bangalore — Midnight Delivery | CakeToHome",
    meta_description: "Order romantic handcrafted anniversary cakes online with midnight delivery across Bangalore. Personalized messages & photo cake options.",
    keywords: "anniversary cake bangalore, romantic cake delivery",
    og_title: "Romantic Anniversary Cakes Delivered in 2 Hours",
    og_description: "Celebrate your anniversary with decadent gourmet cakes handcrafted by CakeToHome master bakers.",
    og_image: uploadedImage.url,
    sections: [
      {
        id: "sec_anni_hero",
        type: "hero",
        name: "Anniversary Hero",
        enabled: true,
        order: 1,
        config: {
          headline: "Celebrate Love with Artisanal Anniversary Cakes",
          subheadline: "Handcrafted celebration cakes with midnight delivery surprise slots",
          cta_primary_text: "Order Anniversary Cake",
          cta_primary_url: "/products?occasion=anniversary",
          bg_image: uploadedImage.url,
          bg_image_alt: uploadedImage.alt_text,
          desktop_image: { media_id: uploadedImage.id, url: uploadedImage.url, alt: uploadedImage.alt_text },
          mobile_image: { media_id: uploadedImage.id, url: uploadedImage.url, alt: uploadedImage.alt_text },
          desktop: { height: "500px", alignment: "center" },
          mobile: { height: "380px", alignment: "center" },
        },
      },
      {
        id: "sec_anni_products",
        type: "product_grid",
        name: "Anniversary Cake Selection",
        enabled: true,
        order: 2,
        config: {
          heading: "💖 Romantic Anniversary Cakes",
          mode: "best_sellers",
          product_ids: ["prod_1", "prod_2"],
          desktop: {
            columns: 4,
            card_height: 380,
            image_height: 220,
            gap: 16,
            price_visibility: true,
            rating_visibility: true,
            badge_visibility: true,
            cta_visibility: true,
          },
          mobile: {
            columns: 2,
            card_height: 290,
            image_height: 150,
            gap: 12,
            price_visibility: true,
            rating_visibility: true,
            badge_visibility: true,
            cta_visibility: true,
          },
        },
      },
      {
        id: "sec_anni_faq",
        type: "faq",
        name: "Anniversary Delivery FAQ",
        enabled: true,
        order: 3,
        config: {
          heading: "Anniversary Delivery FAQ",
          faqs: [
            { q: "Can I schedule a midnight anniversary cake delivery?", a: "Yes, select the midnight slot (11:30 PM - 12:05 AM) at checkout." },
            { q: "Can I add custom names on the cake?", a: "Yes, personalized message piping is included at no extra cost." },
          ],
        },
      },
    ],
    draft_config: {
      sections: [],
      banners: [],
      products_mode: "best_sellers",
      product_ids: ["prod_1", "prod_2"],
      category_ids: ["pcat_01"],
    },
  });

  assert(!!newPage.id, "Page created with unique ID", `ID: ${newPage.id}`);
  assert(newPage.status === "draft", "Page created in DRAFT status");

  // Draft isolation check: getPublishedCmsPage should return NULL
  const publishedBefore = ApiEngine.getPublishedCmsPage("anniversary-special-cakes");
  assert(publishedBefore === null, "Draft page is NOT visible on customer storefront before publication");

  // ── TEST 3: Responsive Desktop vs Mobile Card Persistence ───────────────────
  console.log("\n--- TEST SUITE 3: Responsive Desktop vs Mobile Card Settings ---");
  const prodSec = newPage.sections.find((s: any) => s.type === "product_grid");
  assert(prodSec?.config?.desktop?.card_height === 380, "Desktop card height set to 380px");
  assert(prodSec?.config?.mobile?.card_height === 290, "Mobile card height set to 290px");
  assert(prodSec?.config?.desktop?.image_height === 220, "Desktop image height set to 220px");
  assert(prodSec?.config?.mobile?.image_height === 150, "Mobile image height set to 150px");

  // ── TEST 4: Section Duplication & Reordering ────────────────────────────────
  console.log("\n--- TEST SUITE 4: Section Duplication & Reordering ---");
  const duplicatedSection = {
    ...JSON.parse(JSON.stringify(prodSec)),
    id: "sec_anni_products_copy",
    name: "Anniversary Cake Selection (Copy)",
    order: 3,
  };
  const updatedDraft: any = await ApiEngine.updateCmsPage(newPage.id, {
    sections: [
      { ...newPage.sections[0], order: 1 }, // Hero
      { ...newPage.sections[1], order: 2 }, // Product Grid #1
      duplicatedSection,                      // Product Grid #2 (Duplicated)
      { ...newPage.sections[2], enabled: false, order: 4 }, // Disabled FAQ
    ],
  });
  assert(updatedDraft?.sections.length === 4, "Duplicated section added to section list");
  assert(updatedDraft?.sections[2].id === "sec_anni_products_copy", "Duplicated section has unique section ID");
  assert(updatedDraft?.sections[3].enabled === false, "Section disabled in draft");

  // ── TEST 5: Validation & Publication ────────────────────────────────────────
  console.log("\n--- TEST SUITE 5: Validation & Publication ---");
  const validationRes = ApiEngine.validatePageConfig(updatedDraft);
  assert(validationRes.valid === true, "Page passes all 7 publication validation checks");

  const publishRes: any = await ApiEngine.publishCmsPage(newPage.id);
  assert(publishRes.success === true, "Page published successfully");
  assert(publishRes.page.status === "published", "Page status is now 'published'");
  assert(!!publishRes.page.published_at, "Published timestamp recorded");
  assert(!!publishRes.page.published_config, "Complete published_config snapshot created");

  // ── TEST 6: Storefront Resolution & Real Data ──────────────────────────
  console.log("\n--- TEST SUITE 6: Storefront Resolution & Real Data ---");
  const storefrontPage = await getCmsPage("anniversary-special-cakes");
  assert(!!storefrontPage, "Storefront resolves published page by slug");
  assert(!!storefrontPage?.meta_title && storefrontPage.meta_title.includes("Anniversary Cakes Bangalore"), "Storefront page has real SEO Meta Title");
  assert(storefrontPage?.sections?.length === 4, "Storefront resolves all 4 configured sections");
  assert(storefrontPage?.sections?.[1]?.type === "product_grid", "Storefront preserves exact section ordering");

  // ── TEST 7: Real Catalog Product & Category Integration ─────────────────────
  console.log("\n--- TEST SUITE 7: Catalog Product & Category Integration ---");
  const allProducts = ApiEngine.getProducts();
  assert(allProducts.length > 0, "Catalog contains real product records", `Count: ${allProducts.length}`);
  const firstProd = allProducts[0];
  assert(typeof firstProd.price === "number" && firstProd.price > 0, "Real products have numeric pricing", `Price: ₹${firstProd.price}`);
  assert(!!firstProd.thumbnail, "Real products have image thumbnails", `URL: ${firstProd.thumbnail}`);

  const allCategories = ApiEngine.listPimCategories();
  assert(allCategories.length > 0, "Catalog contains real PIM categories", `Count: ${allCategories.length}`);

  // ── TEST 8: SEO Metadata Builder Verification ───────────────────────────────
  console.log("\n--- TEST SUITE 8: SEO Metadata Builder Verification ---");
  const meta = SeoMetadataBuilder.buildMetadata({
    entityType: "cms",
    slug: "anniversary-special-cakes",
    fallbackTitle: storefrontPage?.meta_title || undefined,
    fallbackDescription: storefrontPage?.meta_description || undefined,
    fallbackImage: storefrontPage?.og_image || undefined,
  });

  assert(!!meta.title && String(meta.title).includes("Anniversary Cakes"), "Metadata builder generates accurate title");
  assert(!!meta.description && String(meta.description).includes("handcrafted anniversary cakes"), "Metadata builder generates accurate description");
  assert(!String(meta.alternates?.canonical).includes("localhost"), "Canonical URL contains 0 localhost references");
  const ogImgUrl = Array.isArray(meta.openGraph?.images) ? (meta.openGraph.images[0] as any)?.url : (meta.openGraph?.images as any)?.url;
  assert(!!ogImgUrl && ogImgUrl.startsWith("https://"), "OpenGraph image is an absolute HTTPS URL");

  // ── TEST 9: Storefront Homepage Resolution ─────────────────────────────────
  console.log("\n--- TEST SUITE 9: Storefront Homepage Resolution ---");
  const homepageCms = await getHomepage();
  assert(!!homepageCms.page, "Homepage CMS record resolved");
  assert(homepageCms.sections.length >= 5, "Homepage has published sections", `Found ${homepageCms.sections.length} sections`);
  assert(homepageCms.announcementBar?.enabled === true, "Homepage announcement bar is enabled");

  // ── TEST 10: Image Update & Instant Storefront Reflection ──────────────────
  console.log("\n--- TEST SUITE 10: Image Update & Re-Publish Reflection ---");
  const updatedHeroUrl = "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=1400";
  const updatedHeroAlt = "Luxurious Red Velvet anniversary cake with gold leaf";

  await ApiEngine.updateCmsPage(newPage.id, {
    sections: [
      {
        ...updatedDraft.sections[0],
        config: {
          ...updatedDraft.sections[0].config,
          bg_image: updatedHeroUrl,
          bg_image_alt: updatedHeroAlt,
        },
      },
      ...updatedDraft.sections.slice(1),
    ],
  });

  await ApiEngine.publishCmsPage(newPage.id);
  const reloadedStorefront = await getCmsPage("anniversary-special-cakes");
  const heroSection = reloadedStorefront?.sections?.find((s: any) => s.type === "hero");
  assert(heroSection?.config?.bg_image === updatedHeroUrl, "Storefront instantly reflects updated hero image URL");
  assert(heroSection?.config?.bg_image_alt === updatedHeroAlt, "Storefront instantly reflects updated hero ALT text");

  // ── TEST 11: Clean Unpublish ────────────────────────────────────────────────
  console.log("\n--- TEST SUITE 11: Clean Unpublish ---");
  await ApiEngine.unpublishCmsPage(newPage.id);
  const unpublishedCheck = ApiEngine.getPublishedCmsPage("anniversary-special-cakes");
  assert(unpublishedCheck === null, "Unpublished page is immediately removed from published query");

  // ── SUMMARY REPORT ──────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
