import { chromium } from "playwright";

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const requests: any[] = [];
  const consoleMessages: any[] = [];
  const pageErrors: any[] = [];

  page.on("request", (req) => {
    requests.push({ url: req.url(), resourceType: req.resourceType(), method: req.method() });
  });

  page.on("response", (res) => {
    const matching = requests.find((r) => r.url === res.url());
    if (matching) {
      matching.status = res.status();
      matching.contentType = res.headers()["content-type"] || "";
      matching.size = res.headers()["content-length"] || "unknown";
    }
  });

  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on("pageerror", (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });

  console.log("Navigating to http://localhost:3000/...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 30000 });

  console.log("\n--- CSS REQUESTS ---");
  const cssReqs = requests.filter((r) => r.resourceType === "stylesheet" || r.url.includes(".css"));
  console.log(JSON.stringify(cssReqs, null, 2));

  console.log("\n--- FAILED REQUESTS (status != 200/304) ---");
  const failedReqs = requests.filter((r) => r.status && r.status >= 400);
  console.log(JSON.stringify(failedReqs, null, 2));

  console.log("\n--- CONSOLE ERRORS & WARNINGS ---");
  const errMsgs = consoleMessages.filter((c) => c.type === "error" || c.type === "warning");
  console.log(JSON.stringify(errMsgs, null, 2));

  console.log("\n--- PAGE ERRORS / UNCAUGHT EXCEPTIONS ---");
  console.log(JSON.stringify(pageErrors, null, 2));

  console.log("\n--- COMPUTED STYLES ON KEY ELEMENTS ---");
  const computed = await page.evaluate(() => {
    const body = document.querySelector("body");
    const nav = document.querySelector("nav");
    const h1 = document.querySelector("h1");
    const button = document.querySelector("button");

    return {
      body: body ? {
        fontFamily: window.getComputedStyle(body).fontFamily,
        backgroundColor: window.getComputedStyle(body).backgroundColor,
        color: window.getComputedStyle(body).color,
      } : null,
      nav: nav ? {
        backgroundColor: window.getComputedStyle(nav).backgroundColor,
        display: window.getComputedStyle(nav).display,
        height: window.getComputedStyle(nav).height,
      } : null,
      h1: h1 ? {
        fontFamily: window.getComputedStyle(h1).fontFamily,
        fontSize: window.getComputedStyle(h1).fontSize,
        color: window.getComputedStyle(h1).color,
      } : null,
      button: button ? {
        fontFamily: window.getComputedStyle(button).fontFamily,
        backgroundColor: window.getComputedStyle(button).backgroundColor,
        borderRadius: window.getComputedStyle(button).borderRadius,
      } : null,
    };
  });
  console.log(JSON.stringify(computed, null, 2));

  // Check scroll width
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  console.log("\n--- OVERFLOW CHECK ---");
  console.log(JSON.stringify(overflow, null, 2));

  await page.screenshot({ path: "C:/Users/alexc/.gemini/antigravity-ide/brain/494e1f14-65a8-4093-9062-5bdf6f901811/diagnose_homepage_current.png" });

  await browser.close();
}

diagnose().catch(console.error);
