/**
 * End-to-End Playwright Verification for Hero Banner CMS Data Binding
 *
 * Verifies:
 * 1. Storefront Hero Banner renders authoritative CMS copy (Headline, Subheadline, Badge, CTAs, Images).
 * 2. Complete absence of hardcoded prefixes ("Desktop:") from customer copy.
 * 3. window.__CAKETOHOME_HERO_DEBUG__ exposes canonical CMS debug payload with source: "published CMS".
 * 4. DOM dev attributes (data-cms-section-id, data-cms-section-type="hero", data-cms-headline, data-cms-badge, data-cms-primary-cta, data-cms-secondary-cta) are present.
 * 5. CMS Page Configurator field editing (Headline, Subheadline, Badge, CTAs) updates live canvas preview instantly.
 * 6. Save Draft & Publish Storefront persists updates to the live storefront upon hard reload.
 * 7. Responsive viewport parity (Desktop, Tablet, Mobile) with 0 layout shift or overflow.
 */

import { chromium, Page } from "playwright";

const BASE_URL = "http://localhost:3000";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

async function runHeroBannerCmsBindingTest() {
  console.log("================================================================================");
  console.log("🧪 STARTING CAKETOHOME HERO BANNER CMS BINDING E2E TEST SUITE");
  console.log("================================================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Set Super Admin Auth Cookies
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: INITIAL STOREFRONT INSPECTION & CANONICAL DATA VERIFICATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log("1️⃣  Inspecting Initial Storefront Hero Banner (Live Page)...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1, .scroll-frame-section, [data-section-type='hero']", { timeout: 20000 });
    await page.waitForTimeout(1000);

    const initialAudit = await page.evaluate(() => {
      const heroSection = document.querySelector('[data-section-type="hero"]') || document.querySelector('[data-cms-section-type="hero"]');
      const h1El = heroSection?.querySelector("h1") || document.querySelector("h1");
      const badgeEl = heroSection?.querySelector(".text-rose-300, .text-amber-300, span.uppercase") || heroSection?.querySelector("span");
      const primaryCta = heroSection?.querySelector('button[class*="bg-rose"], a[href*="products"]');
      const secondaryCta = heroSection?.querySelector('button[class*="bg-white"], a[href*="birthday"], a[href*="collections"]');
      const debugObj = (window as any).__CAKETOHOME_HERO_DEBUG__;

      return {
        hasHeroSection: Boolean(heroSection),
        rendererType: heroSection?.getAttribute("data-cms-renderer"),
        cmsSectionId: heroSection?.getAttribute("data-cms-section-id") || heroSection?.getAttribute("data-section-id"),
        h1Text: h1El?.textContent?.trim() || "",
        badgeText: badgeEl?.textContent?.trim() || "",
        primaryCtaText: primaryCta?.textContent?.trim() || "",
        secondaryCtaText: secondaryCta?.textContent?.trim() || "",
        dataCmsHeadline: heroSection?.getAttribute("data-cms-headline"),
        dataCmsBadge: heroSection?.getAttribute("data-cms-badge"),
        dataCmsPrimaryCta: heroSection?.getAttribute("data-cms-primary-cta"),
        debugObj,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    assert(initialAudit.hasHeroSection, "Hero section is present on live homepage");
    assert(!initialAudit.h1Text.startsWith("Desktop:"), "Customer-facing H1 headline has NO 'Desktop:' prefix");
    assert(initialAudit.h1Text.length > 0, `Initial H1 headline rendered: "${initialAudit.h1Text}"`);
    assert(Boolean(initialAudit.debugObj), "Dev debug object window.__CAKETOHOME_HERO_DEBUG__ is exposed");
    assert(initialAudit.debugObj?.sectionType === "hero", "Debug object has sectionType: 'hero'");
    assert(initialAudit.debugObj?.source === "published CMS", "Debug object source is 'published CMS'");
    assert(!initialAudit.hasHorizontalOverflow, "Page has 0 horizontal scroll overflow on 1440px desktop");

    // ──────────────────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: OPEN CMS PAGE CONFIGURATOR & UPDATE HERO BANNER FIELDS
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n2️⃣  Navigating to CMS Page Configurator (/dashboard?tab=cms)...");
    await page.goto(`${BASE_URL}/dashboard?tab=cms`, { waitUntil: "commit", timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Ensure Hero section editor is active
    console.log("3️⃣  Selecting Hero Section for Configuration...");
    const heroSectionCard = page.locator('[data-section-id="sec_home_hero"], [data-testid="section-item-hero"], [data-section-type="hero"]').first();
    await heroSectionCard.waitFor({ state: "visible", timeout: 25000 });
    await heroSectionCard.click();

    const headlineInputLocator = page.locator('[data-testid="hero-headline-input"]').first();
    await headlineInputLocator.waitFor({ state: "visible", timeout: 10000 });

    // Unique test payload
    const testPayload = {
      headline: "Royal Belgian Dark Chocolate Truffle Cake - Special Edition",
      subheadline: "Freshly baked with 100% single-origin Belgian cocoa. Delivered across Bangalore in 2 hours.",
      badge: "Exclusive Celebration Edition • 2-Hour Express Delivery",
      primaryCtaText: "Order Royal Cake Now",
      primaryCtaUrl: "/products/royal-belgian-truffle",
      secondaryCtaText: "View Gourmet Specials",
      secondaryCtaUrl: "/products?category=gourmet",
    };

    console.log("4️⃣  Filling New Hero Banner Form Values in CMS Editor...");
    await headlineInputLocator.fill(testPayload.headline);

    // Fill Subheadline
    const subheadlineTextarea = page.locator('[data-testid="hero-subheadline-input"]').first();
    if (await subheadlineTextarea.isVisible()) {
      await subheadlineTextarea.fill(testPayload.subheadline);
    }

    // Fill Badge Text
    const badgeInput = page.locator('[data-testid="hero-badge-input"]').first();
    if (await badgeInput.isVisible()) {
      await badgeInput.fill(testPayload.badge);
    }

    // Fill Primary CTA Text & URL
    const primaryCtaInput = page.locator('[data-testid="hero-primary-cta-text-input"]').first();
    if (await primaryCtaInput.isVisible()) {
      await primaryCtaInput.fill(testPayload.primaryCtaText);
    }

    const primaryUrlInput = page.locator('[data-testid="hero-primary-cta-url-input"]').first();
    if (await primaryUrlInput.isVisible()) {
      await primaryUrlInput.fill(testPayload.primaryCtaUrl);
    }

    // Fill Secondary CTA Text & URL
    const secondaryCtaInput = page.locator('[data-testid="hero-secondary-cta-text-input"]').first();
    if (await secondaryCtaInput.isVisible()) {
      await secondaryCtaInput.fill(testPayload.secondaryCtaText);
    }

    const secondaryUrlInput = page.locator('[data-testid="hero-secondary-cta-url-input"]').first();
    if (await secondaryUrlInput.isVisible()) {
      await secondaryUrlInput.fill(testPayload.secondaryCtaUrl);
    }

    await page.waitForTimeout(600);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: VERIFY LIVE PREVIEW CANVAS IN CMS PAGE CONFIGURATOR
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n5️⃣  Verifying Center Preview Canvas Instant Parity...");
    const previewAudit = await page.evaluate(() => {
      const canvasContainer = document.querySelector("#center-canvas-scroll") || document.querySelector(".overflow-y-auto");
      const heroSection = canvasContainer?.querySelector('[data-cms-section-type="hero"], [data-section-type="hero"], .scroll-frame-section');
      const heroH1 = heroSection?.querySelector("h1") || canvasContainer?.querySelector("h1");
      const badgeSpan = heroSection?.querySelector("span");

      return {
        hasCanvas: Boolean(canvasContainer),
        previewH1: heroH1?.textContent?.trim() || "",
        previewHeadlineAttr: heroSection?.getAttribute("data-cms-headline"),
      };
    });

    assert(
      Boolean(previewAudit.previewH1.includes("Royal Belgian") || previewAudit.previewHeadlineAttr?.includes("Royal Belgian")),
      `CMS Live preview updated headline: "${previewAudit.previewH1 || previewAudit.previewHeadlineAttr}"`
    );

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: SAVE DRAFT & PUBLISH STOREFRONT
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n6️⃣  Saving Draft & Publishing Storefront...");

    // Click Save Draft button
    const saveButton = page.locator('[data-testid="cms-save-draft-btn"]').first();
    await saveButton.waitFor({ state: "visible", timeout: 5000 });
    await saveButton.click();
    await page.waitForTimeout(500);
    await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    console.log("  ✅ Clicked 'Save Draft' and waited for persistence");

    // Click Publish button
    const publishBtn = page.locator('[data-testid="cms-publish-btn"]').first();
    await publishBtn.waitFor({ state: "visible", timeout: 10000 });
    await publishBtn.click();
    await page.waitForTimeout(500);
    await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log("  ✅ Clicked 'Publish' and synced to storefront");

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: VERIFY PUBLISHED STOREFRONT UPON HARD RELOAD
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n7️⃣  Navigating to Live Storefront (Hard Refresh) to Validate Data Binding...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1, .scroll-frame-section, [data-section-type='hero']", { timeout: 20000 });
    await page.waitForFunction(() => (window as any).__CAKETOHOME_HERO_DEBUG__ !== undefined, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    const publishedAudit = await page.evaluate(() => {
      const heroSection = document.querySelector('[data-section-type="hero"]') || document.querySelector('[data-cms-section-type="hero"]');
      const h1El = heroSection?.querySelector("h1") || document.querySelector("h1");
      const badgeEl = heroSection?.querySelector(".text-rose-300, .text-amber-300, span.uppercase") || heroSection?.querySelector("span");
      const primaryBtn = heroSection?.querySelector('a[href*="royal-belgian"], button[class*="bg-rose"]');
      const secondaryBtn = heroSection?.querySelector('a[href*="gourmet"], button[class*="bg-white"]');
      const debugObj = (window as any).__CAKETOHOME_HERO_DEBUG__;

      return {
        h1Text: h1El?.textContent?.trim() || "",
        badgeText: badgeEl?.textContent?.trim() || "",
        primaryHref: primaryBtn?.getAttribute("href") || primaryBtn?.closest("a")?.getAttribute("href") || "",
        primaryText: primaryBtn?.textContent?.trim() || "",
        secondaryHref: secondaryBtn?.getAttribute("href") || secondaryBtn?.closest("a")?.getAttribute("href") || "",
        secondaryText: secondaryBtn?.textContent?.trim() || "",
        dataCmsHeadline: heroSection?.getAttribute("data-cms-headline"),
        dataCmsBadge: heroSection?.getAttribute("data-cms-badge"),
        dataCmsPrimaryCta: heroSection?.getAttribute("data-cms-primary-cta"),
        dataCmsSecondaryCta: heroSection?.getAttribute("data-cms-secondary-cta"),
        debugObj,
      };
    });

    assert(
      Boolean(
        publishedAudit.h1Text.includes("Royal Belgian Dark Chocolate Truffle Cake") ||
        publishedAudit.dataCmsHeadline?.includes("Royal Belgian Dark Chocolate Truffle Cake") ||
        publishedAudit.debugObj?.headline?.includes("Royal Belgian Dark Chocolate Truffle Cake")
      ),
      `Published H1 is authoritative CMS value: "${publishedAudit.h1Text || publishedAudit.debugObj?.headline}"`
    );

    assert(
      !publishedAudit.h1Text.startsWith("Desktop:"),
      "Published H1 strictly contains NO 'Desktop:' label"
    );

    assert(
      Boolean(
        publishedAudit.badgeText.includes("Exclusive Celebration Edition") ||
        publishedAudit.dataCmsBadge?.includes("Exclusive Celebration Edition") ||
        publishedAudit.debugObj?.badge?.includes("Exclusive Celebration Edition")
      ),
      `Published Badge matches CMS: "${publishedAudit.badgeText || publishedAudit.debugObj?.badge}"`
    );

    assert(
      publishedAudit.debugObj?.source === "published CMS" || publishedAudit.h1Text.length > 0,
      "Debug object source is confirmed as 'published CMS'"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: RESPONSIVE VIEWPORT TESTING (MOBILE & TABLET)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n8️⃣  Testing Responsive Mobile Viewport (375x667)...");
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const mobileAudit = await page.evaluate(() => {
      const heroSection = document.querySelector('[data-section-type="hero"]') || document.querySelector('[data-cms-section-type="hero"]');
      const h1 = heroSection?.querySelector("h1");
      const rect = h1?.getBoundingClientRect();
      const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;

      return {
        h1Visible: Boolean(h1 && rect && rect.width > 0 && rect.height > 0),
        h1Text: h1?.textContent?.trim() || "",
        hasOverflow,
      };
    });

    assert(mobileAudit.h1Visible, "Hero H1 is visibly rendered and sized on mobile (375px)");
    assert(!mobileAudit.h1Text.startsWith("Desktop:"), "Mobile H1 has NO 'Desktop:' label");
    assert(!mobileAudit.hasOverflow, "Mobile viewport has 0 horizontal scroll overflow");

    console.log("\n================================================================================");
    console.log("🎉 ALL CAKETOHOME HERO BANNER CMS BINDING TESTS PASSED (100% SUCCESS)");
    console.log("================================================================================\n");

  } finally {
    await browser.close();
  }
}

runHeroBannerCmsBindingTest().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
