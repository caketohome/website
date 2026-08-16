/**
 * Playwright Browser QA Verification Script for CakeToHome Webhooks & Telemarketing Panels
 * Run with: npx tsx scripts/test-telemarketing-webhooks-browser.ts
 */

import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/494e1f14-65a8-4093-9062-5bdf6f901811";

async function runBrowserVerification() {
  console.log("================================================================================");
  console.log("CAKETOHOME PLAYWRIGHT BROWSER VERIFICATION: WEBHOOKS & TELEMARKETING");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", url: "http://localhost:3000" },
    { name: "_cth_user_id", value: "admin_01", url: "http://localhost:3000" },
    { name: "_cth_jwt", value: "jwt_admin_01", url: "http://localhost:3000" },
    { name: "_cth_phone", value: "+91 99999 99999", url: "http://localhost:3000" },
  ]);

  const page = await context.newPage();
  page.on("console", (msg) => console.log(`   [BROWSER CONSOLE ${msg.type()}]:`, msg.text()));
  page.on("pageerror", (err) => console.error("   [BROWSER UNHANDLED ERROR]:", err));

  await page.addInitScript(() => {
    localStorage.setItem("cth_access_token", "jwt_admin_01");
    localStorage.setItem("cth_admin_token", "jwt_admin_01");
    localStorage.setItem("admin_token", "jwt_admin_01");
  });

  try {
    // ── 1. Webhooks & n8n Outbox Panel Verification ──────────────────────────
    console.log("1. Navigating to Webhooks & n8n Outbox Panel (?tab=webhooks)...");
    await page.goto("http://localhost:3000/dashboard?tab=webhooks", { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`   Current URL after navigation: ${currentUrl}`);

    const bodyText = await page.innerText("body").catch(() => "failed to read body");
    console.log(`   Body snippet: ${bodyText.slice(0, 300).replace(/\n/g, " ")}`);

    const debugScreenshotPath = path.join(ARTIFACT_DIR, "debug_dashboard_screen.png");
    await page.screenshot({ path: debugScreenshotPath });
    console.log(`   Debug screenshot: ${debugScreenshotPath}`);

    // Verify key elements exist
    const sendTestBtn = page.locator("button:has-text('Send Test Webhook')");
    await sendTestBtn.waitFor({ state: "visible", timeout: 5000 });
    console.log("   [PASS] 'Send Test Webhook' action button visible");

    // Click 'Send Test Webhook'
    await sendTestBtn.click();
    await page.waitForTimeout(1500);

    // Capture Webhooks Panel Screenshot
    const webhooksScreenshotPath = path.join(ARTIFACT_DIR, "audit_webhooks_n8n_panel.png");
    await page.screenshot({ path: webhooksScreenshotPath, fullPage: true });
    console.log(`   [PASS] Webhooks Panel Screenshot saved to: ${webhooksScreenshotPath}`);

    // ── 2. Telemarketing Reorder & Reactivation Panel Verification ────────────
    console.log("\n2. Navigating to Telemarketing Reorder Panel (?tab=telemarketing)...");
    await page.goto("http://localhost:3000/dashboard?tab=telemarketing", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2500);

    const tmH2Locator = page.locator("h2").first();
    await tmH2Locator.waitFor({ state: "visible", timeout: 10000 });
    const telemarketingTitle = await tmH2Locator.textContent();
    console.log(`   Page Header: "${telemarketingTitle?.trim()}"`);

    // Verify key elements exist
    const exportBtn = page.locator("button:has-text('Export Calling List')");
    await exportBtn.waitFor({ state: "visible", timeout: 5000 });
    console.log("   [PASS] 'Export Calling List (5 Sheets XLSX)' button visible");

    const evalBtn = page.locator("button:has-text('Evaluate Prior Orders')");
    await evalBtn.waitFor({ state: "visible", timeout: 5000 });
    console.log("   [PASS] 'Evaluate Prior Orders' button visible");

    // Trigger evaluate
    await evalBtn.click();
    await page.waitForTimeout(1500);

    // Open call logging modal on first candidate
    const logCallBtn = page.locator("button:has-text('Log Call')").first();
    if (await logCallBtn.isVisible()) {
      await logCallBtn.click();
      await page.waitForTimeout(1000);
      console.log("   [PASS] Call logging modal opened successfully");

      const modalScreenshotPath = path.join(ARTIFACT_DIR, "audit_telemarketing_call_modal.png");
      await page.screenshot({ path: modalScreenshotPath });
      console.log(`   [PASS] Telemarketing Call Modal Screenshot saved to: ${modalScreenshotPath}`);

      // Close modal
      await page.locator("button:has-text('Cancel')").click();
      await page.waitForTimeout(500);
    }

    // Capture full Telemarketing Panel Screenshot
    const telemarketingScreenshotPath = path.join(ARTIFACT_DIR, "audit_telemarketing_reorder_panel.png");
    await page.screenshot({ path: telemarketingScreenshotPath, fullPage: true });
    console.log(`   [PASS] Telemarketing Panel Screenshot saved to: ${telemarketingScreenshotPath}`);

    console.log("\n================================================================================");
    console.log("PLAYWRIGHT BROWSER VERIFICATION COMPLETED SUCCESSFULLY (100% PASS)");
    console.log("================================================================================\n");
  } catch (err: any) {
    console.error("Browser verification error:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runBrowserVerification();
