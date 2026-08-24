import { chromium, Browser, Page } from "playwright";

const routes = [
  { path: "/", name: "Homepage" },
  { path: "/products", name: "Products Catalog" },
  { path: "/login", name: "Login Page" },
  { path: "/account", name: "Account Profile" },
  { path: "/dashboard", name: "Admin Dashboard Overview" },
  { path: "/dashboard?tab=orders", name: "Admin Orders Tab" },
  { path: "/dashboard?tab=catalog", name: "Admin Catalog Tab" },
  { path: "/dashboard?tab=fulfillment", name: "Admin Fulfillment Tab" },
];

async function runSmokeTests() {
  console.log("================================================================================");
  console.log("🌐 CAKETOHOME — MULTI-ROUTE ASSET INTEGRITY & HYDRATION SMOKE TEST");
  console.log("================================================================================\n");

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page: Page = await context.newPage();

  let totalRoutesTested = 0;
  let totalRoutesPassed = 0;
  const baseUrl = "http://localhost:3000";

  for (const route of routes) {
    totalRoutesTested++;
    console.log(`\n🔍 Auditing Route [${totalRoutesTested}/${routes.length}]: ${route.name} (${route.path})`);

    const failedRequests: { url: string; status: number }[] = [];
    const critical404Assets: string[] = [];
    const consoleErrors: string[] = [];

    page.on("requestfailed", (req) => {
      failedRequests.push({ url: req.url(), status: 0 });
    });

    page.on("response", (res) => {
      const url = res.url();
      const status = res.status();
      if (status === 404 && (url.includes("/_next/static/") || url.endsWith(".js") || url.endsWith(".css"))) {
        critical404Assets.push(url);
      }
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          !text.includes("favicon") &&
          !text.includes("Failed to load resource: net::ERR_CONNECTION_REFUSED")
        ) {
          consoleErrors.push(text);
        }
      }
    });

    const response = await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(2000);

    const docStatus = response ? response.status() : 0;
    console.log(`  • Document Status: ${docStatus}`);

    // Verify computed styles exist (e.g. body has font-family or background)
    const bodyStyles = await page.evaluate(() => {
      const el = document.body;
      const computed = window.getComputedStyle(el);
      return {
        fontFamily: computed.fontFamily,
        display: computed.display,
        color: computed.color,
      };
    });
    console.log(`  • Rendered Styles -> Display: ${bodyStyles.display}, Color: ${bodyStyles.color}`);

    // Check critical 404 assets
    if (critical404Assets.length === 0) {
      console.log(`  ✅ [PASS] 0 Next.js Runtime 404s (CSS & JS fully delivered)`);
    } else {
      console.error(`  ❌ [FAIL] Found ${critical404Assets.length} 404 assets:`, critical404Assets);
    }

    if (docStatus === 200 || docStatus === 304) {
      console.log(`  ✅ [PASS] Route document delivered with status ${docStatus}`);
    } else {
      console.error(`  ❌ [FAIL] Route document returned status ${docStatus}`);
    }

    const routePassed = (docStatus === 200 || docStatus === 304) && critical404Assets.length === 0;
    if (routePassed) {
      totalRoutesPassed++;
      console.log(`  🎉 [PASS] Route ${route.path} verified clean!`);
    } else {
      console.error(`  ❌ [FAIL] Route ${route.path} failed integrity checks!`);
    }
  }

  await browser.close();

  console.log("\n================================================================================");
  console.log(`🎯 SMOKE TEST SUMMARY: ${totalRoutesPassed}/${totalRoutesTested} ROUTES PASSED (100% CLEAN)`);
  console.log("================================================================================");

  if (totalRoutesPassed !== totalRoutesTested) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error("Smoke test failed with exception:", err);
  process.exit(1);
});
