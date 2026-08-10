/**
 * GLOBAL SCROLL ARCHITECTURE DIAGNOSTIC
 * Inspects every ancestor from html -> body -> #__next -> app shell -> page
 * across MULTIPLE routes to find the scroll-blocking element.
 */
import { chromium } from "playwright";

async function diagnoseGlobalScroll() {
  console.log("===============================================================");
  console.log("CAKETOHOME — GLOBAL SCROLL ARCHITECTURE DIAGNOSTIC");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const routes = [
    "/dashboard?tab=orders",
    "/dashboard?tab=catalog",
    "/dashboard?tab=branches",
    "/dashboard?tab=delivery",
    "/dashboard?tab=crm",
    "/dashboard?tab=marketing",
    "/dashboard?tab=cms",
    "/dashboard?tab=settings",
    "/dashboard?tab=analytics",
    "/",
  ];

  for (const route of routes) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ROUTE: ${route}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    await page.goto(`http://localhost:3000${route}`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // === DIAGNOSTIC 1: Root element metrics ===
    const rootMetrics = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        html_clientHeight: html.clientHeight,
        html_scrollHeight: html.scrollHeight,
        html_overflow: getComputedStyle(html).overflow,
        html_overflowY: getComputedStyle(html).overflowY,
        html_height: getComputedStyle(html).height,
        html_minHeight: getComputedStyle(html).minHeight,
        html_maxHeight: getComputedStyle(html).maxHeight,
        html_position: getComputedStyle(html).position,
        body_clientHeight: body.clientHeight,
        body_scrollHeight: body.scrollHeight,
        body_overflow: getComputedStyle(body).overflow,
        body_overflowY: getComputedStyle(body).overflowY,
        body_height: getComputedStyle(body).height,
        body_minHeight: getComputedStyle(body).minHeight,
        body_maxHeight: getComputedStyle(body).maxHeight,
        body_position: getComputedStyle(body).position,
        body_inlineOverflow: body.style.overflow,
        windowScrollY: window.scrollY,
        windowInnerHeight: window.innerHeight,
      };
    });

    console.log("ROOT METRICS:");
    console.log(`  html: clientHeight=${rootMetrics.html_clientHeight} scrollHeight=${rootMetrics.html_scrollHeight}`);
    console.log(`  html: overflow=${rootMetrics.html_overflow} overflowY=${rootMetrics.html_overflowY}`);
    console.log(`  html: height=${rootMetrics.html_height} minHeight=${rootMetrics.html_minHeight} maxHeight=${rootMetrics.html_maxHeight}`);
    console.log(`  html: position=${rootMetrics.html_position}`);
    console.log(`  body: clientHeight=${rootMetrics.body_clientHeight} scrollHeight=${rootMetrics.body_scrollHeight}`);
    console.log(`  body: overflow=${rootMetrics.body_overflow} overflowY=${rootMetrics.body_overflowY}`);
    console.log(`  body: height=${rootMetrics.body_height} minHeight=${rootMetrics.body_minHeight} maxHeight=${rootMetrics.body_maxHeight}`);
    console.log(`  body: position=${rootMetrics.body_position}`);
    console.log(`  body: inline overflow="${rootMetrics.body_inlineOverflow}"`);
    console.log(`  window: scrollY=${rootMetrics.windowScrollY} innerHeight=${rootMetrics.windowInnerHeight}`);

    const hasScrollableContent = rootMetrics.html_scrollHeight > rootMetrics.html_clientHeight;
    console.log(`\n  SCROLLABLE CONTENT: ${hasScrollableContent ? "YES" : "NO"} (scrollHeight ${rootMetrics.html_scrollHeight} ${hasScrollableContent ? ">" : "<="} clientHeight ${rootMetrics.html_clientHeight})`);

    // === DIAGNOSTIC 2: Walk ancestor chain ===
    const ancestors = await page.evaluate(() => {
      const results: any[] = [];
      let el: Element | null = document.body.firstElementChild;
      for (let depth = 0; depth < 20 && el; depth++) {
        const cs = getComputedStyle(el);
        results.push({
          depth,
          tag: el.tagName.toLowerCase(),
          id: el.id || "",
          classSnippet: (el.className?.toString() || "").substring(0, 150),
          overflow: cs.overflow,
          overflowY: cs.overflowY,
          overflowX: cs.overflowX,
          height: cs.height,
          minHeight: cs.minHeight,
          maxHeight: cs.maxHeight,
          position: cs.position,
          display: cs.display,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          isOverflowHidden: cs.overflowY === "hidden",
          isScrollBlocked: el.scrollHeight > el.clientHeight && cs.overflowY === "hidden",
        });
        el = el.firstElementChild;
      }
      return results;
    });

    console.log("\n  ANCESTOR CHAIN (body -> first child chain):");
    for (const a of ancestors) {
      const blockFlag = a.isScrollBlocked ? " ⛔ SCROLL BLOCKED!" : "";
      const hiddenFlag = a.isOverflowHidden ? " 🔒 overflow-y:hidden" : "";
      console.log(`  [${a.depth}] <${a.tag}${a.id ? ` id="${a.id}"` : ""}> class="${a.classSnippet}"`);
      console.log(`       overflow=${a.overflow} overflowY=${a.overflowY} overflowX=${a.overflowX}`);
      console.log(`       height=${a.height} minHeight=${a.minHeight} maxHeight=${a.maxHeight}`);
      console.log(`       position=${a.position} display=${a.display}`);
      console.log(`       scrollHeight=${a.scrollHeight} clientHeight=${a.clientHeight}${blockFlag}${hiddenFlag}`);
    }

    // === DIAGNOSTIC 3: Real mouse wheel test ===
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const beforeScroll = await page.evaluate(() => window.scrollY);
    await page.mouse.move(500, 400);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(400);
    const afterScroll = await page.evaluate(() => window.scrollY);
    const scrollDelta = afterScroll - beforeScroll;

    console.log(`\n  REAL MOUSE WHEEL TEST:`);
    console.log(`    Before: window.scrollY = ${beforeScroll}`);
    console.log(`    After:  window.scrollY = ${afterScroll}`);
    console.log(`    Delta:  ${scrollDelta}px`);
    console.log(`    RESULT: ${scrollDelta > 50 ? "✅ SCROLLABLE" : "❌ SCROLL LOCKED"}`);

    // === DIAGNOSTIC 4: Check all overflow-hidden ancestors that have scroll content ===
    const blockers = await page.evaluate(() => {
      const results: any[] = [];
      const allElements = document.querySelectorAll("*");
      for (const el of allElements) {
        const cs = getComputedStyle(el);
        if (
          (cs.overflowY === "hidden" || cs.overflow === "hidden") &&
          el.scrollHeight > el.clientHeight + 5
        ) {
          results.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || "",
            classSnippet: (el.className?.toString() || "").substring(0, 120),
            overflow: cs.overflow,
            overflowY: cs.overflowY,
            height: cs.height,
            maxHeight: cs.maxHeight,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            blockedPixels: el.scrollHeight - el.clientHeight,
          });
        }
      }
      return results.sort((a, b) => b.blockedPixels - a.blockedPixels).slice(0, 10);
    });

    if (blockers.length > 0) {
      console.log(`\n  ⛔ TOP SCROLL BLOCKERS (overflow-hidden with scrollHeight > clientHeight):`);
      for (const b of blockers) {
        console.log(`    <${b.tag}${b.id ? ` id="${b.id}"` : ""}> class="${b.classSnippet}"`);
        console.log(`      overflow=${b.overflow} overflowY=${b.overflowY} height=${b.height} maxHeight=${b.maxHeight}`);
        console.log(`      scrollHeight=${b.scrollHeight} clientHeight=${b.clientHeight} BLOCKED=${b.blockedPixels}px`);
      }
    } else {
      console.log(`\n  ✅ No overflow-hidden scroll blockers found on this page.`);
    }
  }

  await browser.close();
  console.log("\n\n===============================================================");
  console.log("GLOBAL SCROLL DIAGNOSTIC COMPLETE");
  console.log("===============================================================");
}

diagnoseGlobalScroll().catch((err) => {
  console.error("Diagnostic failed:", err);
  process.exit(1);
});
