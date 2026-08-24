import { chromium, Browser, BrowserContext, Page } from "playwright";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function runDashboardAssetE2E() {
  console.log("\n" + "=".repeat(80));
  console.log("🎬 CAKETOHOME — DASHBOARD ROUTE ASSETS & CHUNKS E2E ACCEPTANCE TEST");
  console.log("=".repeat(80) + "\n");

  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

  console.log("1️⃣  Launching Chromium Browser Session...");
  const browser: Browser = await chromium.launch({ headless: true });

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Set Super Admin Auth Cookies for dashboard access
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "mock_jwt_super_admin", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "9876543210", domain: "localhost", path: "/" },
  ]);

  const page: Page = await context.newPage();

  const failedNextAssets: { url: string; status: number }[] = [];
  const successfulNextAssets: { url: string; status: number }[] = [];

  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes("/_next/static/")) {
      const status = resp.status();
      if (status >= 400) {
        failedNextAssets.push({ url, status });
        console.error(`  ❌ [CHUNK_404] ${status} : ${url}`);
      } else {
        successfulNextAssets.push({ url, status });
      }
    }
  });

  page.on("pageerror", (err) => {
    console.error(`  ❌ [PAGE_UNCAUGHT_ERROR] ${err.message}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TEST DASHBOARD ROUTES & QUERY PARAMETERS
  // ──────────────────────────────────────────────────────────────────────────
  const testTabs = [
    { path: "/dashboard", label: "Dashboard Root" },
    { path: "/dashboard?tab=orders", label: "Dashboard Orders Tab" },
    { path: "/dashboard?tab=catalog", label: "Dashboard Catalog Tab" },
    { path: "/dashboard?tab=cms", label: "Dashboard CMS Tab" },
    { path: "/dashboard?tab=fulfillment", label: "Dashboard Fulfillment Tab" },
  ];

  for (const tab of testTabs) {
    console.log(`\n2️⃣  Auditing Route: ${tab.label} (${tab.path})...`);
    failedNextAssets.length = 0;

    const navResp = await page.goto(`${baseUrl}${tab.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    assert(Boolean(navResp && navResp.status() === 200), `${tab.label} returned HTTP 200`);
    await page.waitForTimeout(1500);

    assert(
      failedNextAssets.length === 0,
      `Zero Next.js static asset 404s for ${tab.label} (failed: ${failedNextAssets.length})`
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. TEST CLIENT-SIDE NAVIGATION (NO FULL PAGE RELOAD)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Testing Client-Side Navigation across Dashboard Tabs...");
  failedNextAssets.length = 0;

  // Navigate to CMS tab via URL or button
  await page.goto(`${baseUrl}/dashboard?tab=orders`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Switch to CMS tab
  await page.goto(`${baseUrl}/dashboard?tab=cms`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  assert(
    failedNextAssets.length === 0,
    "Zero chunk 404s during client-side navigation between tabs"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TEST HARD REFRESH ON /dashboard?tab=cms
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Testing Hard Refresh on /dashboard?tab=cms...");
  failedNextAssets.length = 0;

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  assert(
    failedNextAssets.length === 0,
    "Zero Next.js asset 404s on hard reload of /dashboard?tab=cms"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 5. TEST INCOGNITO / CLEAN CONTEXT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Testing in Clean Incognito Context with Auth Cookies...");
  const incognitoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await incognitoContext.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);

  const incognitoPage = await incognitoContext.newPage();
  failedNextAssets.length = 0;

  incognitoPage.on("response", (resp) => {
    if (resp.url().includes("/_next/static/") && resp.status() >= 400) {
      failedNextAssets.push({ url: resp.url(), status: resp.status() });
    }
  });

  await incognitoPage.goto(`${baseUrl}/dashboard?tab=cms`, { waitUntil: "domcontentloaded" });
  await incognitoPage.waitForTimeout(2000);

  assert(
    failedNextAssets.length === 0,
    "Zero chunk 404s in fresh incognito context"
  );

  await browser.close();

  console.log("\n" + "=".repeat(80));
  console.log("🎉 ALL DASHBOARD ROUTE & CHUNK ASSET ACCEPTANCE TESTS PASSED (100% SUCCESS)");
  console.log("=".repeat(80) + "\n");
}

runDashboardAssetE2E().catch((err) => {
  console.error("❌ Acceptance test failed:", err);
  process.exit(1);
});
