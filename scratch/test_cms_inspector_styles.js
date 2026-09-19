const path = require("path");
const { chromium } = require(path.join(__dirname, "../frontend/node_modules/playwright"));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "dummy_jwt_token", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  console.log("Navigating to /dashboard?tab=cms...");
  await page.goto("http://localhost:3000/dashboard?tab=cms", { waitUntil: "domcontentloaded", timeout: 25000 });
  
  // Wait for the CMS configurator to render
  try {
    await page.waitForSelector('button[data-testid="cms-save-draft-btn"]', { timeout: 15000 });
    console.log("Found Save Draft button!");
  } catch (e) {
    console.log("Waiting extra 5s for dynamic import...");
    await page.waitForTimeout(5000);
  }

  const results = await page.evaluate(() => {
    const report = { inputs: [], labels: [], buttons: [] };
    
    // Find inputs in inspector
    const allInputs = Array.from(document.querySelectorAll("input[type='text'], textarea, select"));
    report.inputs = allInputs.map(el => {
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        name: el.name || el.placeholder || el.value || "input",
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
      };
    });

    const allLabels = Array.from(document.querySelectorAll("label"));
    report.labels = allLabels.map(el => {
      const cs = window.getComputedStyle(el);
      return {
        text: el.innerText.trim(),
        color: cs.color,
        fontWeight: cs.fontWeight,
      };
    });

    const allButtons = Array.from(document.querySelectorAll("button[data-testid^='cms-']"));
    report.buttons = allButtons.map(b => {
      const cs = window.getComputedStyle(b);
      return {
        testId: b.getAttribute("data-testid"),
        text: b.innerText.trim(),
        disabled: b.disabled,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
      };
    });

    return report;
  });

  console.log("=== INSPECTOR STYLES ===");
  console.log(JSON.stringify(results, null, 2));

  await page.screenshot({ path: path.join(__dirname, "screenshots/cms_page_builder_verified.png"), fullPage: false });
  console.log("Saved cms_page_builder_verified.png");

  await browser.close();
})();
