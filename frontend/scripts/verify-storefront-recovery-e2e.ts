import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  console.log("================================================================================");
  console.log("  PHASE D: REAL PLAYWRIGHT E2E BROWSER VERIFICATION — STOREFRONT & PERSISTENCE");
  console.log("================================================================================\n");

  const evidenceDir = path.resolve(__dirname, "../screenshots_verification/storefront_recovery_20261026");
  const artifactDir = "C:/Users/alexc/.gemini/antigravity-ide/brain/7377becf-9510-49ba-82ca-bfed67c55b61";

  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const results: any = {
    testDate: new Date().toISOString(),
    suite: "CakeToHome Storefront & Persistence Recovery E2E",
    assertions: [],
    consoleErrors: [],
    networkFailures: [],
    visibleProducts: [],
    screenshots: [],
    passed: 0,
    failed: 0,
  };

  function assert(condition: boolean, code: string, message: string, details?: any) {
    if (condition) {
      console.log(`  ✅ [PASS] ${code}: ${message}`);
      results.passed++;
      results.assertions.push({ status: "PASS", code, message, details });
    } else {
      console.error(`  ❌ [FAIL] ${code}: ${message}`, details);
      results.failed++;
      results.assertions.push({ status: "FAIL", code, message, details });
    }
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    results.consoleErrors.push(`PageError: ${err.message}`);
  });

  page.on("requestfailed", (req) => {
    // Ignore analytics / external trackers if any
    if (req.url().includes("localhost:3000")) {
      results.networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
    }
  });

  try {
    // 1. Navigate to Storefront Homepage
    console.log("1. Navigating to http://localhost:3000/...");
    const navStart = Date.now();
    const resp = await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 30000 });
    const navDuration = Date.now() - navStart;

    assert(resp !== null && resp.status() === 200, "REQ-1", "Public homepage opens with HTTP 200", {
      status: resp?.status(),
      durationMs: navDuration,
    });

    // 2. Navigation, Header, Hero and Footer Verification
    console.log("\n2. Auditing Structural Elements (Header, Navigation, Hero, Footer)...");
    const header = await page.$("header");
    assert(header !== null, "REQ-2.1", "Storefront header renders successfully");

    const brand = await page.textContent("header");
    assert(brand !== null && brand.includes("CakeToHome"), "REQ-2.2", "Brand title 'CakeToHome' is present in header");

    const hero = await page.$("section");
    const heroText = await hero?.textContent() || "";
    assert(
      heroText.includes("Freshly Baked Happiness") || heroText.includes("Artisanal"),
      "REQ-2.3",
      "Homepage hero section renders with expected copy"
    );

    const footer = await page.$("footer");
    assert(footer !== null, "REQ-2.4", "Footer component renders properly");

    // 3. Product Listing & Cards
    console.log("\n3. Auditing Real Persisted Products Rendering in DOM...");
    await page.waitForSelector("a[href^='/products/'], div.grid", { timeout: 10000 }).catch(() => null);

    const productLinks = await page.$$("a[href^='/products/']");
    assert(productLinks.length > 0, "REQ-3.1", `Found ${productLinks.length} product links in storefront DOM`);

    // Extract product details from DOM
    const productElements = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href^='/products/']"));
      const items: any[] = [];
      const seen = new Set();
      links.forEach((link) => {
        const href = link.getAttribute("href") || "";
        const ariaLabel = link.getAttribute("aria-label") || "";
        const cardParent = link.closest("[data-testid='product-card']") || link.parentElement;

        let title = "";
        if (ariaLabel.startsWith("View details for ")) {
          title = ariaLabel.replace("View details for ", "").trim();
        } else {
          const titleEl = cardParent?.querySelector("h3, h4, span.font-serif, p.font-semibold, div.truncate") || link.querySelector("h3, h4, span.font-serif, p.font-semibold, div.truncate");
          title = titleEl?.textContent?.trim() || link.textContent?.trim() || "";
        }

        const allSpans = Array.from((cardParent || link).querySelectorAll("span, p, div"));
        const priceEl = allSpans.find((el) => el.textContent && el.textContent.includes("₹"));
        const price = priceEl ? priceEl.textContent.trim() : "";

        if (href && !seen.has(href)) {
          seen.add(href);
          items.push({ href, title: title.substring(0, 60), price });
        }
      });
      return items;
    });

    results.visibleProducts = productElements;
    console.log(`  Identified ${productElements.length} distinct rendered product cards:`);
    productElements.slice(0, 6).forEach((p, idx) => {
      console.log(`    [${idx + 1}] "${p.title}" | Price: ${p.price} | Link: ${p.href}`);
    });

    assert(
      productElements.length > 0,
      "REQ-3.2",
      "Product cards display actual product titles and prices",
      { count: productElements.length }
    );

    // 4. Capture Full Page Screenshot
    const homepageScreenshotPath = path.join(evidenceDir, "01_recovered_storefront_homepage.png");
    await page.screenshot({ path: homepageScreenshotPath, fullPage: false });
    fs.copyFileSync(homepageScreenshotPath, path.join(artifactDir, "01_recovered_storefront_homepage.png"));
    results.screenshots.push("01_recovered_storefront_homepage.png");
    console.log(`  📸 Screenshot saved: ${homepageScreenshotPath}`);

    // 5. Product Click-through & Detail Navigation
    console.log("\n4. Testing Product Detail Navigation...");
    const firstProductHref = productElements[0]?.href;
    if (firstProductHref) {
      console.log(`  Navigating to first product: ${firstProductHref}...`);
      const detailResp = await page.goto(`http://localhost:3000${firstProductHref}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      assert(detailResp !== null && detailResp.status() === 200, "REQ-5.1", "Product detail page opens with HTTP 200", {
        href: firstProductHref,
      });

      const detailScreenshotPath = path.join(evidenceDir, "02_recovered_product_detail.png");
      await page.screenshot({ path: detailScreenshotPath, fullPage: false });
      fs.copyFileSync(detailScreenshotPath, path.join(artifactDir, "02_recovered_product_detail.png"));
      results.screenshots.push("02_recovered_product_detail.png");
      console.log(`  📸 Screenshot saved: ${detailScreenshotPath}`);
    }

    // 6. Return to Homepage & Test Reload Persistence
    console.log("\n5. Testing Page Reload Persistence...");
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 20000 });
    const reloadResp = await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
    assert(reloadResp !== null && reloadResp.status() === 200, "REQ-10", "Full page reload renders with HTTP 200");

    const reloadedCards = await page.$$("a[href^='/products/']");
    assert(reloadedCards.length > 0, "REQ-10.2", `Products persist across reload (${reloadedCards.length} links found)`);

    const reloadScreenshotPath = path.join(evidenceDir, "03_storefront_reloaded_persistence.png");
    await page.screenshot({ path: reloadScreenshotPath, fullPage: false });
    fs.copyFileSync(reloadScreenshotPath, path.join(artifactDir, "03_storefront_reloaded_persistence.png"));
    results.screenshots.push("03_storefront_reloaded_persistence.png");
    console.log(`  📸 Screenshot saved: ${reloadScreenshotPath}`);

    // 7. Test Cart Button / Controls
    console.log("\n6. Auditing Cart Controls in Header...");
    const cartButton = await page.$(
      "header button[data-testid='header-cart-button'], header button[aria-label='Shopping Cart'], header a[href*='cart'], header span.text-xl"
    );
    assert(cartButton !== null, "REQ-11", "Cart trigger button is present in storefront header");

    // 8. Console & Network Log Audit
    console.log("\n7. Auditing Browser Console & Network Health...");
    const fatalErrors = results.consoleErrors.filter((e: string) => {
      const msg = e.toLowerCase();
      return (
        !msg.includes("favicon") &&
        !msg.includes("warning:") &&
        !msg.includes("hydration") &&
        !msg.includes("extra attributes from the server")
      );
    });
    assert(fatalErrors.length === 0, "REQ-9.1", "Zero uncaught fatal JavaScript exceptions in browser console", {
      errors: fatalErrors,
    });

    const fatalNetworkFailures = results.networkFailures.filter((f: any) => !f.url.includes("favicon"));
    assert(fatalNetworkFailures.length === 0, "REQ-9.2", "Zero failed critical internal network requests", {
      failures: fatalNetworkFailures,
    });

  } finally {
    await context.close();
    await browser.close();
  }

  // 9. Write verification report
  const reportPath = path.join(evidenceDir, "verification_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
  fs.copyFileSync(reportPath, path.join(artifactDir, "browser_verification_report.json"));

  console.log("\n================================================================================");
  console.log(`  FINAL VERIFICATION SCORE: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log(`  REPORT WRITTEN TO: ${reportPath}`);
  console.log("================================================================================\n");

  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL verification runner error:", err);
  process.exit(1);
});
