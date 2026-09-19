const path = require("path");
const fs = require("fs");
const { chromium } = require(path.join(__dirname, "../frontend/node_modules/playwright"));

const VIEWPORTS = [
  { width: 320, height: 700, name: "mobile-320" },
  { width: 360, height: 740, name: "mobile-360" },
  { width: 375, height: 667, name: "mobile-375" },
  { width: 390, height: 844, name: "mobile-390" },
  { width: 414, height: 896, name: "mobile-414" },
  { width: 430, height: 932, name: "mobile-430" },
  { width: 768, height: 1024, name: "tablet-768" },
  { width: 1024, height: 768, name: "desktop-1024" },
  { width: 1280, height: 800, name: "desktop-1280" },
  { width: 1440, height: 900, name: "desktop-1440" },
];

(async () => {
  console.log("==================================================================");
  console.log("  CakeToHome — Phase 2 Storefront Multi-Viewport Runtime Audit   ");
  console.log("==================================================================\n");

  const screenshotsDir = path.join(__dirname, "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    url: "http://localhost:3000",
    viewports: {},
    allCssAndJsPassed: true,
    totalFailedCssJs: 0,
    totalConsoleErrors: 0,
    totalHydrationErrors: 0,
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Auditing Viewport: ${vp.width}x${vp.height} (${vp.name}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { "Cache-Control": "no-cache" }
    });

    const page = await context.newPage();
    const vpData = {
      viewport: vp,
      documentStatus: null,
      requests: {
        css: [],
        js: [],
        api: [],
        failed: [],
      },
      consoleErrors: [],
      consoleWarnings: [],
      pageErrors: [],
      hydrationErrors: [],
      horizontalOverflow: false,
      scrollWidth: 0,
      clientWidth: 0,
      headerAudit: null,
      cardAudit: null,
      screenshotPath: null,
    };

    page.on("request", (req) => {
      // track api requests
      if (req.url().includes("/api/")) {
        vpData.requests.api.push({ url: req.url(), method: req.method() });
      }
    });

    page.on("response", (res) => {
      const u = res.url();
      const status = res.status();
      const isCss = u.includes(".css") || res.headers()["content-type"]?.includes("text/css");
      const isJs = u.includes(".js") || res.headers()["content-type"]?.includes("javascript");

      if (isCss) {
        vpData.requests.css.push({ url: u, status });
      }
      if (isJs) {
        vpData.requests.js.push({ url: u, status });
      }
      if (status >= 400) {
        vpData.requests.failed.push({ url: u, status, isCss, isJs });
        if (isCss || isJs) {
          report.totalFailedCssJs++;
          report.allCssAndJsPassed = false;
          console.error(`  [FAIL ${status}] Asset: ${u}`);
        }
      }
    });

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error") {
        vpData.consoleErrors.push(text);
        report.totalConsoleErrors++;
        if (text.toLowerCase().includes("hydration") || text.toLowerCase().includes("hydrate")) {
          vpData.hydrationErrors.push(text);
          report.totalHydrationErrors++;
          console.error(`  [HYDRATION ERROR]: ${text}`);
        } else {
          console.warn(`  [Console Error]: ${text}`);
        }
      } else if (type === "warning") {
        vpData.consoleWarnings.push(text);
      }
    });

    page.on("pageerror", (err) => {
      vpData.pageErrors.push(err.message);
      if (err.message.toLowerCase().includes("hydration")) {
        vpData.hydrationErrors.push(err.message);
        report.totalHydrationErrors++;
      }
      console.error(`  [Page Error]: ${err.message}`);
    });

    try {
      const resp = await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
      vpData.documentStatus = resp ? resp.status() : null;
      await page.waitForTimeout(3000);

      // Measure layout overflow
      const overflowMetrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
        const clientW = window.innerWidth;
        return {
          scrollWidth: scrollW,
          clientWidth: clientW,
          hasOverflow: scrollW > clientW + 1,
        };
      });

      vpData.scrollWidth = overflowMetrics.scrollWidth;
      vpData.clientWidth = overflowMetrics.clientWidth;
      vpData.horizontalOverflow = overflowMetrics.hasOverflow;

      // Header Layout & Touch Target Verification
      vpData.headerAudit = await page.evaluate(() => {
        const header = document.querySelector("header");
        if (!header) return { present: false };

        const headerRect = header.getBoundingClientRect();
        const logo = header.querySelector('a[href="/"] img, a[href="/"] svg, [data-testid="brand-logo"]');
        const searchInput = header.querySelector('input[type="text"], input[type="search"], [data-testid="search-input"]');
        let locationBtn = header.querySelector('[data-testid="location-selector"], [data-testid="delivery-location-trigger"]');
        if (!locationBtn) {
          const btns = Array.from(header.querySelectorAll("button"));
          locationBtn = btns.find((b) => b.textContent && (b.textContent.includes("Bangalore") || b.textContent.includes("Deliver") || b.textContent.includes("Pincode"))) || null;
        }
        const cartBtn = header.querySelector('[data-testid="cart-button"], a[href="/cart"], button[aria-label*="cart" i]');
        const wishlistBtn = header.querySelector('[data-testid="wishlist-button"], a[href="/favorites"], a[href="/wishlist"]');

        let searchRect = searchInput ? searchInput.getBoundingClientRect() : null;
        let locationRect = locationBtn ? locationBtn.getBoundingClientRect() : null;
        let logoRect = logo ? logo.getBoundingClientRect() : null;

        let searchLocationOverlap = false;
        if (searchRect && locationRect && searchRect.width > 0 && locationRect.width > 0) {
          searchLocationOverlap = !(
            searchRect.right < locationRect.left ||
            searchRect.left > locationRect.right ||
            searchRect.bottom < locationRect.top ||
            searchRect.top > locationRect.bottom
          );
        }

        return {
          present: true,
          headerHeight: headerRect.height,
          logoWidth: logoRect ? logoRect.width : null,
          hasSearch: Boolean(searchInput),
          hasLocation: Boolean(locationBtn),
          hasCart: Boolean(cartBtn),
          hasWishlist: Boolean(wishlistBtn),
          searchLocationOverlap,
        };
      });

      // Product Card & Interaction Verification
      vpData.cardAudit = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[data-testid="product-card"], article, div.group'));
        const productCards = cards.filter(c => c.querySelector('a[href*="/products/"]'));
        let totalCards = productCards.length;
        let cardClickable = 0;
        let hasIsolatedOrderBtn = 0;
        let hasWishlistHeart = 0;

        productCards.forEach((card) => {
          const mainLink = card.querySelector('a[href*="/products/"]');
          if (mainLink) cardClickable++;

          // Check if there is an isolated separate order button
          const btns = Array.from(card.querySelectorAll("button, a"));
          const orderBtn = btns.find(b => b.textContent && b.textContent.trim().toLowerCase() === "order");
          if (orderBtn && !orderBtn.closest('a[href*="/products/"]')) {
            hasIsolatedOrderBtn++;
          }

          const wishBtn = card.querySelector('button[aria-label*="favorite" i], button[aria-label*="wishlist" i], button svg.lucide-heart');
          if (wishBtn) hasWishlistHeart++;
        });

        return {
          totalCards,
          cardClickable,
          hasIsolatedOrderBtn,
          hasWishlistHeart,
        };
      });

      // Capture screenshot
      const screenshotFilename = `viewport_${vp.width}x${vp.height}_${vp.name}.png`;
      const screenshotFilePath = path.join(screenshotsDir, screenshotFilename);
      await page.screenshot({ path: screenshotFilePath, fullPage: false });
      vpData.screenshotPath = screenshotFilePath;

      console.log(`  Document Status: ${vpData.documentStatus}`);
      console.log(`  CSS Assets: ${vpData.requests.css.length} | JS Assets: ${vpData.requests.js.length}`);
      console.log(`  Failed Assets: ${vpData.requests.failed.length}`);
      console.log(`  Console Errors: ${vpData.consoleErrors.length}`);
      console.log(`  Hydration Errors: ${vpData.hydrationErrors.length}`);
      console.log(`  Horizontal Overflow: ${vpData.horizontalOverflow ? "YES (" + vpData.scrollWidth + "px > " + vpData.clientWidth + "px)" : "NO (OK)"}`);
      console.log(`  Header Search/Location Overlap: ${vpData.headerAudit?.searchLocationOverlap ? "YES" : "NO"}`);
      console.log(`  Screenshot saved: ${screenshotFilename}`);

    } catch (err) {
      console.error(`  [FAIL in Viewport ${vp.name}]:`, err.message);
      vpData.pageErrors.push(err.message);
    } finally {
      report.viewports[vp.name] = vpData;
      await context.close();
    }
  }

  await browser.close();

  const evidenceFilePath = path.join(__dirname, "phase2_storefront_runtime_evidence.json");
  fs.writeFileSync(evidenceFilePath, JSON.stringify(report, null, 2));
  console.log(`\nAudit complete! Full evidence saved to: ${evidenceFilePath}`);
  console.log(`Summary: Total Failed CSS/JS = ${report.totalFailedCssJs}, Total Hydration Errors = ${report.totalHydrationErrors}`);
})();
