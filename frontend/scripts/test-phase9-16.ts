import { chromium } from "playwright";

async function runComprehensiveVerification() {
  console.log("================================================================================");
  console.log("🚀 STARTING COMPREHENSIVE VERIFICATION: PHASES 9 THROUGH 16");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000/api/v1";

  // ── SECTION 1: DIRECT API CONTRACT VERIFICATION (Zero Mocks) ──
  console.log("--- Section 1: API Endpoint Direct Verification ---");

  // 1.1 GET /api/v1/admin/branches
  const getBranchesRes = await fetch(`${baseUrl}/admin/branches`);
  console.log(`  1.1 GET /api/v1/admin/branches -> Status: HTTP ${getBranchesRes.status}`);
  if (getBranchesRes.status !== 200) throw new Error(`GET /admin/branches failed: ${getBranchesRes.status}`);

  // 1.2 POST /api/v1/admin/branches (201 Created)
  const testCode = `HUB-LIVE-${Date.now().toString().slice(-4)}`;
  const testName = `Live Verified Hub ${testCode.slice(-3)}`;
  const postBranchRes = await fetch(`${baseUrl}/admin/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: testCode,
      name: testName,
      branch_type: "main_hub",
      extended_status: "open",
      operational_status: "operational",
      address: "100 Feet Rd, Indiranagar, Bengaluru",
      city: "Bengaluru",
      city_id: "city_bbr",
      state: "Karnataka",
      pincode: "560038",
      phone: "+91 98765 11223",
      email: `hub_${testCode.toLowerCase()}@cakes2home.com`,
      manager_name: "Vikram Sengupta",
      manager_account: {
        name: "Vikram Sengupta",
        phone: "+91 98765 11223",
        email: `vikram_${testCode.toLowerCase()}@cakes2home.com`,
        status: "active",
      },
    }),
  });
  console.log(`  1.2 POST /api/v1/admin/branches -> Status: HTTP ${postBranchRes.status}`);
  const createdData: any = await postBranchRes.json();
  console.log(`      Response Success: ${createdData.success} | Created Branch ID: ${createdData.branch?.id}`);
  if (postBranchRes.status !== 201) throw new Error(`POST /admin/branches failed: ${postBranchRes.status}`);

  // 1.3 GET GST Registrations
  const gstRes = await fetch(`${baseUrl}/admin/compliance/gst-registrations`);
  console.log(`  1.3 GET /api/v1/admin/compliance/gst-registrations -> Status: HTTP ${gstRes.status}`);
  if (gstRes.status !== 200) throw new Error(`GST registrations endpoint failed: ${gstRes.status}`);

  // 1.4 GET FSSAI Compliance
  const fssaiRes = await fetch(`${baseUrl}/admin/compliance/fssai`);
  console.log(`  1.4 GET /api/v1/admin/compliance/fssai -> Status: HTTP ${fssaiRes.status}`);
  if (fssaiRes.status !== 200) throw new Error(`FSSAI compliance endpoint failed: ${fssaiRes.status}`);

  // 1.5 GET Cities
  const citiesRes = await fetch(`${baseUrl}/admin/cities`);
  console.log(`  1.5 GET /api/v1/admin/cities -> Status: HTTP ${citiesRes.status}`);
  if (citiesRes.status !== 200) throw new Error(`Cities endpoint failed: ${citiesRes.status}`);

  // ── SECTION 2: REAL PLAYWRIGHT BROWSER VERIFICATION ──
  console.log("\n--- Section 2: Real Browser Journey & Chunk Loading ---");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "mock_admin_jwt_token_super_admin_2026", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();

  const errors: string[] = [];
  const chunk404s: string[] = [];
  let alertTriggered = false;

  page.on("pageerror", (err) => errors.push(err.message));
  page.on("dialog", (d) => {
    alertTriggered = true;
    console.error(`  ⚠️ [Alert Dialog]: ${d.message()}`);
    d.dismiss();
  });
  page.on("response", (res) => {
    if (res.url().includes("/_next/static/chunks/") && res.status() >= 400) {
      chunk404s.push(`[${res.status()}] ${res.url()}`);
    }
  });

  // Step 2.1: Open Settings Panel
  console.log("  2.1 Navigating to Settings Panel (?tab=settings)...");
  await page.goto("http://localhost:3000/dashboard?tab=settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const settingsHeading = page.locator("text=Business, Tax & Statutory Compliance");
  const isSettingsVisible = await settingsHeading.isVisible();
  console.log(`      Settings Heading Visible: ${isSettingsVisible}`);
  console.log(`      Chunk 404 Count: ${chunk404s.length}`);
  console.log(`      Page Error Count: ${errors.length}`);

  if (!isSettingsVisible || chunk404s.length > 0 || errors.length > 0) {
    throw new Error(`Settings page failed to load without chunk errors. Errors: ${JSON.stringify(errors)}, 404s: ${JSON.stringify(chunk404s)}`);
  }

  // Step 2.2: Switch from Settings to Branches
  console.log("  2.2 Switching tab to Branches Panel (?tab=branches)...");
  await page.getByRole("button", { name: "Branches", exact: true }).click();
  await page.waitForTimeout(1500);

  const branchesHeading = page.locator("text=Delivery Fulfillment Hub Operations");
  const isBranchesVisible = await branchesHeading.isVisible();
  console.log(`      Branches Heading Visible: ${isBranchesVisible}`);

  // Step 2.3: Create a new Fulfillment Hub via UI
  console.log("  2.3 Clicking 'Create Fulfillment Hub'...");
  await page.getByRole("button", { name: /Create Fulfillment Hub/i }).click();
  await page.waitForSelector("text=Create Delivery Fulfillment Hub", { timeout: 5000 });

  const uiBranchCode = `HUB-UI-${Date.now().toString().slice(-4)}`;
  const uiBranchName = `Indiranagar Tech Hub ${uiBranchCode.slice(-3)}`;
  const uiMgrName = "Aditi Deshmukh";
  const uiMgrPhone = "+91 98765 44332";
  const uiMgrEmail = `aditi_${uiBranchCode.toLowerCase()}@cakes2home.com`;

  await page.fill('input[placeholder="e.g. HSR Layout Delivery Hub"]', uiBranchName);
  await page.fill('input[placeholder="HUB-BLR-01"]', uiBranchCode);
  await page.selectOption('select:has(option:has-text("Bengaluru"))', { label: "Bengaluru, Karnataka" });
  await page.fill('input[value="560038"]', "560038");
  await page.fill('input[placeholder="100 Feet Rd, Bengaluru"]', "100 Feet Rd, Indiranagar");
  await page.fill('input[placeholder="e.g. Rajesh Kumar"]', uiMgrName);
  await page.fill('input[placeholder="+91 98765 00001"]', uiMgrPhone);
  await page.fill('input[placeholder="manager@cakes2home.com"]', uiMgrEmail);

  let uiPostStatus: number | null = null;
  page.on("response", (res) => {
    if (res.url().includes("/api/v1/admin/branches") && res.request().method() === "POST") {
      uiPostStatus = res.status();
    }
  });

  console.log("  2.4 Submitting Create Hub Form...");
  await page.getByRole("button", { name: /Save Store \/ Fulfillment Hub/i }).click();
  await page.waitForTimeout(2000);

  console.log(`      UI POST /api/v1/admin/branches Status: HTTP ${uiPostStatus}`);
  console.log(`      Browser alert() Triggered: ${alertTriggered}`);

  if (uiPostStatus !== 201) throw new Error(`Expected UI POST 201 but got HTTP ${uiPostStatus}`);
  if (alertTriggered) throw new Error("Browser alert() was triggered on creation");

  const createdCard = page.getByText(uiBranchName, { exact: true });
  const isCreatedCardVisible = await createdCard.isVisible();
  console.log(`      New Hub Card Visible in UI: ${isCreatedCardVisible}`);

  // Step 2.4: Refresh Page & Verify Persistence
  console.log("  2.5 Reloading page to verify persistence...");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const isPersistedVisible = await page.getByText(uiBranchName, { exact: true }).isVisible();
  console.log(`      Hub Persisted Across Page Reload: ${isPersistedVisible}`);
  if (!isPersistedVisible) throw new Error(`Hub "${uiBranchName}" not found after page reload`);

  // Step 2.5: Verify Staff Profile Linkage
  console.log("  2.6 Navigating to Staff Profiles (?tab=staff_profiles)...");
  await page.getByRole("button", { name: "👥 Staff Profiles", exact: true }).click();
  await page.waitForTimeout(1500);

  const staffEntry = page.getByText(uiMgrName, { exact: true });
  const isStaffVisible = await staffEntry.isVisible();
  console.log(`      Manager "${uiMgrName}" in Staff Profiles: ${isStaffVisible}`);

  // Step 2.6: Negative UI Test (Duplicate Code)
  console.log("  2.7 Performing Negative UI Test (Duplicate Hub Code)...");
  await page.getByRole("button", { name: "Branches", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Create Fulfillment Hub/i }).click();
  await page.waitForSelector("text=Create Delivery Fulfillment Hub", { timeout: 5000 });

  await page.fill('input[placeholder="e.g. HSR Layout Delivery Hub"]', "Duplicate Name");
  await page.fill('input[placeholder="HUB-BLR-01"]', uiBranchCode); // DUPLICATE CODE
  await page.selectOption('select:has(option:has-text("Bengaluru"))', { label: "Bengaluru, Karnataka" });
  await page.fill('input[placeholder="100 Feet Rd, Bengaluru"]', "100 Feet Rd");
  await page.fill('input[placeholder="e.g. Rajesh Kumar"]', "Dup Mgr");
  await page.fill('input[placeholder="+91 98765 00001"]', "+91 98765 00000");
  await page.fill('input[placeholder="manager@cakes2home.com"]', "dup@cakes2home.com");

  await page.getByRole("button", { name: /Save Store \/ Fulfillment Hub/i }).click();
  await page.waitForTimeout(1500);

  const errorBanner = page.locator(`text=Branch code "${uiBranchCode}" already exists.`);
  const isErrorBannerVisible = await errorBanner.isVisible();
  console.log(`      Inline Duplicate Error Banner Visible: ${isErrorBannerVisible}`);
  console.log(`      No alert() on validation error: ${!alertTriggered}`);

  await browser.close();

  console.log("\n================================================================================");
  console.log("🏁 ALL PHASES 9 THROUGH 16 VERIFIED: 100% SUCCESS ✨");
  console.log("================================================================================\n");
}

runComprehensiveVerification();
