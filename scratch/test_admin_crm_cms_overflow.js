const path = require("path");
const { chromium } = require(path.join(__dirname, "../frontend/node_modules/playwright"));

const VIEWPORTS = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440];
const TABS = ["crm", "cms"];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "dummy_jwt_token", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  const results = [];

  for (const tab of TABS) {
    console.log(`\n=== Testing Tab: ${tab} ===`);
    const url = `http://localhost:3000/dashboard?tab=${tab}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(2000); // allow dynamic chunk load
    } catch (e) {
      console.error(`Error loading ${url}:`, e.message);
      continue;
    }

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(300);

      const measurement = await page.evaluate((w) => {
        const docClient = document.documentElement.clientWidth;
        const docScroll = document.documentElement.scrollWidth;
        const bodyClient = document.body.clientWidth;
        const bodyScroll = document.body.scrollWidth;
        const hasOverflow = docScroll > docClient || bodyScroll > bodyClient;

        let offendingSelectors = [];
        if (hasOverflow) {
          const allEls = Array.from(document.querySelectorAll("*"));
          for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            if (rect.right > docClient + 1 || el.scrollWidth > docClient + 1) {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : "";
              const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
              const selector = `${tag}${id}${cls}`;
              offendingSelectors.push({
                selector,
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                scrollWidth: el.scrollWidth,
              });
            }
          }
        }

        return {
          viewportWidth: w,
          docClient,
          docScroll,
          bodyClient,
          bodyScroll,
          hasOverflow,
          offendingCount: offendingSelectors.length,
          topOffenders: offendingSelectors.slice(0, 5),
        };
      }, width);

      results.push({ tab, ...measurement });
      console.log(`[Tab: ${tab}] @ ${width}px: docClient=${measurement.docClient}, docScroll=${measurement.docScroll}, overflow=${measurement.hasOverflow}`);
      if (measurement.hasOverflow) {
        console.log(`   Top Offenders:`, JSON.stringify(measurement.topOffenders));
      }
    }
  }

  await browser.close();
  console.log("\nFinished CRM and CMS overflow testing!");
})();
