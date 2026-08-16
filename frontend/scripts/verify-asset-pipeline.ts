import { chromium } from "playwright";
import * as path from "path";

interface AssetRecord {
  url: string;
  status: number;
  contentType: string;
  isOk: boolean;
}

async function runAssetPipelineAudit() {
  console.log("==================================================");
  console.log("  CAKETOHOME — FULL ASSET PIPELINE AUDIT (PHASE 9-13)");
  console.log("==================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Set Super Admin cookies for authenticated routes
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "jwt_super_admin_token", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "+91 98765 00000", domain: "localhost", path: "/" }
  ]);

  const page = await context.newPage();

  const routesToTest = [
    { path: "/dashboard", name: "Super Admin Dashboard" },
    { path: "/dashboard?tab=crm", name: "Dashboard CRM Tab" },
    { path: "/dashboard/shop", name: "Shop Manager Dashboard" },
    { path: "/dashboard/delivery-partner", name: "Delivery Partner Dashboard" },
    { path: "/", name: "Storefront Homepage" },
    { path: "/products", name: "Products Catalog" },
    { path: "/cart", name: "Shopping Cart" },
    { path: "/checkout", name: "Checkout Flow" },
    { path: "/login", name: "Login Portal" }
  ];

  let totalRoutesPassed = 0;
  let totalAssetsChecked = 0;
  let total404s = 0;
  let totalConsoleErrors = 0;

  for (const route of routesToTest) {
    console.log(`\n▶ Testing Route: ${route.path} (${route.name})`);
    const networkAssets: AssetRecord[] = [];
    const consoleErrors: string[] = [];

    const handleConsole = (msg: any) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    };
    const handleResponse = (resp: any) => {
      const url = resp.url();
      const ct = resp.headers()["content-type"] || "";
      if (url.includes("/_next/static/") || url.endsWith(".css") || url.endsWith(".js")) {
        networkAssets.push({
          url,
          status: resp.status(),
          contentType: ct,
          isOk: resp.status() < 400
        });
      }
    };

    page.on("console", handleConsole);
    page.on("response", handleResponse);

    const response = await page.goto(`http://localhost:3000${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // Wait a brief moment for dynamic chunks and CSS evaluation
    await page.waitForTimeout(2000);

    const pageStatus = response?.status() || 0;
    console.log(`  Document HTTP Status: ${pageStatus}`);

    // Check CSS computed styles
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    const fontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });

    // Check failed assets
    const failedAssets = networkAssets.filter((a) => !a.isOk);
    const cssAssets = networkAssets.filter((a) => a.url.includes(".css"));
    const jsAssets = networkAssets.filter((a) => a.url.includes(".js") || a.url.includes("/chunks/"));

    console.log(`  CSS Assets Loaded: ${cssAssets.length} (Failed: ${cssAssets.filter((a) => !a.isOk).length})`);
    console.log(`  JS Assets Loaded: ${jsAssets.length} (Failed: ${jsAssets.filter((a) => !a.isOk).length})`);
    console.log(`  Computed Body Background: ${bodyBg}`);
    console.log(`  Computed Font Family: ${fontFamily.slice(0, 40)}...`);

    if (failedAssets.length > 0) {
      console.log(`  ❌ FAILED ASSETS (${failedAssets.length}):`);
      failedAssets.forEach((f) => {
        console.log(`     [${f.status}] ${f.url} (Content-Type: ${f.contentType})`);
      });
      total404s += failedAssets.length;
    } else {
      console.log(`  ✅ All ${networkAssets.length} assets loaded successfully with 200/304!`);
    }

    if (consoleErrors.length > 0) {
      console.log(`  ⚠️ Console Errors (${consoleErrors.length}):`);
      consoleErrors.forEach((e) => console.log(`     ${e.slice(0, 100)}`));
      totalConsoleErrors += consoleErrors.length;
    } else {
      console.log(`  ✅ Zero console errors!`);
    }

    totalAssetsChecked += networkAssets.length;

    if (pageStatus === 200 && failedAssets.length === 0) {
      totalRoutesPassed++;
      console.log(`  🎉 ROUTE RESULT: PASS`);
    } else {
      console.log(`  ❌ ROUTE RESULT: FAIL`);
    }

    page.off("console", handleConsole);
    page.off("response", handleResponse);
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("  SUMMARY AUDIT REPORT");
  console.log("==================================================");
  console.log(`Total Routes Tested: ${routesToTest.length}`);
  console.log(`Routes Passed: ${totalRoutesPassed} / ${routesToTest.length}`);
  console.log(`Total Static Assets Checked: ${totalAssetsChecked}`);
  console.log(`Total 404 Assets: ${total404s}`);
  console.log(`Total Console Errors: ${totalConsoleErrors}`);

  if (total404s === 0 && totalRoutesPassed === routesToTest.length) {
    console.log("\n>>> ALL CHECKS PASSED: Asset Serving & Pipeline is 100% HEALTHY! <<<");
  } else {
    console.log("\n>>> AUDIT FAILED: Review asset errors above. <<<");
    process.exit(1);
  }
}

runAssetPipelineAudit().catch((err) => {
  console.error("Audit Execution Error:", err);
  process.exit(1);
});
