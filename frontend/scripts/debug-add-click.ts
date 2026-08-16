import { chromium } from "playwright";

async function debugAddClick() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("console", (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`[BROWSER ERROR]: ${err.message}`));
  page.on("response", (res) => {
    if (res.url().includes("/cart") || res.url().includes("/ai") || res.request().method() === "POST") {
      console.log(`[NETWORK] ${res.request().method()} ${res.url()} -> ${res.status()}`);
    }
  });

  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Close popup
  try {
    const popupClose = page.locator("[role='dialog'] button:has-text('✕')").first();
    if (await popupClose.isVisible({ timeout: 2000 })) {
      await popupClose.click({ force: true });
    }
  } catch (e) {}

  // Open AI
  await page.locator("button:has-text('AI Cake Concierge')").click({ force: true });
  await page.waitForTimeout(1000);

  // Search
  await page.locator("input[placeholder*='Ask for cakes']").fill("chocolate cake");
  await page.keyboard.press("Enter");

  await page.waitForSelector("button:has-text('Add')", { timeout: 10000 });
  await page.waitForTimeout(1000);

  console.log("Clicking Add button now...");
  await page.locator("button:has-text('Add')").first().click({ force: true });

  await page.waitForTimeout(5000);

  await browser.close();
}

debugAddClick().catch(console.error);
