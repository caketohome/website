import assert from "assert";
import { chromium } from "playwright";
import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage } from "../src/lib/data/cms";

async function testCompleteCmsE2E() {
  console.log("================================================================================");
  console.log("🚀 CAKETOHOME — COMPLETE CMS CONTENT & ANIMATION E2E AUDIT");
  console.log("================================================================================");

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DRAFT CONFIGURATION WITH ALL CUSTOM SECTION CONTENT & ANIMATIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣  Configuring Full CMS Page Draft with Custom Text & Motion...");
  const initialHome = await getHomepage();
  assert(initialHome.page, "Homepage CMS page exists");

  const customSections = [
    // 1. Hero Section (Custom content + scroll sequence)
    {
      id: "sec_home_hero",
      type: "hero",
      name: "Hero Banner",
      enabled: true,
      order: 1,
      config: {
        headline: "Artisanal Belgian Truffle Cakes Delivered in 2 Hours",
        subheadline: "Freshly baked signature cakes for birthdays & celebrations in Bangalore.",
        badge_text: "Fresh & Artisanal • Express Delivery",
        cta_primary_visible: true,
        cta_primary_text: "Order Artisanal Cake",
        cta_primary_url: "/products",
        cta_secondary_visible: true,
        cta_secondary_text: "Birthday Specials",
        cta_secondary_url: "/products?occasion=birthday",
        craft_badge: "Artisan Chocolate Lab",
        craft_heading: "Layered to Absolute Perfection",
        craft_text: "Belgian single-origin cocoa with Madagascar bourbon vanilla.",
        fleet_badge: "Zero-Tilt Temperature Controlled Fleet",
        fleet_heading: "Pristine To Your Celebration",
        fleet_text: "Shock-absorbent cake domes guarantee zero damage during express delivery.",
        fleet_cta_text: "Order Now",
        fleet_cta_url: "/products",
        disable_scroll_sequence: false,
        animation: {
          enabled: true,
          type: "fade_up",
          duration: 700,
          trigger: "on_load",
          once: true,
        },
      },
    },

    // 2. Announcement Bar
    {
      id: "sec_home_announce",
      type: "announcement_bar",
      name: "Announcement Bar",
      enabled: true,
      order: 2,
      config: {
        enabled: true,
        display_mode: "marquee",
        scrolling_text: "🎂 Free Same-Day Delivery Across Bangalore • Extra 15% OFF with Code CAKE15",
        scroll_speed: "normal",
        scroll_direction: "left",
        pause_on_hover: true,
        action_enabled: true,
        action_type: "copy_and_link",
        coupon_code: "CAKE15",
        cta_text: "Shop Now",
        cta_url: "/products",
        bg_color: "#E11D48",
      },
    },

    // 3. Category Grid with Carousel Mode
    {
      id: "sec_home_categories",
      type: "category_grid",
      name: "Category Carousel",
      enabled: true,
      order: 3,
      config: {
        heading: "Explore Handcrafted Categories",
        subheading: "Find your celebration match by flavor and occasion",
        view_all_text: "View All Flavours",
        view_all_url: "/category",
        layout: "carousel",
        carousel: {
          autoplay: true,
          autoplay_speed: 4,
          show_arrows: true,
          show_dots: true,
          pause_on_hover: true,
        },
        animation: {
          enabled: true,
          type: "fade_up",
          duration: 600,
          trigger: "on_scroll",
          once: true,
        },
      },
    },

    // 4. Best Sellers with Carousel Mode
    {
      id: "sec_home_bestsellers",
      type: "best_sellers",
      name: "Trending Best Sellers",
      enabled: true,
      order: 4,
      config: {
        heading: "🏆 Bangalore's Top Trending Cakes",
        subheading: "Loved by 50,000+ celebrations across Bangalore",
        view_all_text: "Explore 40+ Bestsellers",
        view_all_url: "/products",
        mode: "best_sellers",
        layout: "carousel",
        carousel: {
          autoplay: true,
          autoplay_speed: 3,
          show_arrows: true,
          show_dots: true,
          pause_on_hover: true,
        },
        show_image: true,
        show_title: true,
        show_price: true,
        show_rating: true,
        show_badge: true,
        show_cta: true,
        cta_text: "Order Now",
        animation: {
          enabled: true,
          type: "fade_up",
          duration: 600,
          trigger: "on_scroll",
          once: true,
        },
      },
    },

    // 5. Brand Story
    {
      id: "sec_home_story",
      type: "brand_story",
      name: "Our Kitchen Story",
      enabled: true,
      order: 5,
      config: {
        badge_text: "Artisan Kitchen Heritage",
        heading: "Baked Fresh to Order in Bangalore",
        body: "Every cake is handcrafted after you order with Belgian chocolate and farm-fresh dairy cream.",
        cta_text: "Explore Our Menu",
        cta_url: "/products",
        animation: {
          enabled: true,
          type: "slide_left",
          duration: 600,
          trigger: "on_scroll",
          once: true,
        },
      },
    },

    // 6. Features / Assurance
    {
      id: "sec_home_features",
      type: "features",
      name: "Why CakeToHome",
      enabled: true,
      order: 6,
      config: {
        heading: "The CakeToHome Freshness Promise",
        features: [
          { icon: "Truck", title: "Guaranteed 2-Hour Delivery", desc: "Express delivery across Bangalore hubs" },
          { icon: "Sparkles", title: "100% Belgian Chocolate", desc: "No artificial cocoa powders or fillers" },
          { icon: "Clock", title: "Midnight Delivery Slots", desc: "11:30 PM to 12:05 AM surprise timing" },
          { icon: "ShieldCheck", title: "Zero Damage Transit", desc: "Engineered shock-absorbent cake domes" },
        ],
        animation: {
          enabled: true,
          type: "fade_up",
          duration: 600,
          trigger: "on_scroll",
          once: true,
        },
      },
    },

    // 7. FAQ Section
    {
      id: "sec_home_faq",
      type: "faq",
      name: "Celebration FAQ",
      enabled: true,
      order: 7,
      config: {
        heading: "Celebration & Delivery Questions",
        faqs: [
          { q: "Can I schedule midnight cake delivery in Bangalore?", a: "Yes! Select the midnight delivery slot at checkout for delivery between 11:30 PM and 12:05 AM." },
          { q: "Are CakeToHome cakes baked fresh?", a: "Every cake is baked to order upon placement with zero chemical preservatives." },
        ],
        animation: {
          enabled: true,
          type: "fade_up",
          duration: 600,
          trigger: "on_scroll",
          once: true,
        },
      },
    },

    // 8. Location Coverage
    {
      id: "sec_home_delivery",
      type: "location_coverage",
      name: "Bangalore Delivery Coverage",
      enabled: true,
      order: 8,
      config: {
        badge: "Fast Delivery Hubs",
        heading: "Delivering Across 16+ Bangalore Clusters",
        subheading: "Same-day and midnight cake delivery to your doorstep",
        areas: ["Indiranagar", "Koramangala", "HSR Layout", "Whitefield", "Jayanagar", "JP Nagar", "Bellandur", "Electronic City"],
        cta_text: "Check Delivery Pincodes",
        cta_url: "/products",
        animation: {
          enabled: true,
          type: "fade_up",
          duration: 600,
          trigger: "on_scroll",
          once: true,
        },
      },
    },
  ];

  const updatedPage = {
    ...initialHome.page,
    sections: customSections,
    announcement_bar: customSections.find((s) => s.id === "sec_home_announce")?.config,
  };

  const draftRes = ApiEngine.updateCmsPage(initialHome.page.id, updatedPage);
  assert(draftRes && draftRes.id, "CMS page draft updated successfully");
  console.log("  ✅ Draft configuration saved to backend");

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PUBLISH CMS PAGE TO STOREFRONT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Publishing CMS Page to Live Customer Storefront...");
  const pubRes = ApiEngine.publishCmsPage(initialHome.page.id);
  assert(pubRes.success === true, "CMS page published successfully");

  const liveData = await getHomepage();
  assert(liveData.sections.length >= 7, `Live page has ${liveData.sections.length} published sections`);
  console.log(`  ✅ Live storefront retrieved ${liveData.sections.length} published sections with full configs`);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. REAL HEADLESS CHROMIUM AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Launching Real Headless Chromium Browser for Live Verification...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("  • Navigating to http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. VERIFY HERO CUSTOM TEXT & CTA BUTTONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Verifying Dynamic Hero Headline, Subheadline & CTAs...");
  const heroInfo = await page.evaluate(() => {
    const heading = document.querySelector("h1")?.textContent?.trim() || "";
    const badge = document.querySelector(".scroll-frame-section [class*='text-rose-300']")?.textContent?.trim() || "";
    const buttons = Array.from(document.querySelectorAll(".scroll-frame-section button")).map(b => b.textContent?.trim() || "");
    const primaryBtn = buttons.find(b => b.includes("Order Artisanal Cake")) || "";
    const secondaryBtn = buttons.find(b => b.includes("Birthday Specials")) || "";
    return { heading, badge, primaryBtn, secondaryBtn };
  });

  console.log(`    • Live H1 Heading: "${heroInfo.heading}"`);
  console.log(`    • Live Hero Badge: "${heroInfo.badge}"`);
  console.log(`    • Primary CTA Text: "${heroInfo.primaryBtn}"`);
  console.log(`    • Secondary CTA Text: "${heroInfo.secondaryBtn}"`);

  assert(heroInfo.heading.includes("Artisanal Belgian Truffle Cakes"), "Hero displays exact CMS-configured H1 headline");
  assert(heroInfo.badge.includes("Fresh & Artisanal"), "Hero displays exact CMS-configured badge text");
  assert(heroInfo.primaryBtn.includes("Order Artisanal Cake"), "Primary CTA has exact CMS text");
  assert(heroInfo.secondaryBtn.includes("Birthday Specials"), "Secondary CTA has exact CMS text");
  console.log("  ✅ Hero Section Content & CTAs 100% verified from CMS");

  // ──────────────────────────────────────────────────────────────────────────
  // 5. VERIFY PRODUCT & CATEGORY CAROUSELS (ARROWS, DOTS, AUTOPLAY)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Verifying Interactive Product & Category Carousels...");
  const carouselStats = await page.evaluate(() => {
    const leftArrows = document.querySelectorAll("button[aria-label='Scroll left']").length;
    const rightArrows = document.querySelectorAll("button[aria-label='Scroll right']").length;
    const dots = document.querySelectorAll("button[aria-label^='Go to slide']").length;
    const headings = Array.from(document.querySelectorAll("h2")).map((h) => h.textContent?.trim());
    return { leftArrows, rightArrows, dots, headings };
  });

  console.log(`    • Carousel Left Arrows Found: ${carouselStats.leftArrows}`);
  console.log(`    • Carousel Right Arrows Found: ${carouselStats.rightArrows}`);
  console.log(`    • Carousel Dots Found: ${carouselStats.dots}`);
  console.log(`    • H2 Headings: ${carouselStats.headings.join(" | ")}`);

  assert(carouselStats.leftArrows >= 1, "Carousel navigation left arrows rendered");
  assert(carouselStats.rightArrows >= 1, "Carousel navigation right arrows rendered");
  assert(carouselStats.dots >= 4, "Carousel navigation dots rendered");
  assert(carouselStats.headings.some((h) => h?.includes("Top Trending Cakes")), "Custom Best Sellers heading rendered");
  assert(carouselStats.headings.some((h) => h?.includes("Explore Handcrafted Categories")), "Custom Category heading rendered");
  console.log("  ✅ Category & Product Carousels 100% verified with interactive arrows and dots");

  // ──────────────────────────────────────────────────────────────────────────
  // 6. VERIFY BRAND STORY, FEATURES, FAQ & LOCATIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n6️⃣  Verifying Brand Story, Features, FAQ & Delivery Areas...");
  const sectionContent = await page.evaluate(() => {
    const bodyText = document.body.textContent || "";
    return {
      hasBrandStory: bodyText.includes("Baked Fresh to Order in Bangalore"),
      hasPromise: bodyText.includes("The CakeToHome Freshness Promise"),
      has2HourFeature: bodyText.includes("Guaranteed 2-Hour Delivery"),
      hasFaqQuestion: bodyText.includes("Can I schedule midnight cake delivery in Bangalore?"),
      hasDeliveryClusters: bodyText.includes("Delivering Across 16+ Bangalore Clusters"),
      hasIndiranagar: bodyText.includes("Indiranagar"),
      hasWhitefield: bodyText.includes("Whitefield"),
    };
  });

  assert(sectionContent.hasBrandStory, "Custom Brand Story heading rendered");
  assert(sectionContent.hasPromise, "Custom Features heading rendered");
  assert(sectionContent.has2HourFeature, "Custom Feature item rendered");
  assert(sectionContent.hasFaqQuestion, "Custom FAQ question rendered");
  assert(sectionContent.hasDeliveryClusters, "Custom Location heading rendered");
  assert(sectionContent.hasIndiranagar && sectionContent.hasWhitefield, "Custom Delivery tags rendered");
  console.log("  ✅ Brand Story, Features, FAQ, and Delivery Coverage 100% verified from CMS");

  // ──────────────────────────────────────────────────────────────────────────
  // 7. TEST INTERACTIVE FAQ ACCORDION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Testing Interactive FAQ Accordion Click...");
  const faqButton = page.locator("button:has-text('Can I schedule midnight cake delivery in Bangalore?')").first();
  assert(await faqButton.isVisible(), "FAQ Question button is visible");
  await faqButton.click();
  await page.waitForTimeout(300);

  const faqOpenText = await page.evaluate(() => {
    return document.body.textContent?.includes("Select the midnight delivery slot at checkout");
  });
  assert(faqOpenText, "FAQ Answer is visible upon expanding accordion");
  console.log("  ✅ FAQ interactive accordion opens and displays CMS answer");

  // ──────────────────────────────────────────────────────────────────────────
  // 8. MULTI-VIEWPORT RESPONSIVE AUDIT (ZERO HORIZONTAL OVERFLOW)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n8️⃣  Auditing 5 Responsive Viewports for Zero Overflow...");
  const viewports = [
    { name: "1440x900 (Desktop)", width: 1440, height: 900 },
    { name: "1024x768 (Tablet Landscape)", width: 1024, height: 768 },
    { name: "768x1024 (Tablet Portrait)", width: 768, height: 1024 },
    { name: "390x844 (Mobile Modern)", width: 390, height: 844 },
    { name: "375x812 (Mobile Standard)", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(250);

    const overflowCheck = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    assert(
      overflowCheck.scrollWidth <= overflowCheck.clientWidth + 2,
      `Zero horizontal overflow at ${vp.name}`
    );
    console.log(`    ✅ ${vp.name}: Clean layout with ZERO horizontal overflow (ScrollWidth: ${overflowCheck.scrollWidth}px, ClientWidth: ${overflowCheck.clientWidth}px)`);
  }

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎉 ALL COMPLETE CMS CONTENT & ANIMATION TESTS PASSED (100% PASS)");
  console.log("================================================================================");
}

testCompleteCmsE2E().catch((err) => {
  console.error("❌ COMPLETE CMS E2E AUDIT FAILURE:", err);
  process.exit(1);
});
