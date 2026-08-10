import { chromium } from "playwright";

async function diagnoseScrollArchitecture() {
  console.log("===============================================================");
  console.log("CAKETOHOME CMS — EMPIRICAL DOM & SCROLL DIAGNOSTIC TOOL");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/dashboard?tab=cms ...");
  await page.goto("http://localhost:3000/dashboard?tab=cms", { waitUntil: "load" });
  await page.waitForTimeout(2000);

  // ── 1. Page Metrics & Scroll Container Audit ──────────────────────────────
  const metrics = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;

    const scrollContainers: any[] = [];
    const allElements = Array.from(document.querySelectorAll("*"));

    allElements.forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 2) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        scrollContainers.push({
          tagName: el.tagName,
          id: el.id,
          className: el.className ? String(el.className).substring(0, 80) : "",
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          scrollTop: el.scrollTop,
          overflowY: style.overflowY,
          position: style.position,
          top: style.top,
          rect: { top: rect.top, height: rect.height, width: rect.width },
        });
      }
    });

    return {
      docScrollHeight: docEl.scrollHeight,
      docClientHeight: docEl.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      windowScrollY: window.scrollY,
      scrollContainers,
    };
  });

  console.log(`Document scrollHeight: ${metrics.docScrollHeight}px, clientHeight: ${metrics.docClientHeight}px`);
  console.log(`Body scrollHeight: ${metrics.bodyScrollHeight}px, clientHeight: ${metrics.bodyClientHeight}px`);
  console.log(`Window scrollY: ${metrics.windowScrollY}px`);
  console.log(`\nFound ${metrics.scrollContainers.length} elements where scrollHeight > clientHeight:`);

  metrics.scrollContainers.forEach((sc, i) => {
    console.log(`\n[Container #${i + 1}] <${sc.tagName.toLowerCase()} id="${sc.id}" class="${sc.className}">`);
    console.log(`   scrollHeight: ${sc.scrollHeight}px | clientHeight: ${sc.clientHeight}px | overflowY: ${sc.overflowY} | position: ${sc.position}`);
  });

  // ── 2. DOM Ancestry from body -> CMS Configurator ──────────────────────────
  console.log("\n---------------------------------------------------------------");
  console.log("DOM ANCESTRY INSPECTION FROM BODY DOWN TO CONFIGURATOR");
  console.log("---------------------------------------------------------------");

  const ancestry = await page.evaluate(() => {
    const nav = document.querySelector("nav");
    const configurator = document.querySelector("[class*='PageConfigurator']") || document.querySelector("main")?.firstElementChild;

    const navRect = nav ? nav.getBoundingClientRect() : null;
    const navStyle = nav ? window.getComputedStyle(nav) : null;

    let curr: HTMLElement | null = nav as HTMLElement;
    const navAncestors: any[] = [];
    while (curr && curr !== document.body) {
      const style = window.getComputedStyle(curr);
      const rect = curr.getBoundingClientRect();
      navAncestors.push({
        tag: curr.tagName,
        class: curr.className ? String(curr.className).substring(0, 60) : "",
        id: curr.id,
        overflow: style.overflow,
        overflowY: style.overflowY,
        position: style.position,
        top: style.top,
        height: style.height,
        minHeight: style.minHeight,
        transform: style.transform,
        marginTop: style.marginTop,
        paddingTop: style.paddingTop,
        rect: { top: rect.top, height: rect.height },
      });
      curr = curr.parentElement;
    }

    return {
      navInfo: nav
        ? {
            tag: nav.tagName,
            rect: navRect,
            position: navStyle?.position,
            top: navStyle?.top,
            transform: navStyle?.transform,
          }
        : null,
      navAncestors,
    };
  });

  console.log("\nGlobal Nav Rect:", ancestry.navInfo?.rect);
  console.log("Global Nav Position & Top:", ancestry.navInfo?.position, ancestry.navInfo?.top);
  console.log("\nNav Ancestor Chain:");
  ancestry.navAncestors.forEach((a, i) => {
    console.log(`[Ancestor #${i + 1}] <${a.tag.toLowerCase()} id="${a.id}" class="${a.class}">`);
    console.log(`   pos: ${a.position} | top: ${a.top} | overflowY: ${a.overflowY} | height: ${a.height} | transform: ${a.transform} | rect.top: ${a.rect.top}px`);
  });

  // ── 3. Scroll Simulation & Sticky/Blank Region Inspection ──────────────────
  console.log("\n---------------------------------------------------------------");
  console.log("SCROLL SIMULATION & HEADER POSITION AT ScrollY = 0, 100, 300, 600");
  console.log("---------------------------------------------------------------");

  for (const scrollYAmount of [0, 100, 300, 600]) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollYAmount);
    await page.waitForTimeout(200);

    const scrollState = await page.evaluate(() => {
      const nav = document.querySelector("nav");
      const navRect = nav ? nav.getBoundingClientRect() : null;
      const bodyScrollY = window.scrollY;

      // Find any element positioned above nav with positive height
      const blankRegionCheck = {
        windowScrollY: bodyScrollY,
        navBoundingTop: navRect ? navRect.top : 0,
        navBoundingHeight: navRect ? navRect.height : 0,
        documentScrollHeight: document.documentElement.scrollHeight,
      };

      return blankRegionCheck;
    });

    console.log(`ScrollY = ${scrollYAmount}px | window.scrollY = ${scrollState.windowScrollY}px | Nav Bounding Top = ${scrollState.navBoundingTop}px | Doc ScrollHeight = ${scrollState.documentScrollHeight}px`);
  }

  // ── 4. Duplicate Headers & Component Tree Check ────────────────────────────
  console.log("\n---------------------------------------------------------------");
  console.log("CHECKING FOR DUPLICATE HEADERS OR NAVIGATIONS");
  console.log("---------------------------------------------------------------");

  const duplicateCheck = await page.evaluate(() => {
    const navs = Array.from(document.querySelectorAll("nav"));
    const headers = Array.from(document.querySelectorAll("header"));
    const logoLinks = Array.from(document.querySelectorAll("a[href='/']"));

    return {
      navCount: navs.length,
      headerCount: headers.length,
      logoLinkCount: logoLinks.length,
      navDetails: navs.map((n) => ({ class: n.className, text: n.textContent?.substring(0, 40) })),
    };
  });

  console.log(`Nav elements found: ${duplicateCheck.navCount}`);
  console.log(`Header elements found: ${duplicateCheck.headerCount}`);
  console.log(`Logo links found: ${duplicateCheck.logoLinkCount}`);
  duplicateCheck.navDetails.forEach((n, i) => console.log(`  Nav #${i + 1}: ${n.text}`));

  // ── 5. Search for 100vh / calc(100vh) usages in inline/computed styles ─────
  console.log("\n---------------------------------------------------------------");
  console.log("CHECKING COMPUTED VIEWPORT HEIGHT USAGES");
  console.log("---------------------------------------------------------------");

  const vhElements = await page.evaluate(() => {
    const results: any[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const style = window.getComputedStyle(el);
      const inlineStyle = el.getAttribute("style") || "";
      if (inlineStyle.includes("vh") || style.height.includes("vh") || style.minHeight.includes("vh")) {
        results.push({
          tag: el.tagName,
          class: el.className ? String(el.className).substring(0, 50) : "",
          inline: inlineStyle,
          height: style.height,
          minHeight: style.minHeight,
        });
      }
    });
    return results;
  });

  console.log(`Found ${vhElements.length} elements using viewport height styles:`);
  vhElements.forEach((v) => console.log(`  <${v.tag.toLowerCase()} class="${v.class}"> height: ${v.height} | minHeight: ${v.minHeight} | inline: ${v.inline}`));

  await browser.close();
  console.log("\n===============================================================");
  console.log("DIAGNOSTIC COMPLETED");
  console.log("===============================================================\n");
}

diagnoseScrollArchitecture().catch((err) => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
