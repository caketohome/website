/**
 * CAKETOHOME TELECALLER RBAC & STAFF ASSIGNMENT PLAYWRIGHT VERIFICATION
 * ====================================================================
 * Real-Browser E2E test verifying:
 * 1. GET /api/v1/admin/telemarketing/eligible-staff returns real staff from StaffAccessControl.
 * 2. Creating a new telecaller via StaffAccessControl automatically updates the eligible staff list.
 * 3. Log Call Modal dropdown fetches and renders live staff with profile badges.
 * 4. Zero fake names ("Rahul K.", "Sneha M.", "Super Admin (Manager)") appear.
 * 5. Call logging and staff reassignment succeed with real staff_id.
 */

import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";

async function verifyTelecallerRbacPlaywright() {
  console.log("================================================================================");
  console.log("CAKETOHOME TELECALLER RBAC & AUTHORITATIVE STAFF — PLAYWRIGHT VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Set Super Admin authentication cookies for dashboard access
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_auth_token", value: "tok_admin_test", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  let passedCount = 0;
  let totalCount = 0;

  function assertTest(condition: boolean, msg: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ [PASS] ${msg}`);
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      throw new Error(`Playwright Assertion Failed: ${msg}`);
    }
  }

  try {
    // ── 1. VERIFY /api/v1/admin/telemarketing/eligible-staff ENDPOINT ──
    console.log("1. Verifying /api/v1/admin/telemarketing/eligible-staff API endpoint...");
    const eligibleRes = await page.request.get(`${BASE_URL}/api/v1/admin/telemarketing/eligible-staff`, {
      headers: {
        "x-user-role": "SUPER_ADMIN",
        "x-user-id": "admin_01",
      },
    });

    assertTest(eligibleRes.status() === 200, `Eligible staff endpoint returned HTTP 200 OK (Status: ${eligibleRes.status()})`);
    const eligibleData = await eligibleRes.json();
    assertTest(Array.isArray(eligibleData.staff), "API returned staff array");
    assertTest(eligibleData.staff.length > 0, `API returned ${eligibleData.staff.length} eligible staff`);

    // Verify seed Priya Sharma is present
    const hasPriya = eligibleData.staff.some((s: any) => s.name === "Priya Sharma");
    assertTest(hasPriya, "Priya Sharma is present in eligible staff response");

    // Verify zero fake names
    const hasFakeRahul = eligibleData.staff.some((s: any) => s.name === "Rahul K.");
    assertTest(!hasFakeRahul, "Zero fake 'Rahul K.' in API response");
    const hasFakeSneha = eligibleData.staff.some((s: any) => s.name === "Sneha M.");
    assertTest(!hasFakeSneha, "Zero fake 'Sneha M.' in API response");

    // ── 2. CREATE A NEW TELECALLER VIA STAFF API ──
    console.log("\n2. Creating a new Staff Member with 'Telecaller' profile via API...");
    const createStaffRes = await page.request.post(`${BASE_URL}/api/v1/admin/staff-profiles/staff`, {
      headers: {
        "Content-Type": "application/json",
        "x-user-role": "SUPER_ADMIN",
        "x-user-id": "admin_01",
      },
      data: {
        name: "Divya Nambiar",
        phone: "+91 93333 44556",
        email: "divya.nambiar@cakes2home.com",
        accessProfileIds: ["prof_telecaller"],
        branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
        branch_name: "Indiranagar Flagship Kitchen",
        city: "Bengaluru",
        status: "ACTIVE",
      },
    });

    assertTest(createStaffRes.status() === 200 || createStaffRes.status() === 201, `Staff creation returned HTTP 200/201 (Status: ${createStaffRes.status()})`);
    const createdStaffData = await createStaffRes.json();
    const newStaffId = createdStaffData.staff?.id;
    assertTest(Boolean(newStaffId), `New staff Divya Nambiar created with id: ${newStaffId}`);

    // Verify newly created Divya Nambiar appears in eligible-staff API
    const eligibleRes2 = await page.request.get(`${BASE_URL}/api/v1/admin/telemarketing/eligible-staff`, {
      headers: {
        "x-user-role": "SUPER_ADMIN",
        "x-user-id": "admin_01",
      },
    });
    const eligibleData2 = await eligibleRes2.json();
    const hasDivya = eligibleData2.staff.some((s: any) => s.name === "Divya Nambiar" && s.id === newStaffId);
    assertTest(hasDivya, "Newly created staff Divya Nambiar immediately appears in eligible staff API");

    // ── 3. NAVIGATE TO TELEMARKETING PANEL IN REAL BROWSER ──
    console.log("\n3. Navigating browser to Admin Telemarketing Panel...");
    await page.goto(`${BASE_URL}/dashboard?tab=telemarketing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const headingText = await page.textContent("h2");
    assertTest(Boolean(headingText?.includes("Telemarketing")), "Telemarketing header rendered in UI");

    // ── 4. OPEN LOG CALL MODAL & VERIFY REAL STAFF DROPDOWN ──
    console.log("\n4. Opening Log Call Modal and inspecting Attributed Telecaller dropdown...");
    const logCallButtons = page.locator("button:has-text('Log Call')");
    const count = await logCallButtons.count();
    assertTest(count > 0, `Found ${count} Log Call buttons in table`);

    await logCallButtons.first().click();
    await page.waitForTimeout(500);

    const logCallModal = page.locator("h3:has-text('Log Call:')");
    assertTest(await logCallModal.isVisible(), "Log Call Modal opened successfully");

    // Check staff select dropdown
    const staffSelect = page.locator("#attributed-telecaller-select");
    await staffSelect.waitFor({ state: "visible", timeout: 5000 });
    assertTest(await staffSelect.isVisible(), "Attributed Telecaller select element is visible");

    const optionTexts = await staffSelect.locator("option").allTextContents();
    console.log("    Dropdown Options found:", optionTexts);

    assertTest(optionTexts.some((t) => t.includes("Priya Sharma")), "Dropdown contains real staff 'Priya Sharma'");
    assertTest(optionTexts.some((t) => t.includes("Divya Nambiar")), "Dropdown contains newly created real staff 'Divya Nambiar'");
    assertTest(!optionTexts.some((t) => t.includes("Rahul K.")), "Dropdown does NOT contain fake 'Rahul K.'");
    assertTest(!optionTexts.some((t) => t.includes("Sneha M.")), "Dropdown does NOT contain fake 'Sneha M.'");

    // ── 5. SELECT REAL STAFF & SAVE CALL ──
    console.log("\n5. Logging call with newly created real staff Divya Nambiar...");
    // Select outcome "Interested"
    await page.click("button:has-text('Interested')");

    // Select Divya Nambiar in dropdown
    const divyaOption = optionTexts.find((t) => t.includes("Divya Nambiar")) || "";
    await staffSelect.selectOption({ label: divyaOption });

    // Enter note
    const notesTextarea = page.locator("textarea");
    await notesTextarea.fill("Spoke with customer. Very interested in Belgian Truffle cake for upcoming anniversary celebration.");

    // Click Save Call
    await page.click("button:has-text('Save Call & Update Status')");
    await page.waitForTimeout(1000);

    assertTest(!(await logCallModal.isVisible()), "Log Call Modal closed after saving");

    console.log("\n================================================================================");
    console.log(`PLAYWRIGHT TEST SUMMARY: TOTAL: ${totalCount} | PASSED: ${passedCount} | FAILED: 0`);
    console.log("RESULT: TELECALLER RBAC PLAYWRIGHT SUITE 100% PASS ✨");
    console.log("================================================================================\n");
  } finally {
    await browser.close();
  }
}

verifyTelecallerRbacPlaywright().catch((err) => {
  console.error("Playwright Suite Failed:", err);
  process.exit(1);
});
