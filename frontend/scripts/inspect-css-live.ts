import { chromium } from "playwright";

async function inspectLiveCss() {
  console.log("=== INSPECTING LIVE CSS ON http://localhost:3000 ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const failedRequests: string[] = [];
  const cssRequests: { url: string; status: number; size: number; contentType: string }[] = [];
  const consoleErrors: string[] = [];

  page.on("requestfailed", req => failedRequests.push(`${req.url()} (${req.failure()?.errorText})`));
  page.on("response", res => {
    if (res.request().resourceType() === "stylesheet" || res.url().includes(".css")) {
      cssRequests.push({
        url: res.url(),
        status: res.status(),
        size: Number(res.headers()["content-length"] || 0),
        contentType: res.headers()["content-type"] || "",
      });
    }
  });
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  console.log("\n1. Navigating to http://localhost:3000/ ...");
  const response = await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  console.log(`HTTP Status: ${response?.status()}`);

  console.log("\n2. CSS Requests Captured:");
  console.log(JSON.stringify(cssRequests, null, 2));

  console.log("\n3. Failed Requests:");
  console.log(JSON.stringify(failedRequests, null, 2));

  console.log("\n4. Console Errors:");
  console.log(JSON.stringify(consoleErrors, null, 2));

  console.log("\n5. DOM Computed Styles on Home:");
  const homeStyles = await page.evaluate(() => {
    const body = document.body;
    const computedBody = window.getComputedStyle(body);
    const nav = document.querySelector("nav") || document.querySelector("header");
    const computedNav = nav ? window.getComputedStyle(nav) : null;
    const button = document.querySelector("button");
    const computedButton = button ? window.getComputedStyle(button) : null;
    const h1 = document.querySelector("h1, h2, h3");
    const computedH1 = h1 ? window.getComputedStyle(h1) : null;

    return {
      bodyFontFamily: computedBody.fontFamily,
      bodyBg: computedBody.backgroundColor,
      bodyColor: computedBody.color,
      navBg: computedNav?.backgroundColor,
      navBorder: computedNav?.borderBottom,
      buttonBg: computedButton?.backgroundColor,
      buttonColor: computedButton?.color,
      buttonRadius: computedButton?.borderRadius,
      h1FontFamily: computedH1?.fontFamily,
      h1FontSize: computedH1?.fontSize,
      h1FontWeight: computedH1?.fontWeight,
      stylesheetsCount: document.styleSheets.length,
    };
  });
  console.log(JSON.stringify(homeStyles, null, 2));

  console.log("\n6. Navigating to http://localhost:3000/products ...");
  await page.goto("http://localhost:3000/products", { waitUntil: "networkidle" });
  const productsStyles = await page.evaluate(() => {
    const productCard = document.querySelector("[class*='product'], [class*='card'], article");
    const computedCard = productCard ? window.getComputedStyle(productCard) : null;
    return {
      cardBg: computedCard?.backgroundColor,
      cardBorder: computedCard?.border,
      cardRadius: computedCard?.borderRadius,
      stylesheetsCount: document.styleSheets.length,
    };
  });
  console.log(JSON.stringify(productsStyles, null, 2));

  await page.screenshot({ path: "test-artifacts/css-recovery/live-home-check.png", fullPage: false });
  await browser.close();
}

inspectLiveCss().catch(err => {
  console.error("Inspect failed:", err);
  process.exit(1);
});
