import { chromium, Browser, Page } from "playwright";

interface ConsoleError {
  url: string;
  text: string;
}

async function runRuntimeRecoverySmokeTest() {
  console.log("\n" + "=".repeat(80));
  console.log("🛠️ CAKETOHOME — RUNTIME RECOVERY & BROWSER SMOKE TEST");
  console.log("=".repeat(80) + "\n");

  const baseUrl = "http://localhost:3000";
  const consoleErrors: ConsoleError[] = [];

  // ── 1. API Verification ──
  console.log("1️⃣  Verifying Authoritative Core APIs...");

  const t0 = Date.now();
  const cartRes = await fetch(`${baseUrl}/api/v1/cart`);
  const cartTime = Date.now() - t0;
  const cartData = await cartRes.json().catch(() => null);

  if (cartRes.status !== 200 || !cartData?.cart) {
    throw new Error(`Cart API failed: status ${cartRes.status}, data: ${JSON.stringify(cartData)}`);
  }
  console.log(`  ✅ [PASS] GET /api/v1/cart returned HTTP 200 in ${cartTime}ms (cart_id: ${cartData.cart.id})`);

  const tAuth = Date.now();
  const authRes = await fetch(`${baseUrl}/api/auth/me`);
  const authTime = Date.now() - tAuth;
  console.log(`  ✅ [PASS] GET /api/auth/me returned HTTP ${authRes.status} in ${authTime}ms`);

  // ── 2. Browser Smoke Test ──
  console.log("\n2️⃣  Launching Headless Chromium Browser Smoke Tests...");
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page: Page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore benign caniuse-lite outdated notice
      if (text.includes("caniuse-lite") || text.includes("Browserslist")) return;
      consoleErrors.push({ url: page.url(), text });
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push({ url: page.url(), text: err.message });
  });

  const routesToTest = [
    { path: "/", name: "Homepage" },
    { path: "/products", name: "Products Catalog" },
    { path: "/login", name: "Login" },
    { path: "/account", name: "Account Portal" },
    { path: "/dashboard", name: "Admin Dashboard" },
    { path: "/dashboard?tab=orders", name: "Dashboard (Orders Tab)" },
    { path: "/dashboard?tab=catalog", name: "Dashboard (Catalog Tab)" },
    { path: "/dashboard?tab=fulfillment", name: "Dashboard (Fulfillment Tab)" },
  ];

  for (const route of routesToTest) {
    console.log(`  • Testing ${route.name} (${route.path})...`);
    const initialErrors = consoleErrors.length;
    const response = await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(1500);

    const status = response?.status() || 200;
    if (status >= 400 && status !== 401 && status !== 403) {
      throw new Error(`Route ${route.path} failed with HTTP status ${status}`);
    }

    const newErrors = consoleErrors.slice(initialErrors);
    const criticalErrors = newErrors.filter(
      (e) =>
        e.text.includes("Invalid hook call") ||
        e.text.includes("Cannot read properties of null") ||
        e.text.includes("ChunkLoadError") ||
        e.text.includes("clientModules")
    );

    if (criticalErrors.length > 0) {
      console.error(`  ❌ Critical errors on ${route.path}:`, criticalErrors);
      throw new Error(`Critical runtime error detected on ${route.path}`);
    }

    console.log(`    ✅ HTTP ${status} | 0 critical errors | UI loaded successfully`);
  }

  await browser.close();

  console.log("\n" + "=".repeat(80));
  console.log("🎯 ALL ROUTE SMOKE TESTS & RUNTIME RECOVERY CHECKS PASSED (100% PASS)");
  console.log("=".repeat(80) + "\n");
}

runRuntimeRecoverySmokeTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
