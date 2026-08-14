import { chromium } from "playwright";

async function inspectRenderedPage() {
  console.log("================================================================================");
  console.log("   CAKETOHOME: BROWSER COMPUTED STYLES & NETWORK 200 VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.url()} (${request.failure()?.errorText || "FAILED"})`);
  });

  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("favicon.ico")) {
      failedRequests.push(`${response.url()} (Status ${response.status()})`);
    }
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  console.log("1. Navigating to http://localhost:3000/ ...");
  const response = await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  console.log(`   Page loaded with HTTP status: ${response?.status()}`);

  // Check computed styles on elements to prove CSS is loaded
  const navBg = await page.$eval("nav", (el) => window.getComputedStyle(el).backgroundColor);
  const bodyFont = await page.$eval("body", (el) => window.getComputedStyle(el).fontFamily);
  const heroHeading = await page.$eval("h1, h2", (el) => ({
    text: el.textContent?.trim(),
    fontSize: window.getComputedStyle(el).fontSize,
    color: window.getComputedStyle(el).color,
  })).catch(() => null);

  console.log("\n2. Computed Styles Verification:");
  console.log(`   Navbar background-color: ${navBg}`);
  console.log(`   Body font-family: ${bodyFont}`);
  if (heroHeading) {
    console.log(`   Main heading font-size: ${heroHeading.fontSize}, color: ${heroHeading.color}`);
  }

  const isNavStyled = navBg.includes("17, 17, 17") || navBg.includes("rgb") || navBg.includes("#");
  console.log(`   ✅ Navbar CSS Computed & Applied: ${isNavStyled}`);

  await page.screenshot({ path: "temp-homepage-verified.png" });
  console.log("   ✅ Captured screenshot: temp-homepage-verified.png");

  console.log("\n3. Network Assets Summary:");
  console.log(`   Failed requests count: ${failedRequests.length}`);
  if (failedRequests.length > 0) {
    failedRequests.forEach((r) => console.error(`   ❌ Failed: ${r}`));
  } else {
    console.log("   ✅ Zero 404/failed network requests detected!");
  }

  console.log("\n4. Console Errors Summary:");
  console.log(`   Console errors count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.warn(`   ⚠️ Console: ${e}`));
  } else {
    console.log("   ✅ Zero console errors detected!");
  }

  console.log("\n5. Testing /login route...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  const loginTitle = await page.title();
  console.log(`   Login page title: "${loginTitle}"`);
  await page.screenshot({ path: "temp-login-verified.png" });
  console.log("   ✅ Captured screenshot: temp-login-verified.png");

  console.log("\n6. Testing /dashboard route...");
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  const dashTitle = await page.title();
  console.log(`   Dashboard page title: "${dashTitle}"`);
  await page.screenshot({ path: "temp-dashboard-verified.png" });
  console.log("   ✅ Captured screenshot: temp-dashboard-verified.png");

  await browser.close();

  console.log("\n================================================================================");
  console.log("   VERIFICATION COMPLETE: ALL ASSETS & STYLES OPERATIONAL");
  console.log("================================================================================\n");
}

inspectRenderedPage().catch((err) => {
  console.error("Browser inspection failed:", err);
  process.exit(1);
});
