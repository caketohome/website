import { chromium, Browser, Page } from "playwright";

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, description: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${description}`);
  } else {
    console.error(`  ✗ [FAIL] ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runOutreachOrderLinkingPlaywright() {
  console.log("================================================================================");
  console.log("CAKETOHOME OUTREACH CONVERSION & REAL ORDER LINKING — PLAYWRIGHT VERIFICATION");
  console.log("================================================================================\n");

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  console.log("1. Verifying /api/v1/admin/customers/:customerUid/orders endpoint...");
  const custRes = await fetch(`${baseUrl}/api/v1/admin/customers/cth_cus_ananya_01/orders`, {
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "SUPER_ADMIN",
      "x-user-id": "admin_01",
    },
  });
  assert(custRes.status === 200, `Customer orders endpoint returned HTTP 200 OK (Status: ${custRes.status})`);
  const custOrdersData = await custRes.json();
  assert(Array.isArray(custOrdersData.orders), "API returned valid orders array");

  console.log("\n2. Evaluating historical orders and creating verified live customer order...");
  await fetch(`${baseUrl}/api/v1/admin/telemarketing/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "SUPER_ADMIN",
      "x-user-id": "admin_01",
    },
    body: JSON.stringify({ currentDate: "2026-08-17" }),
  });

  const candidatesRes = await fetch(`${baseUrl}/api/v1/admin/telemarketing/candidates?limit=10`, {
    headers: {
      "x-user-role": "SUPER_ADMIN",
      "x-user-id": "admin_01",
    },
  });
  const candsData = await candidatesRes.json();
  assert(candsData.candidates && candsData.candidates.length > 0, "Telemarketing candidates available in database");

  const targetCand = candsData.candidates[0];
  console.log(`  ✓ Target Candidate: ${targetCand.customer_name} (${targetCand.customer_uid})`);

  // Insert verified delivered order for this customer via API
  const orderRes = await fetch(`${baseUrl}/api/v1/admin/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "SUPER_ADMIN",
      "x-user-id": "admin_01",
    },
    body: JSON.stringify({
      order_number: "CTH-ORD-20260817-8899",
      customer_uid: targetCand.customer_uid,
      customer_name: targetCand.customer_name,
      customer_phone: targetCand.customer_phone,
      status: "DELIVERED",
      payment_status: "PAID",
      total: 1450,
      items: [{ id: "it_pw", name: "Gourmet Hazelnut Crunch Cake", price: 1450, quantity: 1 }],
      branch_name: "Indiranagar Flagship",
      created_at: "2026-08-17T12:00:00Z",
    }),
  });
  assert(orderRes.status === 201 || orderRes.status === 200, "Created real authoritative order via API");

  console.log("\n3. Launching Playwright Browser and Navigating to Telemarketing Panel...");
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);

  const page: Page = await context.newPage();
  page.on("dialog", (d) => {
    console.log("    [Browser Alert]:", d.message());
    d.accept();
  });

  try {
    await page.goto(`${baseUrl}/dashboard?tab=telemarketing`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=Telemarketing Reorder", { timeout: 15000 });

    const headingText = await page.textContent("h2");
    assert(Boolean(headingText?.includes("Telemarketing")), "Telemarketing header rendered in UI");

    console.log(`\n4. Opening Log Call Modal for ${targetCand.customer_name} and verifying Removal of Manual Order Inputs...`);
    const candRow = page.locator(`tr:has-text("${targetCand.customer_name}")`).first();
    const logCallBtn = candRow.locator("button:has-text('Log Call')");
    await logCallBtn.click();
    await page.waitForTimeout(600);

    const logCallModal = page.locator("h3:has-text('Log Call:')");
    assert(await logCallModal.isVisible(), "Log Call Modal opened successfully");

    // Verify that the old free text input with placeholder 'CTH-ORD-XXXX' is completely gone
    const oldManualOrderInput = page.locator('input[placeholder="CTH-ORD-XXXX"]');
    const oldInputExists = (await oldManualOrderInput.count()) > 0;
    assert(!oldInputExists, "Old manual free-text 'Order # or ID' input does NOT exist in DOM (Purged)");

    console.log("\n5. Selecting 'Order Placed / Converted' Outcome and Inspecting Order Auto-Detection...");
    const convertedOutcomeBtn = page.locator("button:has-text('Order Placed / Converted')");
    await convertedOutcomeBtn.click();
    await page.waitForTimeout(1000);

    // Verify Real Customer Order Detection section is rendered
    const orderDetectionHeader = page.locator("text=Real Customer Order Detection:");
    assert(await orderDetectionHeader.isVisible(), "Real Customer Order Detection section is visible");

    const refreshOrdersBtn = page.locator("button:has-text('Refresh Orders')");
    assert(await refreshOrdersBtn.isVisible(), "Refresh Orders action button is present");

    // Check order detection state
    const orderSelect = page.locator("#attributed-order-select");
    await orderSelect.waitFor({ state: "visible", timeout: 5000 });
    assert(await orderSelect.isVisible(), "Authoritative customer order selector rendered and auto-detected real order");

    // Verify read-only summary card with ₹ total exists
    const authoritativeBadge = page.locator("text=Authoritative Order Record");
    assert(await authoritativeBadge.isVisible(), "Read-only Authoritative Order Record badge is displayed");

    const priceBadge = page.locator("span:has-text('₹1,450')").first();
    assert(await priceBadge.isVisible(), "Read-only order total ₹1,450 verified from backend record");

    console.log("\n6. Saving Conversion with Verified Authoritative Order...");
    const saveBtn = page.locator("button:has-text('Save Call & Update Status')");
    assert(await saveBtn.isEnabled(), "Save Call button is enabled with valid customer order selected");

    await saveBtn.click();
    await page.waitForTimeout(1500);

    // Verify modal closed
    assert(!(await logCallModal.isVisible()), "Log Call Modal successfully closed after saving conversion");

    console.log("\n================================================================================");
    console.log(`PLAYWRIGHT TEST SUMMARY: TOTAL: ${totalCount} | PASSED: ${passedCount} | FAILED: 0`);
    console.log("RESULT: OUTREACH CONVERSION & ORDER LINKING PLAYWRIGHT SUITE 100% PASS ✨");
    console.log("================================================================================\n");

  } finally {
    await browser.close();
  }
}

runOutreachOrderLinkingPlaywright().catch((err) => {
  console.error("FATAL PLAYWRIGHT FAILURE:", err);
  process.exit(1);
});
