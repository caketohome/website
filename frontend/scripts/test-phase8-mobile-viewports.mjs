import { chromium } from "playwright";

const VIEWPORTS = [
  { width: 320, height: 844, name: "320x844 (Small Mobile)" },
  { width: 360, height: 800, name: "360x800 (Android Common)" },
  { width: 375, height: 812, name: "375x812 (iPhone Mini)" },
  { width: 390, height: 844, name: "390x844 (iPhone 12/13/14)" },
  { width: 412, height: 915, name: "412x915 (Pixel 7/Galaxy S21)" },
  { width: 430, height: 932, name: "430x932 (iPhone 14/15 Pro Max)" },
];

const ROUTES = [
  "/",
  "/products",
  "/products/classic-chocolate-truffle-cake",
  "/cart",
  "/checkout",
  "/refund-policy",
];

async function runMobileAudit() {
  console.log("==================================================");
  console.log("PHASE 8 MOBILE VIEWPORT & OVERFLOW AUDIT");
  console.log("==================================================\n");

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport: ${vp.name} [${vp.width}x${vp.height}] ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    });
    const page = await context.newPage();

    for (const r of ROUTES) {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      const url = `http://localhost:3000${r}`;
      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1000); // Allow render to settle

        const dimensions = await page.evaluate(() => {
          return {
            windowWidth: window.innerWidth,
            docScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
          };
        });

        const hasHorizontalOverflow =
          dimensions.docScrollWidth > dimensions.windowWidth ||
          dimensions.bodyScrollWidth > dimensions.windowWidth;

        const overflowOffenders = await page.evaluate((winWidth) => {
          const offenders = [];
          document.querySelectorAll('*').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.right > winWidth + 1) {
              offenders.push(`${el.tagName.toLowerCase()}.${Array.from(el.classList).slice(0, 3).join('.')} (right: ${Math.round(rect.right)}px)`);
            }
          });
          return offenders.slice(0, 3);
        }, dimensions.windowWidth);

        const status = resp?.status() || 0;
        console.log(`  [${vp.width}px] Route: ${r} -> HTTP ${status} | Doc/Body: ${dimensions.docScrollWidth}/${dimensions.bodyScrollWidth} vs Win: ${dimensions.windowWidth} | Overflow: ${hasHorizontalOverflow ? `FAIL [${overflowOffenders.join(", ")}]` : "PASS"}`);

        results.push({
          viewport: vp.width,
          name: vp.name,
          route: r,
          status,
          windowWidth: dimensions.windowWidth,
          docScrollWidth: dimensions.docScrollWidth,
          hasHorizontalOverflow,
          consoleErrorsCount: consoleErrors.length,
        });
      } catch (err) {
        console.error(`  [${vp.width}px] Route: ${r} ERROR:`, err.message);
        results.push({
          viewport: vp.width,
          name: vp.name,
          route: r,
          status: 0,
          error: err.message,
          hasHorizontalOverflow: false,
        });
      }
    }
    await context.close();
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("MOBILE VIEWPORT AUDIT SUMMARY TABLE");
  console.log("==================================================");
  console.table(
    VIEWPORTS.map((vp) => {
      const vpResults = results.filter((r) => r.viewport === vp.width);
      const anyOverflow = vpResults.some((r) => r.hasHorizontalOverflow);
      const allStatusOk = vpResults.every((r) => r.status === 200);
      return {
        Viewport: `${vp.width}px`,
        Name: vp.name,
        RoutesTested: vpResults.length,
        HorizontalOverflow: anyOverflow ? "FAILED" : "PASSED (None)",
        HttpStatus: allStatusOk ? "100% 200 OK" : "MIXED",
        Verdict: !anyOverflow && allStatusOk ? "PASS" : "FAIL",
      };
    })
  );

  return results;
}

runMobileAudit().catch(console.error);
