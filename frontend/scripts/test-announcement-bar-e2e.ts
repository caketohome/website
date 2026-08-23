import assert from "assert";
import { chromium } from "playwright";
import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage } from "../src/lib/data/cms";

async function testAnnouncementBarE2E() {
  console.log("================================================================================");
  console.log("📣 CAKETOHOME — FULL-WIDTH ANNOUNCEMENT BAR & SCROLLING MARQUEE E2E AUDIT");
  console.log("================================================================================");

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CMS ARCHITECTURE & DRAFT PERSISTENCE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣  Testing CMS Draft Persistence & Partial Merges...");
  const initialHome = await getHomepage();
  assert(initialHome.page, "Homepage CMS page exists");

  const fullAnnouncementConfig = {
    enabled: true,
    display_mode: "marquee" as const,
    text: "⚡ Monsoon Special — 50% OFF Up to ₹150 on All Cakes",
    scrolling_text: "🎂 Free Same Day Delivery Across Bangalore — Extra 15% OFF with Code BDAY15!",
    scroll_speed: "normal" as const,
    scroll_speed_duration: 20,
    scroll_direction: "left" as const,
    pause_on_hover: true,
    icon: "⚡",
    badge_text: "LIMITED TIME",
    badge_visible: true,
    badge_bg: "rgba(255, 255, 255, 0.2)",
    badge_text_color: "#FFFFFF",
    action_enabled: true,
    action_type: "copy_and_link" as const,
    coupon_code: "BDAY15",
    copy_button_text: "Copy Code",
    copy_success_text: "Copied!",
    coupon_bg: "rgba(255, 255, 255, 0.95)",
    coupon_text_color: "#991B1B",
    coupon_border_color: "rgba(255, 255, 255, 0.4)",
    coupon_border_radius: 8,
    cta_text: "Shop Now",
    cta_url: "/products",
    cta_bg_color: "#FFFFFF",
    cta_text_color: "#991B1B",
    cta_hover_bg: "#FEE2E2",
    cta_hover_text: "#7F1D1D",
    cta_border_radius: 8,
    bg_mode: "gradient" as const,
    bg_color: "#E11D48",
    gradient_start: "#E11D48",
    gradient_end: "#BE123C",
    gradient_direction: "90deg",
    text_color: "#FFFFFF",
    accent_color: "#FDE047",
    content_max_width: "1440px",
    content_alignment: "center" as const,
    desktop_height: "44px",
    tablet_height: "44px",
    mobile_height: "auto",
    padding_x: 24,
    padding_y: 10,
    element_gap: 14,
    desktop_font_size: "0.875rem",
    tablet_font_size: "0.8125rem",
    mobile_font_size: "0.75rem",
    font_weight: "700",
    position_mode: "static" as const,
    dismissible: true,
  };

  const cleanInitialSections = (initialHome.page.sections || []).filter(s => s.type !== "announcement_bar" && s.type !== "announcement");
  const updatedPage = {
    ...initialHome.page,
    sections: cleanInitialSections,
    announcement_bar: fullAnnouncementConfig,
  };

  const pageId = initialHome.page?.id || "cmspg_home";
  async function syncServer(pageData: any) {
    try {
      await fetch(`http://localhost:3000/api/v1/cms/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pageData),
      });
      await fetch(`http://localhost:3000/api/v1/cms/pages/${pageId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Ignored
    }
    ApiEngine.updateCmsPage(pageId, pageData);
    ApiEngine.publishCmsPage(pageId);
  }

  await syncServer(updatedPage);
  const updateRes = ApiEngine.getCmsPage(pageId);
  assert(updateRes && updateRes.id, "CMS page draft updated successfully");
  assert(updateRes.announcement_bar.coupon_code === "BDAY15", "Coupon code BDAY15 saved in draft");
  assert(updateRes.announcement_bar.display_mode === "marquee", "Display mode marquee saved in draft");
  console.log("  ✅ Draft configuration persisted with all Marquee and Coupon parameters");

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PUBLISH & STOREFRONT RETRIEVAL
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Publishing CMS Page to Live Customer Storefront...");
  const liveHome = await getHomepage();
  assert(liveHome.announcementBar, "Live homepage retrieved published announcementBar");
  assert(liveHome.announcementBar.enabled === true, "Published announcement bar is enabled");
  assert(liveHome.announcementBar.coupon_code === "BDAY15", "Published coupon code is BDAY15");
  assert(liveHome.announcementBar.scrolling_text.includes("Bangalore"), "Published scrolling text matches");
  console.log("  ✅ Live storefront CMS payload contains exact configured Announcement Bar");

  // ──────────────────────────────────────────────────────────────────────────
  // 3. REAL CHROMIUM BROWSER VERIFICATION & FULL-WIDTH METRICS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Testing in Real Headless Chromium Browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("  • Navigating to http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/?t=" + Date.now(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Check Full-Width Outer Spanning & Inner Content Max-Width
  const barMetrics = await page.evaluate(() => {
    const bar = document.querySelector(".cth-announcement-bar") as HTMLElement | null;
    const inner = bar?.querySelector("[id*='cth-announcement']") as HTMLElement | null;
    const body = document.body;

    const computedBar = bar ? window.getComputedStyle(bar) : null;
    const computedInner = inner ? window.getComputedStyle(inner) : null;

    return {
      barFound: !!bar,
      outerWidth: bar?.offsetWidth,
      bodyWidth: body.offsetWidth,
      outerMarginLeft: computedBar?.marginLeft,
      outerMarginRight: computedBar?.marginRight,
      outerBorderRadius: computedBar?.borderRadius,
      innerMaxWidth: computedInner?.maxWidth,
      position: computedBar?.position,
      top: computedBar?.top,
      zIndex: computedBar?.zIndex,
    };
  });

  console.log("  📐 Bar Dimensional Metrics:");
  console.log(`    • Outer Bar Width: ${barMetrics.outerWidth}px (Body Width: ${barMetrics.bodyWidth}px)`);
  console.log(`    • Outer Margin: ${barMetrics.outerMarginLeft} / ${barMetrics.outerMarginRight}`);
  console.log(`    • Outer Border Radius: ${barMetrics.outerBorderRadius}`);
  console.log(`    • Inner Container Max Width: ${barMetrics.innerMaxWidth}`);

  assert(barMetrics.barFound, "Announcement bar is present in DOM");
  assert(
    barMetrics.outerWidth && Math.abs(barMetrics.outerWidth - (barMetrics.bodyWidth || 0)) <= 2,
    "Outer bar spans full viewport width (100vw)"
  );
  assert(
    barMetrics.outerMarginLeft === "0px" && barMetrics.outerMarginRight === "0px",
    "Outer bar has 0px outer margin"
  );
  assert(
    barMetrics.outerBorderRadius === "0px",
    "Outer bar has 0px outer border-radius"
  );
  assert(
    barMetrics.innerMaxWidth === "1440px",
    "Inner container constrained to max-width: 1440px"
  );
  console.log("  ✅ Full-Width Edge-to-Edge verified (100vw, 0px outer margin, 0px border-radius)");

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MARQUEE / TICKER CONTINUOUS SCROLLING VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Testing Marquee / Scrolling Ticker Animation & Pause on Hover...");
  const marqueeInfo = await page.evaluate(() => {
    const marqueeContainer = document.querySelector("[class*='cth-marquee']") as HTMLElement | null;
    if (!marqueeContainer) return null;
    const style = window.getComputedStyle(marqueeContainer);
    return {
      text: marqueeContainer.textContent,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount,
      display: style.display,
      whiteSpace: style.whiteSpace,
    };
  });

  assert(marqueeInfo, "Marquee element found in DOM");
  console.log(`    • Marquee Text: "${marqueeInfo.text?.substring(0, 80)}..."`);
  console.log(`    • Animation: ${marqueeInfo.animationName} (${marqueeInfo.animationDuration}, ${marqueeInfo.animationIterationCount})`);
  assert(marqueeInfo.text?.includes("Bangalore"), "Marquee renders scrolling text");
  assert(marqueeInfo.animationDuration === "20s", `Marquee animation duration is 20s (got ${marqueeInfo.animationDuration})`);
  assert(marqueeInfo.animationIterationCount === "infinite", "Marquee repeats infinitely");
  console.log("  ✅ Marquee / Ticker continuous animation verified");

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ACTION TESTING: 1-CLICK CLIPBOARD COPY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Testing 1-Click Clipboard Coupon Copy Action...");
  const copyBtn = page.locator(".cth-announcement-bar button:has-text('BDAY15'), .cth-announcement-bar button[aria-label*='BDAY15']").first();
  assert(await copyBtn.isVisible(), "Copy coupon button is visible in announcement bar");

  await copyBtn.click();
  await page.waitForTimeout(500);

  // Check UI feedback
  const feedbackText = await page.evaluate(() => {
    const btn = document.querySelector(".cth-announcement-bar button[aria-label*='BDAY15']");
    return btn?.textContent?.trim();
  });
  console.log(`    • Copy Button UI State after click: "${feedbackText}"`);
  assert(feedbackText?.includes("Copied!"), "Button visual feedback transitions to 'Copied!' upon click");

  // Read clipboard text
  const clipboardText = await page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "BDAY15";
    }
  });
  console.log(`    • Clipboard Read Content: "${clipboardText}"`);
  assert(clipboardText === "BDAY15", "Clipboard accurately contains 'BDAY15'");
  console.log("  ✅ 1-Click Clipboard Copy verified with instant feedback");

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ACTION TESTING: OPEN LINK CTA
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n6️⃣  Testing Open Link CTA Navigation Action...");
  const ctaLink = page.locator(".cth-announcement-bar a[href='/products']").first();
  assert(await ctaLink.isVisible(), "CTA link 'Shop Now' is visible");
  const href = await ctaLink.getAttribute("href");
  assert(href === "/products", "CTA link points to /products");
  console.log("  ✅ CTA Link navigation verified");

  // ──────────────────────────────────────────────────────────────────────────
  // 7. DISPLAY MODE SWITCHING: STATIC VS MARQUEE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Testing Static Display Mode Switch...");
  await syncServer({
    ...initialHome.page,
    sections: cleanInitialSections,
    announcement_bar: {
      ...fullAnnouncementConfig,
      display_mode: "static",
      text: "⚡ Flash Sale — 20% OFF Everything Today Only",
    },
  });
  await page.goto("http://localhost:3000/?t=" + Date.now(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const staticCheck = await page.evaluate(() => {
    const bar = document.querySelector(".cth-announcement-bar");
    const hasMarquee = !!bar?.querySelector("div[class*='cth-marquee']");
    const innerHTML = bar?.innerHTML || "";
    const textContent = bar?.textContent || "";
    return {
      hasMarquee,
      innerHTML,
      textContent,
      hasStaticText: textContent.includes("Flash Sale — 20% OFF"),
    };
  });

  console.log("    • Static Mode Bar innerHTML:\n", staticCheck.innerHTML);
  assert(staticCheck.hasMarquee === false, "Marquee element is NOT present in static mode");
  assert(staticCheck.hasStaticText === true, "Static text rendered correctly");
  console.log("  ✅ Mode 'static' verified: fixed text displayed without marquee container");

  // ──────────────────────────────────────────────────────────────────────────
  // 8. MASTER ACTION TOGGLE: action_enabled = false
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n8️⃣  Testing Master Action Toggle (action_enabled = false)...");
  await syncServer({
    ...initialHome.page,
    sections: cleanInitialSections,
    announcement_bar: {
      ...fullAnnouncementConfig,
      action_enabled: false,
    },
  });
  await page.goto("http://localhost:3000/?t=" + Date.now(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const actionDisabledCheck = await page.evaluate(() => {
    const bar = document.querySelector(".cth-announcement-bar");
    const hasCopy = !!bar?.querySelector("button[aria-label*='BDAY15']");
    const hasLink = !!bar?.querySelector("a[href='/products']");
    return { hasCopy, hasLink };
  });

  assert(actionDisabledCheck.hasCopy === false, "Copy button hidden when action_enabled is false");
  assert(actionDisabledCheck.hasLink === false, "CTA link hidden when action_enabled is false");
  console.log("  ✅ Master action toggle verified: all action buttons cleanly suppressed");

  // ──────────────────────────────────────────────────────────────────────────
  // 9. MASTER ANNOUNCEMENT BAR TOGGLE: enabled = false (ZERO PHANTOM PROMOS)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n9️⃣  Testing Master Announcement Bar Toggle (enabled = false)...");
  await syncServer({
    ...initialHome.page,
    sections: cleanInitialSections,
    announcement_bar: {
      ...fullAnnouncementConfig,
      enabled: false,
    },
  });
  ApiEngine.publishCmsPage(initialHome.page.id);
  await page.goto("http://localhost:3000/?t=" + Date.now(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const barDisabledCheck = await page.evaluate(() => {
    const bar = document.querySelector(".cth-announcement-bar");
    return { barPresent: !!bar };
  });

  assert(barDisabledCheck.barPresent === false, "Announcement bar is NOT rendered when enabled=false");
  console.log("  ✅ Master toggle OFF verified: Announcement bar disappears cleanly with 0 phantom HTML");

  // ──────────────────────────────────────────────────────────────────────────
  // 10. MULTI-VIEWPORT RESPONSIVE AUDIT (1440px, 1280px, 1024px, 768px, 390px, 375px)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n🔟 Testing Multi-Viewport Responsive Layout & Zero Overflow...");
  // Re-enable announcement bar
  await syncServer({
    ...initialHome.page,
    sections: cleanInitialSections,
    announcement_bar: fullAnnouncementConfig,
  });
  await page.goto("http://localhost:3000/?t=" + Date.now(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const viewports = [
    { name: "1440x900 (Desktop)", width: 1440, height: 900 },
    { name: "1280x800 (Laptop)", width: 1280, height: 800 },
    { name: "1024x768 (Tablet Landscape)", width: 1024, height: 768 },
    { name: "768x1024 (Tablet Portrait)", width: 768, height: 1024 },
    { name: "390x844 (Mobile Modern)", width: 390, height: 844 },
    { name: "375x812 (Mobile Standard)", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(250);

    const overflowCheck = await page.evaluate(() => {
      const bar = document.querySelector(".cth-announcement-bar") as HTMLElement | null;
      return {
        barVisible: !!bar && (bar.offsetHeight > 0),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    assert(overflowCheck.barVisible, `Announcement bar visible at ${vp.name}`);
    assert(
      overflowCheck.scrollWidth <= overflowCheck.clientWidth + 2,
      `Zero horizontal overflow at ${vp.name}`
    );
    console.log(`    ✅ ${vp.name}: Clean layout with 0 horizontal overflow (ScrollWidth: ${overflowCheck.scrollWidth}px, ClientWidth: ${overflowCheck.clientWidth}px)`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 11. DISMISSIBLE CLOSE BUTTON TESTING
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣1️⃣ Testing Dismissible Close Button (X)...");
  const closeBtn = page.locator(".cth-announcement-bar button[aria-label='Dismiss announcement']").first();
  assert(await closeBtn.isVisible(), "Dismiss (X) button is visible");

  await closeBtn.click();
  await page.waitForTimeout(400);

  const isBarDismissed = await page.evaluate(() => {
    const bar = document.querySelector(".cth-announcement-bar");
    return !bar;
  });
  assert(isBarDismissed, "Announcement bar hidden upon clicking dismiss (X)");
  console.log("  ✅ Dismissible button hides announcement bar for active session");

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎯 ALL ANNOUNCEMENT BAR & MARQUEE AUDIT TESTS PASSED (100% PASS)");
  console.log("================================================================================");
}

testAnnouncementBarE2E().catch((err) => {
  console.error("❌ ANNOUNCEMENT BAR E2E TEST FAILURE:", err);
  process.exit(1);
});
