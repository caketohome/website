/**
 * CakeToHome — Global Web App Scroll Test Suite
 * Performs real mouse-wheel scrolling (`page.mouse.wheel()`) across ALL major application routes
 * and multiple viewport (x, y) coordinates to prove true 2-level global document page scrolling.
 */

import { chromium } from "playwright";

interface RouteTestResult {
  route: string;
  name: string;
  scrollHeight: number;
  clientHeight: number;
  initialScrollY: number;
  scrollYAfterWheel1: number;
  scrollYAfterWheel2: number;
  scrollYAfterWheelUp: number;
  pass: boolean;
  notes: string;
}

async function runGlobalScrollTestSuite() {
  console.log("===============================================================");
  console.log("CAKETOHOME — GLOBAL WEB APP REAL MOUSE WHEEL TEST SUITE");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const routesToTest = [
    { name: "Dashboard Overview / Orders", path: "/dashboard?tab=orders" },
    { name: "Catalog Management", path: "/dashboard?tab=catalog" },
    { name: "Branches & Fulfillment Hubs", path: "/dashboard?tab=branches" },
    { name: "Delivery Partner & Fleet Ops", path: "/dashboard?tab=delivery" },
    { name: "Customer CRM", path: "/dashboard?tab=crm" },
    { name: "Marketing & Promotions", path: "/dashboard?tab=marketing" },
    { name: "SEO & Digital Engine", path: "/dashboard?tab=seo" },
    { name: "Marketing Automation", path: "/dashboard?tab=automation" },
    { name: "CMS Page Configurator", path: "/dashboard?tab=cms" },
    { name: "Analytics & Reports", path: "/dashboard?tab=analytics" },
    { name: "Notifications Center", path: "/dashboard?tab=notifications" },
    { name: "System Settings", path: "/dashboard?tab=settings" },
    { name: "Storefront Home Page", path: "/" },
  ];

  const results: RouteTestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of routesToTest) {
    console.log(`---------------------------------------------------------------`);
    console.log(`TESTING ROUTE: ${r.name} (${r.path})`);
    console.log(`---------------------------------------------------------------`);

    await page.goto(`http://localhost:3000${r.path}`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const metrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      initialScrollY: window.scrollY,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
    }));

    console.log(`  Metrics -> scrollHeight: ${metrics.scrollHeight}px | clientHeight: ${metrics.clientHeight}px | initial scrollY: ${metrics.initialScrollY}px`);
    console.log(`  CSS Overflow -> body: ${metrics.bodyOverflow} | html: ${metrics.htmlOverflow}`);

    // If page content height is smaller than clientHeight, page doesn't need vertical scroll
    const isNaturallyLong = metrics.scrollHeight > metrics.clientHeight;

    if (!isNaturallyLong) {
      console.log(`  ℹ️ Page height (${metrics.scrollHeight}px) fits within viewport (${metrics.clientHeight}px) — No page scroll required.`);
      results.push({
        route: r.path,
        name: r.name,
        scrollHeight: metrics.scrollHeight,
        clientHeight: metrics.clientHeight,
        initialScrollY: metrics.initialScrollY,
        scrollYAfterWheel1: 0,
        scrollYAfterWheel2: 0,
        scrollYAfterWheelUp: 0,
        pass: true,
        notes: "Fits in viewport naturally (No scrollbar needed)",
      });
      totalPassed++;
      continue;
    }

    // Step 1: Real wheel scroll down #1 (delta 700)
    await page.mouse.move(500, 400);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(400);
    const scrollYAfterWheel1 = await page.evaluate(() => window.scrollY);

    // Step 2: Real wheel scroll down #2 (delta 700)
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(400);
    const scrollYAfterWheel2 = await page.evaluate(() => window.scrollY);

    // Step 3: Real wheel scroll up (delta -1400) over outer page margin (x: 20, y: 300)
    await page.mouse.move(20, 300);
    await page.mouse.wheel(0, -1400);
    await page.waitForTimeout(400);
    const scrollYAfterWheelUp = await page.evaluate(() => window.scrollY);

    const passWheelDown1 = scrollYAfterWheel1 > metrics.initialScrollY;
    const passWheelDown2 = scrollYAfterWheel2 >= scrollYAfterWheel1;
    const passWheelUp = scrollYAfterWheelUp === 0;

    const pass = passWheelDown1 && passWheelDown2 && passWheelUp;

    if (pass) {
      console.log(`  ✅ PASS -> Wheel Down #1: +${scrollYAfterWheel1}px | Wheel Down #2: +${scrollYAfterWheel2}px | Wheel Up: ${scrollYAfterWheelUp}px`);
      totalPassed++;
    } else {
      console.error(`  ❌ FAIL -> Wheel Down #1: ${scrollYAfterWheel1}px | Wheel Down #2: ${scrollYAfterWheel2}px | Wheel Up: ${scrollYAfterWheelUp}px`);
      totalFailed++;
    }

    results.push({
      route: r.path,
      name: r.name,
      scrollHeight: metrics.scrollHeight,
      clientHeight: metrics.clientHeight,
      initialScrollY: metrics.initialScrollY,
      scrollYAfterWheel1,
      scrollYAfterWheel2,
      scrollYAfterWheelUp,
      pass,
      notes: pass ? "Real mouse wheel scrolls document fluently" : "Scroll locked or mouse wheel trapped",
    });
  }

  // Multi-coordinate test for coordinate matrix: x={50, 500, 900, 1400}, y={200, 500, 800} on Catalog page
  console.log("\n===============================================================");
  console.log("TESTING VIEWPORT COORDINATE MATRIX ON /dashboard?tab=catalog");
  console.log("===============================================================\n");

  await page.goto("http://localhost:3000/dashboard?tab=catalog", { waitUntil: "load" });
  await page.waitForTimeout(2000);

  const xCoords = [50, 500, 900, 1400];
  const yCoords = [200, 500, 800];
  let matrixPass = 0;
  let matrixFail = 0;

  for (const x of xCoords) {
    for (const y of yCoords) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(300);
      const scrolled = await page.evaluate(() => window.scrollY);
      const ok = scrolled > 100;
      if (ok) {
        console.log(`  ✅ [PASS] Wheel at (x: ${x}, y: ${y}) -> window.scrollY = ${scrolled}px`);
        matrixPass++;
      } else {
        console.error(`  ❌ [FAIL] Wheel at (x: ${x}, y: ${y}) -> window.scrollY = ${scrolled}px`);
        matrixFail++;
      }
    }
  }

  await browser.close();

  // Print Summary Table
  console.log("\n===============================================================");
  console.log("GLOBAL SCROLL TEST SUITE SUMMARY MATRIX");
  console.log("===============================================================\n");

  console.table(
    results.map((r) => ({
      "Route": r.route,
      "Name": r.name,
      "scrollHeight": `${r.scrollHeight}px`,
      "clientHeight": `${r.clientHeight}px`,
      "Wheel Down #1": `${r.scrollYAfterWheel1}px`,
      "Wheel Down #2": `${r.scrollYAfterWheel2}px`,
      "Wheel Up": `${r.scrollYAfterWheelUp}px`,
      "Status": r.pass ? "PASS ✅" : "FAIL ❌",
      "Notes": r.notes,
    }))
  );

  console.log(`\nROUTE TESTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log(`COORDINATE MATRIX TESTS: ${matrixPass} PASSED, ${matrixFail} FAILED (TOTAL: ${matrixPass + matrixFail})`);
  console.log("===============================================================\n");

  if (totalFailed > 0 || matrixFail > 0) {
    process.exit(1);
  }
}

runGlobalScrollTestSuite().catch((err) => {
  console.error("Global scroll test suite execution failed:", err);
  process.exit(1);
});
