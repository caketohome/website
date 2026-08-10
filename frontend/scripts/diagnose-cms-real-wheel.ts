import { chromium } from "playwright";

async function diagnoseRealWheelScrolling() {
  console.log("===============================================================");
  console.log("CAKETOHOME CMS — EMPIRICAL REAL MOUSE WHEEL DIAGNOSTIC TOOL");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/dashboard?tab=cms ...");
  await page.goto("http://localhost:3000/dashboard?tab=cms", { waitUntil: "load" });
  await page.waitForTimeout(2500);

  const initialMetrics = await page.evaluate(() => ({
    docScrollHeight: document.documentElement.scrollHeight,
    docClientHeight: document.documentElement.clientHeight,
    bodyScrollHeight: document.body.scrollHeight,
    bodyClientHeight: document.body.clientHeight,
    windowScrollY: window.scrollY,
  }));

  console.log(`Document scrollHeight: ${initialMetrics.docScrollHeight}px | clientHeight: ${initialMetrics.docClientHeight}px`);
  console.log(`Body scrollHeight: ${initialMetrics.bodyScrollHeight}px | clientHeight: ${initialMetrics.bodyClientHeight}px`);
  console.log(`Initial window.scrollY: ${initialMetrics.windowScrollY}px\n`);

  // 9 Test Locations for Mouse Wheel Scrolling
  const testLocations = [
    { label: "A. Far Left Page Margin", x: 20, y: 300 },
    { label: "B. Dashboard Title Area", x: 300, y: 100 },
    { label: "C. CMS Toolbar Area", x: 300, y: 170 },
    { label: "D. Left Settings Panel", x: 200, y: 400 },
    { label: "E. Center Canvas Preview", x: 700, y: 400 },
    { label: "F. Right Section Navigator", x: 1350, y: 400 },
    { label: "G. Empty Area Below Editor", x: 700, y: 880 },
    { label: "H. Media Library Panel", x: 500, y: 800 },
    { label: "I. Far Right Margin", x: 1420, y: 300 },
  ];

  for (const loc of testLocations) {
    console.log(`---------------------------------------------------------------`);
    console.log(`TESTING WHEEL AT LOCATION: ${loc.label} (x: ${loc.x}, y: ${loc.y})`);
    console.log(`---------------------------------------------------------------`);

    // Reset window.scrollY to 0 before each test location
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const targetElInfo = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return { tag: "null", id: "", class: "", ancestors: [] };

      const ancestors: any[] = [];
      let curr: HTMLElement | null = el as HTMLElement;
      while (curr && curr !== document.documentElement) {
        const style = window.getComputedStyle(curr);
        if (
          style.overflowY !== "visible" ||
          style.overflow !== "visible" ||
          style.position === "fixed" ||
          style.position === "sticky" ||
          curr.scrollHeight > curr.clientHeight
        ) {
          ancestors.push({
            tag: curr.tagName,
            id: curr.id,
            class: curr.className ? String(curr.className).substring(0, 50) : "",
            overflowY: style.overflowY,
            position: style.position,
            height: style.height,
            maxHeight: style.maxHeight,
            scrollHeight: curr.scrollHeight,
            clientHeight: curr.clientHeight,
            scrollTop: curr.scrollTop,
          });
        }
        curr = curr.parentElement;
      }

      return {
        tag: el.tagName,
        id: el.id,
        class: el.className ? String(el.className).substring(0, 50) : "",
        ancestors,
      };
    }, { x: loc.x, y: loc.y });

    console.log(`Target Element: <${targetElInfo.tag.toLowerCase()} id="${targetElInfo.id}" class="${targetElInfo.class}">`);
    console.log(`Relevant Scroll/Position Ancestors (${targetElInfo.ancestors.length}):`);
    targetElInfo.ancestors.forEach((a, i) => {
      console.log(`   [#${i + 1}] <${a.tag.toLowerCase()} id="${a.id}" class="${a.class}"> overflowY: ${a.overflowY} | pos: ${a.position} | height: ${a.height} | scrollHeight: ${a.scrollHeight}px / clientHeight: ${a.clientHeight}px`);
    });

    const scrollYBefore = await page.evaluate(() => window.scrollY);

    // Perform REAL mouse wheel scroll
    await page.mouse.move(loc.x, loc.y);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);

    const scrollYAfter = await page.evaluate(() => window.scrollY);

    const panelScrollStates = await page.evaluate(() => {
      const left = document.querySelector(".col-span-12.lg\\:col-span-3");
      const center = document.querySelector("#center-canvas-scroll");
      const right = document.querySelector(".col-span-12.lg\\:col-span-2");
      return {
        leftScrollTop: left ? left.scrollTop : 0,
        centerScrollTop: center ? center.scrollTop : 0,
        rightScrollTop: right ? right.scrollTop : 0,
      };
    });

    console.log(`RESULT -> window.scrollY: ${scrollYBefore}px -> ${scrollYAfter}px (delta: ${scrollYAfter - scrollYBefore}px)`);
    console.log(`Panel ScrollTops -> Left: ${panelScrollStates.leftScrollTop}px | Center: ${panelScrollStates.centerScrollTop}px | Right: ${panelScrollStates.rightScrollTop}px`);

    if (scrollYAfter > scrollYBefore) {
      console.log(`SUCCESS: Real mouse wheel scrolled window.scrollY by +${scrollYAfter - scrollYBefore}px!`);
    } else {
      console.log(`NOTE: window.scrollY did not change. Wheel captured by panel or container.`);
    }
  }

  await browser.close();
  console.log("\n===============================================================");
  console.log("REAL WHEEL DIAGNOSTIC COMPLETED");
  console.log("===============================================================\n");
}

diagnoseRealWheelScrolling().catch((err) => {
  console.error("Real wheel diagnostic failed:", err);
  process.exit(1);
});
