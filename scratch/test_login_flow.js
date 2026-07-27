const { chromium } = require("playwright");

async function diagnoseLogin() {
  console.log("Starting Diagnostic Login Test...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on("console", (msg) => console.log(`[BROWSER CONSOLE ${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`[PAGE ERROR] ${err.message}`));
  page.on("requestfailed", (req) => console.log(`[REQUEST FAILED] ${req.url()} - ${req.failure()?.errorText}`));

  try {
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.fill("input[name='phone']", "9876543210");
    await page.click("button[type='submit']");
    await page.waitForTimeout(2000);

    const autoFillBtn = page.locator("button:has-text('Auto-fill OTP')");
    await autoFillBtn.click();
    await page.waitForTimeout(500);

    const filledValue = await page.inputValue("input[name='otp']");
    console.log(`Auto-filled OTP: "${filledValue}"`);

    await page.click("button[type='submit']");
    await page.waitForTimeout(4000);

    console.log(`Final URL: ${page.url()}`);
    const pageText = await page.innerText("body");
    console.log(`Page Text content sample:\n${pageText.slice(0, 300)}`);

  } catch (err) {
    console.error("💥 Error:", err);
  } finally {
    await browser.close();
  }
}

diagnoseLogin();
