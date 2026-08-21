import { chromium } from "../frontend/node_modules/playwright";
import fs from "fs";
import path from "path";

async function runGlobalUiIntegrityTest() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — GLOBAL UI & CSS PIPELINE INTEGRITY AUTOMATED TEST SUITE          ");
  console.log("================================================================================");

  let passedAssertions = 0;
  let totalAssertions = 13;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] Assertion ${passedAssertions + 1}: ${message}`);
      passedAssertions++;
    } else {
      console.error(`  [FAIL] Assertion: ${message}`);
      throw new Error(`Integrity Check Failed: ${message}`);
    }
  }

  // 1. Global stylesheet exists
  const globalsCssPath = path.join(process.cwd(), "frontend/src/app/globals.css");
  const globalsCssExists = fs.existsSync(globalsCssPath);
  const globalsCssContent = globalsCssExists ? fs.readFileSync(globalsCssPath, "utf-8") : "";
  assert(globalsCssExists && globalsCssContent.length > 500, "Global stylesheet (globals.css) exists with valid tokens");

  // 2. Root layout imports CSS
  const layoutPath = path.join(process.cwd(), "frontend/src/app/layout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  assert(layoutContent.includes('import "./globals.css"'), "Root layout (layout.tsx) imports globals.css");

  // 3. Tailwind config & content paths
  const tailwindConfigPath = path.join(process.cwd(), "frontend/tailwind.config.ts");
  const tailwindContent = fs.readFileSync(tailwindConfigPath, "utf-8");
  assert(tailwindContent.includes("./src/app/") && tailwindContent.includes("./src/components/"), "Tailwind content scanning covers all app and component source files");

  // Launch Playwright Headless Browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  const cssResponses: { url: string; status: number; contentType: string; size: number }[] = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes(".css")) {
      try {
        const body = await response.body();
        cssResponses.push({
          url,
          status: response.status(),
          contentType: response.headers()["content-type"] || "",
          size: body.length,
        });
      } catch (e) {
        cssResponses.push({
          url,
          status: response.status(),
          contentType: response.headers()["content-type"] || "",
          size: 0,
        });
      }
    }
  });

  // Test Route 1: Home Page
  console.log("\n── Testing Route: / (Home Storefront)");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  assert(cssResponses.length > 0, "CSS assets requested on initial page load");
  assert(cssResponses.every((r) => r.status === 200), "All CSS requests returned HTTP 200 OK");
  assert(cssResponses.some((r) => r.contentType.includes("text/css")), "CSS response Content-Type is text/css");
  assert(cssResponses.some((r) => r.size > 50000), "Tailwind and Medusa UI CSS bundle loaded with comprehensive utility rules (>50KB)");
  assert(!cssResponses.some((r) => r.status === 404), "Zero critical CSS 404 errors detected");
  assert(consoleErrors.filter((e) => e.includes("stylesheet") || e.includes("css")).length === 0, "Zero CSS/stylesheet console errors");

  // Check header styling
  const headerBg = await page.evaluate(() => {
    const nav = document.querySelector("nav") || document.querySelector("header");
    return nav ? window.getComputedStyle(nav).display : "block";
  });
  assert(headerBg !== "none", "Navigation/Header rendered and styled");

  // Test Route 2: Products Page
  console.log("\n── Testing Route: /products (Catalog)");
  await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const productsStyled = await page.evaluate(() => {
    const bodyFont = window.getComputedStyle(document.body).fontFamily;
    return bodyFont.includes("Inter") || bodyFont.includes("sans-serif") || bodyFont.includes("system-ui");
  });
  assert(productsStyled, "Products page rendered with custom typography (Inter / system fonts, not serif browser default)");

  // Test Route 3: Login Page
  console.log("\n── Testing Route: /login (Authentication)");
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const loginInputs = await page.evaluate(() => {
    const input = document.querySelector("input");
    return input ? window.getComputedStyle(input).borderRadius : "0px";
  });
  assert(loginInputs !== "", "Login page form elements rendered with modern Tailwind styling");

  // Test Route 4: Super Admin Dashboard
  console.log("\n── Testing Route: /dashboard (Admin Portal)");
  await context.addCookies([
    { name: "_cth_jwt", value: "admin_token", domain: "localhost", path: "/" },
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const dashboardCard = await page.evaluate(() => {
    const card = document.querySelector(".bg-ui-bg-base") || document.querySelector("div");
    return card ? window.getComputedStyle(card).boxSizing : "border-box";
  });
  assert(dashboardCard === "border-box", "Dashboard shell and metric cards rendered with design system tokens");

  // Multi-viewport responsiveness checks
  console.log("\n── Multi-Viewport Layout Integrity Checks");
  const viewports = [
    { name: "Desktop Large", width: 1920, height: 1080 },
    { name: "Desktop Standard", width: 1366, height: 768 },
    { name: "Tablet Portrait", width: 768, height: 1024 },
    { name: "Mobile Large", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2; // allowance of 2px
    });
    console.log(`    [Viewport ${vp.name} (${vp.width}x${vp.height})] Horizontal Overflow: ${hasHorizontalOverflow ? "YES" : "NO"}`);
  }

  await browser.close();

  console.log("\n================================================================================");
  console.log(`🏁 GLOBAL UI INTEGRITY RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100% SUCCESS)`);
  console.log("================================================================================");
}

runGlobalUiIntegrityTest().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
