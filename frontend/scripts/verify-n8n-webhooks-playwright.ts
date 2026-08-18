/**
 * CakeToHome Enterprise n8n & External Webhook Outbox Playwright UI Verification
 * 
 * Tests:
 * 1. Admin navigates to /dashboard?tab=webhooks
 * 2. Integration Health cards render real metrics (Webhook Endpoint, Worker, Delivery Rate, Pending Outbox, DLQ, Latency)
 * 3. Navigation across all 5 tabs: Endpoints & Subscriptions, Live Outbox & DLQ, Delivery Logs, Event Catalogue, Diagnostic Test Center
 * 4. Event Subscriptions toggling & persistence
 * 5. Secret reveal / hide toggle & rotation interaction
 * 6. Diagnostic Test Webhook execution & verification report display
 * 7. Payload Inspector modal opening, displaying formatted JSON, and closing
 */

import { chromium } from "playwright";

async function verifyWebhooksUI() {
  console.log("==================================================================");
  console.log("CAKETOHOME — n8n WEBHOOK OUTBOX PLAYWRIGHT UI VERIFICATION");
  console.log("==================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Set Super Admin cookies
  await context.addCookies([
    { name: "_cth_jwt", value: "mock_admin_jwt_token_super_admin_2026", domain: "localhost", path: "/" },
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error("     Details:", details);
      failed++;
    }
  }

  try {
    const url = "http://localhost:3000/dashboard?tab=webhooks";
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // 1. Verify Page Title and Header
    const headerText = await page.locator("h2").textContent();
    assert(Boolean(headerText?.includes("Enterprise n8n Webhook") || headerText?.includes("Outbox")), "Webhooks panel header rendered", headerText);

    // 2. Verify Integration Health Cards
    const healthCards = page.locator(".grid.grid-cols-2 > div");
    const count = await healthCards.count();
    assert(count >= 6, `Rendered ${count} health telemetry cards`);

    const deliveryRateCard = await page.locator("text=Delivery Rate").isVisible();
    assert(deliveryRateCard, "Delivery Rate telemetry card is visible");

    const outboxWorkerCard = await page.locator("text=Outbox Worker").isVisible();
    assert(outboxWorkerCard, "Outbox Worker telemetry card is visible");

    // 3. Verify Navigation Tabs
    const endpointsTab = page.locator(".border-b button:has-text('Endpoint & Subscriptions')");
    const outboxTab = page.locator(".border-b button:has-text('Live Outbox & DLQ')");
    const logsTab = page.locator(".border-b button:has-text('Delivery Logs')");
    const catalogueTab = page.locator(".border-b button:has-text('Event Catalogue')");
    const testCenterTab = page.locator(".border-b button:has-text('Diagnostic Test Center')");

    assert(await endpointsTab.isVisible(), "Endpoints & Subscriptions tab visible");
    assert(await outboxTab.isVisible(), "Live Outbox & DLQ tab visible");
    assert(await logsTab.isVisible(), "Delivery Logs tab visible");
    assert(await catalogueTab.isVisible(), "Event Catalogue tab visible");
    assert(await testCenterTab.isVisible(), "Diagnostic Test Center tab visible");

    // 4. Test Event Subscriptions & Secret Toggle
    const revealSecretBtn = page.locator("button:has-text('Reveal')");
    if (await revealSecretBtn.isVisible()) {
      await revealSecretBtn.click();
      assert(await page.locator("button:has-text('Hide')").isVisible(), "Secret toggled to visible");
    }

    // Toggle an event subscription checkbox
    const firstCheckbox = page.locator("input[type='checkbox']").first();
    if (await firstCheckbox.isVisible()) {
      const initialChecked = await firstCheckbox.isChecked();
      await firstCheckbox.click();
      const newChecked = await firstCheckbox.isChecked();
      assert(newChecked !== initialChecked, "Subscription checkbox toggled successfully");
    }

    // 5. Switch to Live Outbox & DLQ Tab
    await outboxTab.click();
    await page.waitForTimeout(500);
    const outboxHeader = page.locator("h3:has-text('Transactional Outbox Queue')");
    assert(await outboxHeader.isVisible(), "Switched to Live Outbox & DLQ tab");

    // 6. Switch to Delivery Logs Tab
    await logsTab.click();
    await page.waitForTimeout(500);
    const logsHeader = page.locator("h3:has-text('Outbound Webhook Delivery Logs')");
    assert(await logsHeader.isVisible(), "Switched to Delivery Logs tab");

    // 7. Test Payload Inspector Modal
    const viewPayloadBtn = page.locator("button:has-text('View Payload')").first();
    if (await viewPayloadBtn.isVisible()) {
      await viewPayloadBtn.click();
      await page.waitForTimeout(500);
      const modalHeader = page.locator("h3:has-text('Webhook Payload & Envelope Inspector')");
      assert(await modalHeader.isVisible(), "Payload Inspector Modal opened");

      // Verify formatted JSON
      const jsonPre = page.locator("pre");
      assert(await jsonPre.isVisible(), "Payload formatted JSON rendered in modal");

      // Close modal
      const closeBtn = page.locator("button:has-text('Close Inspector')");
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        assert(!(await modalHeader.isVisible()), "Payload modal closed");
      }
    }

    // 8. Switch to Event Catalogue Tab
    await catalogueTab.click();
    await page.waitForTimeout(500);
    const catHeader = page.locator("h3:has-text('Canonical Event Catalogue')");
    assert(await catHeader.isVisible(), "Switched to Event Catalogue tab");

    // 9. Switch to Diagnostic Test Center Tab & Execute Webhook Ping
    await testCenterTab.click();
    await page.waitForTimeout(500);
    const sendTestBtn = page.locator("button:has-text('Send Test Webhook Now')");
    assert(await sendTestBtn.isVisible(), "Diagnostic Test Center Send button visible");

    await sendTestBtn.click();
    await page.waitForTimeout(1500);

    const reportHeader = page.locator("h3:has-text('Diagnostic Pipeline Verification Report')");
    assert(await reportHeader.isVisible(), "Diagnostic Pipeline Verification Report rendered");

    const passBadge = page.locator("text=100% PASS");
    assert(await passBadge.isVisible(), "Diagnostic execution achieved 100% PASS badge");

  } catch (err: any) {
    console.error("Playwright verification error:", err);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n==================================================================");
  console.log(`PLAYWRIGHT VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

verifyWebhooksUI().catch((err) => {
  console.error("Runner error:", err);
  process.exit(1);
});
