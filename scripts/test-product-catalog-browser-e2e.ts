import { chromium } from "../frontend/node_modules/playwright";
import type { Browser, Page } from "../frontend/node_modules/playwright";

interface AssertionResult {
  id: number;
  description: string;
  passed: boolean;
  details: string;
}

const assertions: AssertionResult[] = [];

function assert(id: number, description: string, condition: boolean, details: string) {
  assertions.push({ id, description, passed: Boolean(condition), details });
  const icon = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${icon} [Assertion ${id}]: ${description} (${details})`);
}

async function runBrowserE2E() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — PRODUCT CATALOG & CATEGORY FILTER BROWSER PLAYWRIGHT E2E SUITE   ");
  console.log("================================================================================\n");

  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // ── 1. DESKTOP VIEWPORT ──────────────────────────────────────────────────
    console.log("[PHASE 1] Testing Desktop Catalog (/products) at 1280x800...");
    const page: Page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("div[data-hydrated='true']", { timeout: 25000 });
    await page.waitForSelector("div[role='link']", { timeout: 20000 });

    // Check heading
    const heading = await page.textContent("h1");
    assert(1, "Catalog Page Heading Renders", Boolean(heading && heading.toLowerCase().includes("handcrafted")), `Heading: "${heading?.trim()}"`);

    // Check initial product count
    const initialCards = await page.$$("div[role='link']");
    assert(2, "Product Cards Rendered", initialCards.length >= 5, `Found ${initialCards.length} product tiles`);

    // Check Mango Cake image is present and not broken
    const mangoImg = await page.$("img[alt*='Mango']");
    const mangoSrc = await mangoImg?.getAttribute("src");
    const isMangoLoaded = Boolean(mangoSrc && mangoSrc.includes("photo-1588195538326-c5b1e9f80a1b"));
    assert(3, "Mango Mousse Cake Image Renders Fixed URL", isMangoLoaded, `Mango image src: ${mangoSrc}`);

    // Check category select dropdown has dynamic options with counts
    const categorySelect = page.locator("aside select[data-testid='category-select']");
    const selectOptions = await categorySelect.locator("option").allTextContents();
    const hasChocolateOption = Boolean(selectOptions?.some((o) => o.includes("Chocolate Cakes")));
    const hasCounts = Boolean(selectOptions?.some((o) => o.includes("(") && o.includes(")")));
    assert(4, "Category Filter Contains Dynamic Categories", hasChocolateOption, `Categories in dropdown: ${selectOptions?.slice(0, 5).join(", ")}`);
    assert(5, "Category Filter Displays Product Counts", hasCounts, `Category with counts found`);

    // Select "Chocolate Cakes" from dropdown
    await categorySelect.selectOption("chocolate-cakes");
    await page.waitForSelector("div[role='link']:has-text('Mango')", { state: "detached", timeout: 15000 });
    await page.waitForSelector("div[role='link']:has-text('Belgian Chocolate Truffle')", { timeout: 15000 });

    // Verify URL sync
    const currentUrl = page.url();
    assert(6, "URL Synchronizes to Category Param", currentUrl.includes("category=chocolate-cakes"), `Current URL: ${currentUrl}`);

    // Verify Active Filter Chip renders
    const activeChip = await page.$("text=Category: Chocolate Cakes");
    assert(7, "Active Filter Chip Renders Formatted Category", Boolean(activeChip), `Found active category chip`);

    // Verify filtered product count (should show Chocolate Truffle and Black Forest Gateau)
    const filteredCards = await page.$$("div[role='link']");
    const cardTitles = await page.$$eval("div[role='link'] h3", (elements) => elements.map((el) => el.textContent?.trim() || ""));
    const hasTruffle = cardTitles.some((t) => t.toLowerCase().includes("chocolate"));
    assert(8, "Filtered Grid Shows Chocolate Cakes", hasTruffle && filteredCards.length === 2, `Filtered cards: ${cardTitles.join(" | ")}`);

    // Clear filter by selecting All Categories
    await categorySelect.selectOption("all");
    await page.waitForSelector("div[role='link']:has-text('Mango')", { timeout: 15000 });
    const restoredCards = await page.$$("div[role='link']");
    assert(9, "Resetting Filter Restores Full Catalog", restoredCards.length >= 5, `Restored ${restoredCards.length} products`);

    await page.close();

    // ── 2. MOBILE VIEWPORT ───────────────────────────────────────────────────
    console.log("\n[PHASE 2] Testing Mobile Viewport (iPhone 14 - 390x844)...");
    const mobilePage: Page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    await mobilePage.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 45000 });
    await mobilePage.waitForSelector("div[data-hydrated='true']", { timeout: 25000 });
    await mobilePage.waitForSelector("div[role='link']", { timeout: 20000 });

    // Check filter button exists on mobile
    const mobileFilterBtn = mobilePage.locator("button[data-testid='mobile-filter-button']");
    await mobileFilterBtn.waitFor({ state: "visible", timeout: 15000 });
    assert(10, "Mobile Filter Button Visible", true, "Mobile filter button detected");

    // Open Mobile Drawer
    await mobileFilterBtn.click();
    const drawer = mobilePage.locator("div[data-testid='mobile-filter-drawer']");
    await drawer.waitFor({ state: "visible", timeout: 15000 });
    assert(11, "Mobile Filter Drawer Opens", true, "Filter Cakes drawer detected");

    // Select Red Velvet in drawer
    const drawerCategorySelect = drawer.locator("select[data-testid='category-select']");
    await drawerCategorySelect.selectOption("red-velvet-cakes");
    await mobilePage.waitForTimeout(300);

    // Click Apply Filters button
    const applyBtn = drawer.locator("button:has-text('Apply Filters')");
    await applyBtn.click();
    await mobilePage.waitForSelector("div[role='link']:has-text('Red Velvet')", { timeout: 15000 });
    await mobilePage.waitForSelector("div[role='link']:has-text('Belgian Chocolate')", { state: "detached", timeout: 15000 });

    const mobileFilteredTitles = await mobilePage.$$eval("div[role='link'] h3", (elements) => elements.map((el) => el.textContent?.trim() || ""));
    const hasRedVelvet = mobileFilteredTitles.some((t) => t.toLowerCase().includes("red velvet"));
    assert(12, "Mobile Filter Drawer Filters by Red Velvet", hasRedVelvet, `Filtered titles: ${mobileFilteredTitles.join(" | ")}`);

    await mobilePage.close();

  } catch (error: any) {
    console.error("FATAL ERROR in runBrowserE2E:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  console.log(`  PLAYWRIGHT BROWSER RESULTS: ${passed} / ${total} ASSERTIONS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runBrowserE2E();
