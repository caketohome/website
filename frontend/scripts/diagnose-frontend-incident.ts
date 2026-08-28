import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function run() {
  console.log("=========================================================================");
  console.log("CakeToHome: Emergency Frontend Diagnostic & Network Audit");
  console.log("=========================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const failedRequests: Array<{ url: string; status?: number; statusText?: string; error?: string; contentType?: string }> = [];
  const allRequests: Array<{ url: string; status: number; contentType: string }> = [];
  const consoleMessages: Array<{ type: string; text: string }> = [];

  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      error: req.failure()?.errorText,
    });
  });

  page.on("response", (res) => {
    const status = res.status();
    const ct = res.headers()["content-type"] || "";
    allRequests.push({ url: res.url(), status, contentType: ct });
    if (status >= 400) {
      failedRequests.push({
        url: res.url(),
        status,
        statusText: res.statusText(),
        contentType: ct,
      });
    }
  });

  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  console.log("[Diagnostic] Navigating to http://localhost:3000/ ...");
  try {
    const response = await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 30000 });
    console.log(`[Diagnostic] Page status: ${response?.status()}`);
  } catch (err: any) {
    console.error(`[Diagnostic] Navigation error: ${err.message}`);
  }

  // Capture screenshot of current state
  const screenshotPath = path.resolve(__dirname, "../../qa/current-browser-broken-state.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[Diagnostic] Screenshot saved to: ${screenshotPath}`);

  // Evaluate DOM and styles
  const domInfo = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("link[rel='stylesheet'], link[as='style']")).map((l: any) => ({
      href: l.href,
      rel: l.rel,
    }));
    const styleTags = Array.from(document.querySelectorAll("style")).length;
    const stylesheetsCount = document.styleSheets.length;
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const bodyFont = window.getComputedStyle(document.body).fontFamily;
    const h1 = document.querySelector("h1");
    const h1Font = h1 ? window.getComputedStyle(h1).fontFamily : null;
    const h1Color = h1 ? window.getComputedStyle(h1).color : null;

    return {
      links,
      styleTags,
      stylesheetsCount,
      bodyBg,
      bodyFont,
      h1Font,
      h1Color,
      title: document.title,
      htmlLength: document.documentElement.outerHTML.length,
    };
  });

  console.log("\n--- DOM & STYLE INFO ---");
  console.log(JSON.stringify(domInfo, null, 2));

  console.log("\n--- FAILED REQUESTS (Status >= 400 or Network Failures) ---");
  if (failedRequests.length === 0) {
    console.log("No failed requests detected.");
  } else {
    failedRequests.forEach((f) => {
      console.log(`❌ [${f.status || "FAIL"}] ${f.url} (Type: ${f.contentType || "N/A"}, Error: ${f.error || "N/A"})`);
    });
  }

  console.log("\n--- CSS & JS ASSET REQUESTS ---");
  const assetReqs = allRequests.filter(r => r.url.includes(".css") || r.url.includes(".js") || r.url.includes("_next"));
  assetReqs.forEach(r => {
    console.log(`  [${r.status}] ${r.url} -> Content-Type: ${r.contentType}`);
  });

  console.log("\n--- BROWSER CONSOLE MESSAGES ---");
  consoleMessages.forEach((m) => {
    console.log(`  [${m.type.toUpperCase()}] ${m.text}`);
  });

  await browser.close();
}

run().catch((err) => {
  console.error("Diagnostic script error:", err);
  process.exit(1);
});
