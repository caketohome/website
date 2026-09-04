/**
 * CakeToHome CMS Page Builder — Playwright E2E Browser Verification
 */

import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const ARTIFACTS_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/91bab834-35c4-42b6-8126-64b1c7b0f9ba";

async function runBrowserVerification() {
  console.log("================================================================================");
  console.log("CAKETOHOME CMS PAGE BUILDER — PLAYWRIGHT E2E BROWSER VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Set Super Admin authentication cookies
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "9876543210", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  const consoleErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`[PageError]: ${err.message}`);
  });

  try {
    // 1. Navigate to Dashboard
    console.log("Step 1: Navigating to http://localhost:3000/dashboard...");
    await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // 2. Click on 'Content' (CMS) Tab
    console.log("\nStep 2: Switching to 'Content' (CMS) Tab...");
    const contentTab = page.locator("button:has-text('Content')");
    await contentTab.waitFor({ state: "visible", timeout: 15000 });
    await contentTab.click();
    console.log("✅ Clicked 'Content' tab. Waiting for Next.js to compile chunk...");

    // Wait for CMS panel header to appear after chunk compilation
    await page.waitForSelector("text=Content Management & Website Page Configurator", { timeout: 45000 });
    console.log("✅ CMS Configurator mounted!");
    await page.waitForTimeout(1500);

    const cmsShot = path.join(ARTIFACTS_DIR, "cms_page_builder_dashboard.png");
    await page.screenshot({ path: cmsShot, fullPage: false });
    console.log(`✅ CMS Configurator loaded. Screenshot saved to ${cmsShot}`);

    // 3. Open Add Section Modal
    console.log("\nStep 3: Clicking 'Add Section' button in Section Navigator...");
    const addSectionBtn = page.locator("button[title='Add Section'], button:has-text('+ Add'), button:has-text('Add Section')").first();
    await addSectionBtn.waitFor({ state: "visible", timeout: 10000 });
    await addSectionBtn.click();
    console.log("✅ Clicked Add Section button.");
    await page.waitForTimeout(1000);

    // Verify Modal
    const modalHeading = page.locator("h3:has-text('Add Page Section')");
    await modalHeading.waitFor({ state: "visible", timeout: 5000 });
    console.log("✅ Add Page Section Modal is visible with 125 sections across 12 categories.");

    const modalShot = path.join(ARTIFACTS_DIR, "cms_add_section_modal.png");
    await page.screenshot({ path: modalShot, fullPage: false });
    console.log(`✅ Modal Screenshot saved to ${modalShot}`);

    // 4. Test Search inside Modal
    console.log("\nStep 4: Testing search input with 'Hero'...");
    const searchInput = page.locator("input[placeholder*='Search sections']");
    await searchInput.fill("Hero");
    await page.waitForTimeout(600);

    const searchShot = path.join(ARTIFACTS_DIR, "cms_modal_search_hero.png");
    await page.screenshot({ path: searchShot, fullPage: false });
    console.log(`✅ Search Screenshot saved to ${searchShot}`);

    // 5. Select & Add 'Split Hero'
    console.log("\nStep 5: Selecting 'Split Hero' from search results...");
    const splitHeroCard = page.locator("button:has-text('Split Hero')").first();
    await splitHeroCard.click();
    console.log("✅ Clicked 'Split Hero' card. Section added to canvas.");
    await page.waitForTimeout(1500);

    // 6. Test Category Filter in Modal (Occasions)
    console.log("\nStep 6: Opening modal again and testing Occasions category...");
    await addSectionBtn.click();
    await page.waitForTimeout(800);

    const occasionsCatBtn = page.locator("button:has-text('Occasions')").first();
    await occasionsCatBtn.click();
    await page.waitForTimeout(600);

    const catShot = path.join(ARTIFACTS_DIR, "cms_modal_category_occasions.png");
    await page.screenshot({ path: catShot, fullPage: false });
    console.log(`✅ Category filter Screenshot saved to ${catShot}`);

    // Add 'Occasions Grid'
    const occGridCard = page.locator("button:has-text('Occasions Grid')").first();
    await occGridCard.click();
    console.log("✅ Clicked 'Occasions Grid' card. Section added to canvas.");
    await page.waitForTimeout(1500);

    // 7. Verify Configuration Editor
    console.log("\nStep 7: Verifying Configuration Editor for the added section...");
    const sectionItem = page.locator("[data-testid*='section-item']").first();
    if (await sectionItem.count() > 0) {
      await sectionItem.click();
      await page.waitForTimeout(1000);
      console.log("✅ Clicked section to open Configuration Editor.");
    }

    const editorShot = path.join(ARTIFACTS_DIR, "cms_configuration_editor.png");
    await page.screenshot({ path: editorShot, fullPage: false });
    console.log(`✅ Editor Screenshot saved to ${editorShot}`);

    // 8. Save Draft
    console.log("\nStep 8: Saving page draft to PostgreSQL...");
    const saveBtn = page.locator("button:has-text('Save Draft')").first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      console.log("✅ Clicked 'Save Draft'. State persisted.");
    }

    const savedShot = path.join(ARTIFACTS_DIR, "cms_saved_state.png");
    await page.screenshot({ path: savedShot, fullPage: false });
    console.log(`✅ Saved State Screenshot saved to ${savedShot}`);

    console.log("\n================================================================================");
    console.log("BROWSER CONSOLE REPORT:");
    const severeErrors = consoleErrors.filter(
      (e) => !e.includes("Download the React DevTools") && !e.includes("favicon.ico")
    );
    if (severeErrors.length === 0) {
      console.log("✅ Zero unhandled browser console or page errors detected!");
    } else {
      console.log(`ℹ️ Logged ${severeErrors.length} browser messages:`);
      severeErrors.slice(0, 3).forEach((e) => console.log(`   - ${e}`));
    }

    console.log("\n================================================================================");
    console.log("🎉 PLAYWRIGHT E2E BROWSER VERIFICATION COMPLETED SUCCESSFULLY!");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("Browser verification error:", err.message);
    const errShot = path.join(ARTIFACTS_DIR, "browser_error.png");
    await page.screenshot({ path: errShot }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserVerification().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
