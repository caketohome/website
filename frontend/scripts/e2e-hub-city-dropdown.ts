import { chromium } from "playwright";

async function runE2E() {
  console.log("================================================================================");
  console.log("CAKETOHOME — REAL BROWSER E2E TEST: HUB STATE → CITY DROPDOWN FLOW");
  console.log("================================================================================");

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addCookies([
      { name: "_cth_jwt", value: "admin_test_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();

    // Listen for console logs and network errors
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(msg.text());
    });

    console.log("\n[STEP 1] Navigating to http://localhost:3000/dashboard?tab=branches");
    await page.goto("http://localhost:3000/dashboard?tab=branches", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the branches matrix to render and Kollam Hub to appear
    await page.waitForSelector("text=HUB-KLM-01", { timeout: 25000 });
    console.log("  ✅ Branches dashboard loaded with Kollam Central Cake Studio");

    // Locate the branch card for Kollam Central Cake Studio (HUB-KLM-01)
    console.log("\n[STEP 2] Locating Kollam Central Cake Studio (HUB-KLM-01)");
    const kollamCard = page.locator("div.border.rounded-xl").filter({ hasText: "HUB-KLM-01" }).first();
    await kollamCard.scrollIntoViewIfNeeded();

    // Click "Edit Hub" inside this specific card
    const editBtn = kollamCard.locator("button:has-text('Edit Hub')").first();
    await editBtn.click();
    console.log("  ✅ Clicked 'Edit Hub' button for Kollam Central Cake Studio");

    // Wait for modal to appear
    await page.waitForSelector("text=Configure Hub: Kollam Central Cake Studio", { timeout: 10000 });
    console.log("  ✅ Modal 'Configure Hub: Kollam Central Cake Studio' opened");

    // Inspect State select
    console.log("\n[STEP 3] Verifying Initial State & City Dropdown");
    const stateSelect = page.locator('select[id="branch_state_select"]');
    const stateValue = await stateSelect.inputValue();
    console.log(`  State Select Value: '${stateValue}'`);
    if (stateValue !== "state_kl") {
      throw new Error(`Expected state to be 'state_kl' but got '${stateValue}'`);
    }
    console.log("  ✅ State is correctly set to Kerala (state_kl)");

    // Inspect City select
    const citySelect = page.locator('select[id="branch_city_select"]');
    const cityValue = await citySelect.inputValue();
    console.log(`  City Select Value: '${cityValue}'`);
    if (cityValue !== "city_klm") {
      throw new Error(`Expected city to be 'city_klm' (Kollam) but got '${cityValue}'`);
    }
    console.log("  ✅ City is correctly selected as Kollam (city_klm)");

    // Check available city options for Kerala
    const keralaOptionCount = await citySelect.locator("option").count();
    const keralaOptions = await citySelect.locator("option").allTextContents();
    console.log(`  Kerala City Options (${keralaOptionCount} total):`, keralaOptions.filter(o => !o.includes("Select")));
    if (keralaOptionCount < 5) {
      throw new Error(`Expected at least 5 Kerala city options, found ${keralaOptionCount}`);
    }
    if (!keralaOptions.some(o => o.includes("Kollam"))) {
      throw new Error("Kollam is not present in Kerala city options");
    }
    console.log("  ✅ All Kerala cities loaded in dropdown options");

    // Verify no validation errors
    const errorBanner = page.locator("text=Please select an item in the list");
    const isErrorVisible = await errorBanner.isVisible();
    if (isErrorVisible) {
      throw new Error("Validation error banner is unexpectedly visible!");
    }
    console.log("  ✅ No validation errors present");

    // [STEP 4] State Change Invalidation Test: Change State to Karnataka (state_ka)
    console.log("\n[STEP 4] Testing State Change → City Invalidation");
    await stateSelect.selectOption("state_ka");
    await page.waitForTimeout(300);

    const cityAfterStateChange = await citySelect.inputValue();
    console.log(`  City Value after changing state to Karnataka: '${cityAfterStateChange}' (expected empty '')`);
    if (cityAfterStateChange !== "") {
      throw new Error(`Expected city to reset to empty on state change, but got '${cityAfterStateChange}'`);
    }
    console.log("  ✅ Previous city (Kollam) was immediately cleared on state change");

    const karnatakaOptions = await citySelect.locator("option").allTextContents();
    console.log("  Karnataka City Options:", karnatakaOptions.filter(o => !o.includes("Select")));
    if (karnatakaOptions.some(o => o.includes("Kollam"))) {
      throw new Error("Kollam should NOT be present in Karnataka city list!");
    }
    if (!karnatakaOptions.some(o => o.includes("Direct City") || o.includes("Postgres City") || o.includes("TestCity"))) {
      throw new Error("Expected Karnataka cities from PostgreSQL were not found in dropdown!");
    }
    console.log("  ✅ City dropdown now strictly contains Karnataka cities only");

    // [STEP 5] Return State to Kerala and Select Kollam
    console.log("\n[STEP 5] Returning State to Kerala and Selecting Kollam");
    await stateSelect.selectOption("state_kl");
    await page.waitForTimeout(300);

    const reloadedKeralaOptions = await citySelect.locator("option").allTextContents();
    if (!reloadedKeralaOptions.some(o => o.includes("Kollam"))) {
      throw new Error("Kollam did not reload when returning to Kerala!");
    }
    console.log("  ✅ Kerala cities reloaded cleanly");

    await citySelect.selectOption("city_klm");
    const selectedCityFinal = await citySelect.inputValue();
    if (selectedCityFinal !== "city_klm") {
      throw new Error(`Failed to select Kollam, current value: '${selectedCityFinal}'`);
    }
    console.log("  ✅ Successfully selected Kollam (city_klm)");

    // [STEP 6] Save Hub and Verify Notification
    console.log("\n[STEP 6] Saving Hub Configuration");
    const saveBtn = page.locator("button:has-text('Save Store / Fulfillment Hub')");
    await saveBtn.click();

    // Wait for success toast / notification or modal close
    await page.waitForSelector("text=updated successfully", { timeout: 10000 });
    console.log("  ✅ Received success notification: 'Fulfillment Hub updated successfully'");

    // [STEP 7] Reload Page and Re-open to Verify Persistence
    console.log("\n[STEP 7] Reloading Page & Verifying PostgreSQL Persistence in UI");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=HUB-KLM-01", { timeout: 25000 });

    const freshKollamCard = page.locator("div.border.rounded-xl").filter({ hasText: "HUB-KLM-01" }).first();
    await freshKollamCard.scrollIntoViewIfNeeded();

    const freshEditBtn = freshKollamCard.locator("button:has-text('Edit Hub')").first();
    await freshEditBtn.click();

    await page.waitForSelector("text=Configure Hub: Kollam Central Cake Studio", { timeout: 10000 });
    const freshStateValue = await page.locator('select[id="branch_state_select"]').inputValue();
    const freshCityValue = await page.locator('select[id="branch_city_select"]').inputValue();

    console.log(`  Persisted State Value on Reopen: '${freshStateValue}' (state_kl)`);
    console.log(`  Persisted City Value on Reopen: '${freshCityValue}' (city_klm)`);

    if (freshStateValue !== "state_kl") {
      throw new Error(`Persisted state mismatch: expected 'state_kl', got '${freshStateValue}'`);
    }
    if (freshCityValue !== "city_klm") {
      throw new Error(`Persisted city mismatch: expected 'city_klm', got '${freshCityValue}'`);
    }

    console.log("  ✅ Reopen successfully verified: State = Kerala (KL), City = Kollam (city_klm)");

    // Console and React errors check
    console.log("\n[STEP 8] Browser Console & React State Health Check");
    const criticalErrors = pageErrors.filter(e => !e.includes("favicon") && !e.includes("WebSocket"));
    if (criticalErrors.length > 0) {
      console.warn("  ⚠️ Browser errors logged:", criticalErrors);
    } else {
      console.log("  ✅ Zero React hydration errors or unhandled console exceptions");
    }

    console.log("\n================================================================================");
    console.log("ALL REAL BROWSER E2E VERIFICATION STEPS PASSED SUCCESSFULLY!");
    console.log("================================================================================");
    await browser.close();
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ E2E VERIFICATION FAILED:", err.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

runE2E();
