import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/494e1f14-65a8-4093-9062-5bdf6f901811";

const ROUTES = [
  { name: "homepage_no_popup", path: "/" },
  { name: "products_catalog", path: "/products" },
  { name: "cart", path: "/cart" },
  { name: "checkout", path: "/checkout" },
  { name: "dashboard", path: "/dashboard" },
  { name: "login", path: "/login" },
  { name: "track", path: "/track" },
  { name: "search", path: "/search" },
];

async function checkAllRoutes() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results: any[] = [];

  for (const r of ROUTES) {
    console.log(`Checking http://localhost:3000${r.path}...`);
    try {
      await page.goto(`http://localhost:3000${r.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000);

      // Dismiss popup if present
      try {
        const popupClose = page.locator("[role='dialog'] button[aria-label*='Close'], [role='dialog'] button:has-text('✕'), [role='dialog'] button:has-text('No thanks')").first();
        if (await popupClose.isVisible({ timeout: 1000 })) {
          await popupClose.click({ force: true });
          await page.waitForTimeout(300);
        }
      } catch (e) {}

      const computed = await page.evaluate(() => {
        const body = document.querySelector("body");
        const nav = document.querySelector("nav");
        const btn = document.querySelector("button, a.btn");
        const card = document.querySelector(".card, [class*='rounded'], [class*='shadow']");
        const h1 = document.querySelector("h1, h2");

        return {
          bodyFont: body ? window.getComputedStyle(body).fontFamily : "none",
          navBg: nav ? window.getComputedStyle(nav).backgroundColor : "none",
          h1Font: h1 ? window.getComputedStyle(h1).fontFamily : "none",
          btnBg: btn ? window.getComputedStyle(btn).backgroundColor : "none",
          btnRadius: btn ? window.getComputedStyle(btn).borderRadius : "none",
          hasTailwind: !!document.querySelector("[class*='bg-'], [class*='text-'], [class*='flex'], [class*='grid']"),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });

      const screenshotPath = path.join(ARTIFACT_DIR, `recovery_route_${r.name}.png`);
      await page.screenshot({ path: screenshotPath });

      results.push({
        route: r.path,
        name: r.name,
        computed,
        screenshot: `recovery_route_${r.name}.png`,
        status: "OK",
      });
    } catch (err: any) {
      results.push({
        route: r.path,
        name: r.name,
        error: err.message,
        status: "FAILED",
      });
    }
  }

  console.log("\n--- ROUTE AUDIT RESULTS ---");
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

checkAllRoutes().catch(console.error);
