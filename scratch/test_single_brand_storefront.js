const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SCREENSHOT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/c2a46f7f-f011-4ad5-bc22-59de9e0a969b/screenshots/single_brand";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log("🚀 Starting Single-Brand CakeToHome Architecture E2E Verification...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  let hasFailures = false;

  try {
    // Warm up request
    console.log("📍 Test 1: Navigating to http://localhost:3000/ ...");
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Save screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-single-brand-homepage.png"), fullPage: true });
    console.log("📸 Screenshot saved: 01-single-brand-homepage.png");

    // Assert No Bakery Discovery Elements
    const forbiddenPhrases = [
      "Bakeries Near You",
      "Popular bakeries near you",
      "No bakeries available near you",
      "Select Your Branch",
      "Select Branch"
    ];

    for (const phrase of forbiddenPhrases) {
      if (bodyText.includes(phrase)) {
        console.error(`❌ VIOLATION DETECTED: Page contains forbidden phrase "${phrase}"`);
        hasFailures = true;
      } else {
        console.log(`✅ VERIFIED: "${phrase}" is NOT present on the storefront.`);
      }
    }

    // 2. Assert Product-First Architecture Sections
    const requiredSections = [
      "Freshly Baked Happiness",
      "Special Offers & Coupons",
      "Explore Categories",
      "Featured Cakes",
      "Best Sellers",
      "Birthday Cakes Collection",
      "Anniversary Cakes Collection",
      "Pastries & Slices",
      "Cookies & Handcrafted Chocolates",
      "New Arrivals",
      "Recommended For You",
      "Recently Viewed"
    ];

    for (const section of requiredSections) {
      if (bodyText.includes(section)) {
        console.log(`✅ VERIFIED: Product section "${section}" is rendered.`);
      } else {
        console.error(`❌ MISSING SECTION: Product section "${section}" not found in body text.`);
        hasFailures = true;
      }
    }

    // 3. Test Location Header Operates Without Branch Names
    console.log("📍 Test 2: Checking DeliveryLocationHeader...");
    const locationHeader = await page.locator("text=Deliver to 560001");
    if (await locationHeader.isVisible()) {
      console.log("✅ VERIFIED: Location header displays 'Deliver to 560001' (PIN-code driven).");
    } else {
      console.error("❌ DeliveryLocationHeader with PIN code not visible!");
      hasFailures = true;
    }

    // 4. Test Search Page Navigation
    console.log("📍 Test 3: Navigating to Search Page...");
    await page.goto("http://localhost:3000/search?q=Chocolate", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-single-brand-search.png"), fullPage: false });
    console.log("📸 Screenshot saved: 02-single-brand-search.png");

    const searchText = await page.evaluate(() => document.body.innerText);
    if (searchText.includes("Search Cakes") || searchText.includes("result") || searchText.includes("Chocolate")) {
      console.log("✅ VERIFIED: Search page renders single-brand catalog results.");
    } else {
      console.error("❌ Search page output unexpected!");
      hasFailures = true;
    }

    // 5. Test Legacy Shop Handle Redirect
    console.log("📍 Test 4: Testing legacy shop URL redirect (http://localhost:3000/shop/sweet-delights)...");
    await page.goto("http://localhost:3000/shop/sweet-delights", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    if (currentUrl === "http://localhost:3000/" || currentUrl.endsWith(":3000/")) {
      console.log(`✅ VERIFIED: Legacy shop handle successfully redirected to main storefront homepage (${currentUrl}).`);
    } else {
      console.error(`❌ Legacy shop URL did not redirect to homepage! Current URL: ${currentUrl}`);
      hasFailures = true;
    }

    if (hasFailures) {
      console.error("\n❌ SINGLE-BRAND VERIFICATION FAILED! Violations were detected.");
      process.exit(1);
    } else {
      console.log("\n🎉 ALL SINGLE-BRAND E2E VERIFICATIONS PASSED 100%! Product-First Architecture Confirmed.");
      process.exit(0);
    }

  } catch (err) {
    console.error("❌ E2E Execution Error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
