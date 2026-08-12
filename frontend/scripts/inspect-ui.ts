import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function inspectAllRoutes() {
  console.log("================================================================================");
  console.log("CAKETOHOME — COMPREHENSIVE PLATFORM UI & ROUTE VERIFIER");
  console.log("================================================================================\n");

  const screenshotDir = path.join(process.cwd(), "scripts", "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Set auth cookies for session
  await context.addCookies([
    { name: "_cth_jwt", value: "test_jwt_session_token_12345", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_role", value: "super_admin", domain: "localhost", path: "/" },
  ]);

  const routes = [
    { url: "http://localhost:3000/login", name: "login" },
    { url: "http://localhost:3000/dashboard", name: "dashboard" },
    { url: "http://localhost:3000/dashboard?tab=analytics", name: "dashboard-analytics" },
    { url: "http://localhost:3000/dashboard?tab=catalog", name: "dashboard-catalog" },
    { url: "http://localhost:3000/dashboard?tab=branches", name: "dashboard-branches" },
    { url: "http://localhost:3000/dashboard?tab=delivery", name: "dashboard-delivery" },
    { url: "http://localhost:3000/dashboard?tab=tax", name: "dashboard-tax" },
    { url: "http://localhost:3000/dashboard?tab=customers", name: "dashboard-customers" },
    { url: "http://localhost:3000/dashboard?tab=marketing", name: "dashboard-marketing" },
    { url: "http://localhost:3000/dashboard?tab=seo", name: "dashboard-seo" },
    { url: "http://localhost:3000/dashboard?tab=messaging", name: "dashboard-messaging" },
    { url: "http://localhost:3000/dashboard?tab=content", name: "dashboard-content" },
    { url: "http://localhost:3000/dashboard?tab=alerts", name: "dashboard-alerts" },
    { url: "http://localhost:3000/dashboard?tab=settings", name: "dashboard-settings" },
    { url: "http://localhost:3000/dashboard/shop", name: "shop" },
    { url: "http://localhost:3000/dashboard/shop/menu", name: "shop-menu" },
    { url: "http://localhost:3000/dashboard/delivery-partner", name: "delivery-partner" },
    { url: "http://localhost:3000/account", name: "account" },
    { url: "http://localhost:3000/products", name: "products" },
    { url: "http://localhost:3000/track", name: "track" },
    { url: "http://localhost:3000/", name: "storefront" },
  ];

  let passCount = 0;
  let failCount = 0;

  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    let cssLoaded = false;

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => networkErrors.push(`FAILED: ${req.url()} (${req.failure()?.errorText})`));
    page.on("response", (res) => {
      if (res.url().includes(".css") && res.status() === 200) {
        cssLoaded = true;
      }
    });

    try {
      const response = await page.goto(route.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1500);

      const status = response?.status();

      // Check styling on body and navigation
      const styleCheck = await page.evaluate(() => {
        const body = document.querySelector("body");
        const nav = document.querySelector("nav");
        const bodyStyle = body ? window.getComputedStyle(body) : null;
        const navStyle = nav ? window.getComputedStyle(nav) : null;
        const logoutButtons = Array.from(document.querySelectorAll("button, a")).filter(el => (el.textContent || "").includes("Logout"));

        return {
          fontFamily: bodyStyle?.fontFamily || "",
          bodyBg: bodyStyle?.backgroundColor || "",
          navDisplay: navStyle?.display || null,
          hasFlex: !!document.querySelector(".flex"),
          logoutCount: logoutButtons.length,
        };
      });

      const isInterOrSans = styleCheck.fontFamily.includes("Inter") || styleCheck.fontFamily.includes("sans-serif");
      const isStyled = isInterOrSans && status === 200;

      if (isStyled) {
        passCount++;
        console.log(`✅ PASS [${status}] ${route.url} — Styled (Font: ${styleCheck.fontFamily.slice(0, 30)}..., BodyBG: ${styleCheck.bodyBg})`);
      } else {
        failCount++;
        console.error(`❌ FAIL [${status}] ${route.url} — Unstyled or Error (Font: ${styleCheck.fontFamily})`);
      }

      const screenshotPath = path.join(screenshotDir, `${route.name}.png`);
      await page.screenshot({ path: screenshotPath });

    } catch (err: any) {
      failCount++;
      console.error(`❌ EXCEPTION on ${route.url}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log("\n================================================================================");
  console.log(`PLATFORM UI AUDIT COMPLETE: ${passCount}/${routes.length} ROUTES PASSED (Failures: ${failCount})`);
  console.log("================================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

inspectAllRoutes();
