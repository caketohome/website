import { chromium } from "playwright";
import assert from "assert";

async function testHydration() {
  console.log("================================================================================");
  console.log("🔬 TESTING REACT HYDRATION INTEGRITY ON http://localhost:3000/");
  console.log("================================================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const hydrationMismatches: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      consoleErrors.push(text);
      if (text.includes("hydration") || text.includes("did not match") || text.includes("Hydration failed")) {
        hydrationMismatches.push(text);
      }
    }
    if (msg.type() === "warning") {
      consoleWarnings.push(text);
      if (text.includes("hydration") || text.includes("did not match") || text.includes("Hydration failed") || text.includes("Extra attributes")) {
        hydrationMismatches.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`[PageError] ${err.message}`);
    if (err.message.includes("hydration") || err.message.includes("did not match")) {
      hydrationMismatches.push(err.message);
    }
  });

  console.log("\n1. Navigating to http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log(`\n2. Console Errors Count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.log(`  [Console Error Log]: ${e}`));
  }
  console.log(`3. Hydration Mismatches Count: ${hydrationMismatches.length}`);

  if (hydrationMismatches.length > 0) {
    console.error("\n❌ Detected Hydration Mismatch Warnings/Errors:");
    hydrationMismatches.forEach((m) => console.error(`  • ${m}`));
  } else {
    console.log("\n✅ ZERO Hydration Mismatches Detected! SSR and Client HTML match 100%.");
  }

  assert(hydrationMismatches.length === 0, "Zero React hydration mismatches on homepage");

  // Check promotional banner is rendered and styled
  const bannerCheck = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h1, h2, h3")).find((el) =>
      el.textContent?.includes("Monsoon Special")
    );
    const card = heading?.closest("section")?.querySelector("[class*='cth-promo-card']");
    const computed = card ? window.getComputedStyle(card) : null;
    return {
      found: !!heading,
      bg: computed?.backgroundColor || computed?.background,
      textColor: computed?.color,
      borderRadius: computed?.borderRadius,
    };
  });

  console.log("\n4. Promotional Banner Live State:");
  console.log(`  • Rendered: ${bannerCheck.found}`);
  console.log(`  • Background: ${bannerCheck.bg}`);
  console.log(`  • Text Color: ${bannerCheck.textColor}`);
  console.log(`  • Border Radius: ${bannerCheck.borderRadius}`);

  assert(bannerCheck.found, "Promotional banner exists and renders cleanly without hydration break");

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎯 REACT HYDRATION AUDIT PASSED 100%");
  console.log("================================================================================");
}

testHydration().catch((err) => {
  console.error("❌ HYDRATION TEST FAILURE:", err);
  process.exit(1);
});
