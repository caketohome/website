import { chromium } from "../frontend/node_modules/playwright";
import type { Browser, Page } from "../frontend/node_modules/playwright";
import { ApiEngine } from "../frontend/src/lib/api-engine";
import { searchProducts } from "../frontend/src/lib/data/catalog";
import * as https from "https";

interface Assertion {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: Assertion[] = [];

function assert(id: number, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: Boolean(condition), details });
  const icon = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${icon} [Assertion ${id}]: ${name} - ${details}`);
}

function checkImage(url: string): Promise<number> {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode || 0);
    }).on("error", () => {
      resolve(0);
    });
  });
}

async function runFilterUiE2E() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — PRODUCT FILTER UI & PRODUCT GRID FINAL VERIFICATION E2E SUITE   ");
  console.log("================================================================================\n");

  // ── 1. BACKEND & DATA LAYER VALIDATION ────────────────────────────────────
  console.log("[PHASE 1] Validating Canonical Data Models & Server-Side Filtering...");

  const allProds = ApiEngine.getProducts();
  assert(1, "Database Products Loaded", allProds.length >= 5, `Total products: ${allProds.length}`);

  const categories = ApiEngine.getCategories();
  assert(2, "Canonical Categories Loaded", categories.length >= 6, `Total categories: ${categories.length}`);

  // Test Chocolate Category Filter
  const chocProds = ApiEngine.getProducts({ category: "chocolate-cakes" });
  const hasBelgian = chocProds.some((p: any) => p.id === "prod_1");
  const hasBlackForest = chocProds.some((p: any) => p.id === "prod_4");
  assert(3, "Chocolate Cakes Filter (ApiEngine)", hasBelgian && hasBlackForest && chocProds.length === 2, `Chocolate count: ${chocProds.length}`);

  // Test Fruit Mousse Filter
  const mangoProds = ApiEngine.getProducts({ category: "fruit-mousse-cakes" });
  assert(4, "Fruit Mousse Filter (ApiEngine)", mangoProds.some((p: any) => p.id === "prod_3"), `Mango count: ${mangoProds.length}`);

  // Test searchProducts data layer
  const searchChoc = await searchProducts({ category: "chocolate-cakes" });
  assert(5, "searchProducts Category Filter", searchChoc.results.length === 2, `searchProducts count: ${searchChoc.results.length}`);

  // Test Combined Multi-Filter Matrix
  const multiSearch = await searchProducts({ category: "chocolate-cakes", flavour: "Chocolate", min_price: 600 });
  assert(6, "Combined Filter (Category + Flavour + Price)", multiSearch.results.length === 1 && multiSearch.results[0].product_id === "prod_1", `Multi-filter count: ${multiSearch.results.length}`);

  // Test Image URLs for all 5 products
  console.log("\n[PHASE 2] Validating Product Images (HTTP 200 & High-Res CDN)...");
  let imagesOk = true;
  for (const p of allProds) {
    const status = await checkImage(p.thumbnail);
    if (status !== 200) imagesOk = false;
  }
  assert(7, "All 5 Product Images Return HTTP 200", imagesOk, "All product thumbnails verified");

  // ── 3. PLAYWRIGHT REAL BROWSER TESTING ────────────────────────────────────
  console.log("\n[PHASE 3] Launching Playwright Chromium for Real Browser UI Verification...");
  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // ── DESKTOP VIEWPORT ────────────────────────────────────────────────────
    console.log("  >>> Testing Desktop Viewport (1280x800)...");
    const page: Page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("div[data-hydrated='true']", { timeout: 25000 });
    await page.waitForSelector("div[role='link']", { timeout: 20000 });

    // Check heading
    const heading = await page.textContent("h1");
    assert(8, "Desktop Heading Renders", Boolean(heading && heading.includes("Handcrafted Gourmet Cakes")), `Heading: "${heading?.trim()}"`);

    // Check zero infinite skeletons: product cards rendered immediately
    const cards = await page.$$("div[role='link']");
    assert(9, "Zero Infinite Skeletons - Real Products Rendered", cards.length >= 5, `Rendered ${cards.length} product tiles`);

    // Check no purple/violet segmented category controls exist
    const violetSegmented = await page.$(".bg-gradient-to-r.from-purple-600, .bg-purple-600.segmented");
    assert(10, "No Violet/Purple Segmented Category Controls", violetSegmented === null, "Verified clean neutral filter layout");

    // Check non-functional dietary filters removed
    const sugarFreeSwitch = await page.$("text=Sugar-Free");
    const glutenFreeSwitch = await page.$("text=Gluten-Free");
    assert(11, "Non-Functional Dietary Switches Removed", sugarFreeSwitch === null && glutenFreeSwitch === null, "Dietary switches audited & purged");

    // Check Cake Category selector is standard select with counts
    const categorySelect = page.locator("aside select[data-testid='category-select']");
    const selectOptions = await categorySelect.locator("option").allTextContents();
    const hasChocOption = selectOptions.some((o) => o.includes("Chocolate Cakes"));
    assert(12, "Neutral Category Selector with Real Taxonomy", hasChocOption, `Options: ${selectOptions.slice(0, 4).join(", ")}`);

    // Select Chocolate Cakes
    await categorySelect.selectOption("chocolate-cakes");
    // Wait for the non-chocolate cakes to detach
    await page.waitForSelector("div[role='link']:has-text('Mango')", { state: "detached", timeout: 15000 });
    await page.waitForSelector("div[role='link']:has-text('Belgian Chocolate Truffle')", { timeout: 15000 });

    // Verify URL sync
    const urlChoc = page.url();
    assert(13, "URL Syncs on Category Selection", urlChoc.includes("category=chocolate-cakes"), `URL: ${urlChoc}`);

    // Verify filtered product count (2 chocolate cakes)
    const filteredCards = await page.$$("div[role='link']");
    const titles = await page.$$eval("div[role='link'] h3", (elements) => elements.map((el) => el.textContent?.trim() || ""));
    assert(14, "Filtered Grid Shows Only Chocolate Cakes", filteredCards.length === 2 && titles.some((t) => t.includes("Chocolate")), `Filtered: ${titles.join(" | ")}`);

    // Verify Active Filter Chip
    const activeChip = await page.$("text=Category: Chocolate Cakes");
    assert(15, "Active Filter Chip Renders", Boolean(activeChip), "Active chip found");

    // Reset Filter to All
    await categorySelect.selectOption("all");
    await page.waitForSelector("div[role='link']:has-text('Mango')", { timeout: 15000 });
    const restoredCards = await page.$$("div[role='link']");
    assert(16, "Clear Filter Restores Catalog", restoredCards.length >= 5, `Restored ${restoredCards.length} products`);

    await page.close();

    // ── TABLET VIEWPORT (768x1024) ──────────────────────────────────────────
    console.log("  >>> Testing Tablet Viewport (768x1024)...");
    const tabletPage: Page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await tabletPage.goto("http://localhost:3000/products?category=fruit-mousse-cakes", { waitUntil: "domcontentloaded", timeout: 45000 });
    await tabletPage.waitForSelector("div[data-hydrated='true']", { timeout: 25000 });
    await tabletPage.waitForSelector("div[role='link']", { timeout: 20000 });

    const tabletCards = await tabletPage.$$("div[role='link']");
    const tabletTitles = await tabletPage.$$eval("div[role='link'] h3", (elements) => elements.map((el) => el.textContent?.trim() || ""));
    assert(17, "Tablet SSR with URL Category Param Loads Filtered Product", tabletCards.length === 1 && tabletTitles[0].includes("Mango"), `Tablet product: ${tabletTitles[0]}`);

    await tabletPage.close();

    // ── MOBILE VIEWPORT (390x844) ───────────────────────────────────────────
    console.log("  >>> Testing Mobile Viewport (iPhone 14 - 390x844)...");
    const mobilePage: Page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobilePage.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 45000 });
    await mobilePage.waitForSelector("div[data-hydrated='true']", { timeout: 25000 });
    await mobilePage.waitForSelector("div[role='link']", { timeout: 20000 });

    // Open Mobile Drawer
    const mobileFilterBtn = mobilePage.locator("button[data-testid='mobile-filter-button']");
    await mobileFilterBtn.click();
    const drawer = mobilePage.locator("div[data-testid='mobile-filter-drawer']");
    await drawer.waitFor({ state: "visible", timeout: 15000 });
    assert(18, "Mobile Filter Drawer Opens Cleanly", true, "Mobile filter modal rendered");

    // Select Red Velvet in drawer
    const drawerCategorySelect = drawer.locator("select[data-testid='category-select']");
    await drawerCategorySelect.selectOption("red-velvet-cakes");
    await mobilePage.waitForTimeout(300);

    // Apply Filters
    const applyBtn = drawer.locator("button:has-text('Apply Filters')");
    await applyBtn.click();
    await mobilePage.waitForSelector("div[role='link']:has-text('Red Velvet')", { timeout: 15000 });
    await mobilePage.waitForSelector("div[role='link']:has-text('Belgian Chocolate')", { state: "detached", timeout: 15000 });

    const mobileTitles = await mobilePage.$$eval("div[role='link'] h3", (elements) => elements.map((el) => el.textContent?.trim() || ""));
    assert(19, "Mobile Filter Drawer Filters by Red Velvet", mobileTitles.some((t) => t.includes("Red Velvet")), `Mobile title: ${mobileTitles.join(" | ")}`);

    // Verify Mango Cake Image in mobile grid
    await mobilePage.goto("http://localhost:3000/products?category=fruit-mousse-cakes", { waitUntil: "domcontentloaded", timeout: 45000 });
    await mobilePage.waitForSelector("div[data-hydrated='true']", { timeout: 25000 });
    await mobilePage.waitForSelector("div[role='link']", { timeout: 20000 });
    const mangoImg = await mobilePage.$("img[alt*='Mango']");
    const mangoSrc = await mangoImg?.getAttribute("src");
    assert(20, "Mobile Product Image Renders Verified CDN URL", Boolean(mangoSrc && mangoSrc.includes("photo-1588195538326-c5b1e9f80a1b")), `Src: ${mangoSrc}`);

    await mobilePage.close();

  } catch (err: any) {
    console.error("FATAL ERROR in Playwright E2E:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`  FILTER UI & PRODUCT GRID RESULTS: ${passed} / ${total} ASSERTIONS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runFilterUiE2E().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
