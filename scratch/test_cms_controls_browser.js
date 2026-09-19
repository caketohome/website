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
  await page.waitForTimeout(2500);

  // Take screenshot of CMS tab
  await page.screenshot({ path: path.join(__dirname, "screenshots/cms_page_builder_after.png"), fullPage: false });
  console.log("Captured cms_page_builder_after.png");

  // Inspect computed styles
  const styles = await page.evaluate(() => {
    const report = {};
    
    // Page selector
    const pageSelect = document.querySelector("select");
    if (pageSelect) {
      const cs = window.getComputedStyle(pageSelect);
      report.pageSelect = {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        fontSize: cs.fontSize,
      };
    }

    // Inputs in right inspector
    const inputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type])"));
    report.inputs = inputs.slice(0, 5).map(inp => {
      const cs = window.getComputedStyle(inp);
      return {
        placeholder: inp.placeholder,
        value: inp.value,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        opacity: cs.opacity,
      };
    });

    // Labels
    const labels = Array.from(document.querySelectorAll("label"));
    report.labels = labels.slice(0, 5).map(lbl => {
      const cs = window.getComputedStyle(lbl);
      return {
        text: lbl.innerText,
        color: cs.color,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      };
    });

    // Buttons
    const buttons = Array.from(document.querySelectorAll("button"));
    report.buttons = buttons
      .filter(b => b.innerText.includes("Save") || b.innerText.includes("Publish"))
      .map(b => {
        const cs = window.getComputedStyle(b);
        return {
          text: b.innerText.trim(),
          disabled: b.disabled,
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderColor,
        };
      });

    return report;
  });

  console.log("=== CMS COMPUTED STYLES ===");
  console.log(JSON.stringify(styles, null, 2));

  await browser.close();
})();
