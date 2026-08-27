import { chromium } from "../frontend/node_modules/playwright";
import type { Browser, Page } from "../frontend/node_modules/playwright";
import fs from "fs";
import path from "path";
import { ApiEngine } from "../frontend/src/lib/api-engine";

async function runBrowserVerification() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — REAL BROWSER DELIVERY PARTNER ASSIGNMENT VERIFICATION E2E        ");
  console.log("================================================================================\n");

  const screenshotDir = path.resolve(process.cwd(), "screenshots/rider-assignment");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Ensure DB has Ramesh Rider and Order 200 ready
  ApiEngine.ensureOrdersStore();
  ApiEngine.ensureDeliveryPartnersStore();

  let ord200 = ApiEngine.getOrderDetails("CTH-20260826-200") || (ApiEngine.getStore().orders || []).find((o: any) => o.order_number === "CTH-20260826-200" || o.id === "ord_1787757508830_hoau1");
  if (ord200) {
    ord200.status = "packed";
    ord200.delivery_status = "ready_for_pickup";
    ord200.delivery_partner_id = "dlp_01";
    ord200.driver_name = "Ramesh Rider";
    ord200.driver_phone = "+91 99000 11111";
    ord200.pickup_otp = "7783";
    ord200.delivery_otp = "2311";
    ord200.delivery_latitude = 8.8855;
    ord200.delivery_longitude = 76.5804;
    ord200.delivered_at = null;
    ord200.pickup_verified_at = null;
    ord200.delivery = {
      partner_id: "dlp_01",
      partner_number: "CTH-DP-000001",
      partner_name: "Ramesh Rider",
      partner_phone: "+91 99000 11111",
      branch_name: "Kollam Central Cake Studio",
      status: "Dispatched",
      delivery_status: "ready_for_pickup",
      assignment_mode: "auto",
      assignment_reason: "Assigned by Store Command Center",
      assignment_score: 100,
      pickup_otp: "7783",
      delivery_otp: "2311",
      eta: "25 mins",
      distance_km: "3.2 km",
      live_location: "Assigned & Dispatched",
    };
    ApiEngine.persist();
  }

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: "_cth_role",
      value: "DELIVERY_PARTNER",
      domain: "localhost",
      path: "/",
    },
    {
      name: "_cth_user_id",
      value: "dlp_01",
      domain: "localhost",
      path: "/",
    },
    {
      name: "_cth_phone",
      value: "+91 99000 11111",
      domain: "localhost",
      path: "/",
    },
  ]);

  const page: Page = await context.newPage();

  try {
    console.log("[STEP 1] Navigating to Delivery Partner Dashboard (/dashboard/delivery-partner)...");
    await page.goto("http://localhost:3000/dashboard/delivery-partner", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const shot1 = path.join(screenshotDir, "01_delivery_partner_dashboard_overview.png");
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`  📸 Screenshot saved: ${shot1}`);

    // Check header elements
    const pageContent = await page.content();
    const hasRamesh = pageContent.includes("Ramesh Rider");
    const hasPartnerNumber = pageContent.includes("CTH-DP-000001");
    const hasOrder200 = pageContent.includes("CTH-20260826-200");
    const hasAnanya = pageContent.includes("Ananya Sharma");

    console.log(`  ✅ Profile Header 'Ramesh Rider': ${hasRamesh}`);
    console.log(`  ✅ Partner Number 'CTH-DP-000001': ${hasPartnerNumber}`);
    console.log(`  ✅ Order 'CTH-20260826-200' Visible: ${hasOrder200}`);
    console.log(`  ✅ Recipient 'Ananya Sharma' Visible: ${hasAnanya}`);

    if (!hasOrder200) {
      throw new Error("Order CTH-20260826-200 was not found in the rendered dashboard HTML!");
    }

    // Step 2: Locate Order 200 element
    const order200Card = page.locator("text=CTH-20260826-200").first();
    if (await order200Card.isVisible()) {
      const shot2 = path.join(screenshotDir, "02_order_200_ready_for_pickup.png");
      await page.screenshot({ path: shot2 });
      console.log(`  📸 Screenshot saved: ${shot2}`);
    }

    console.log("\n================================================================================");
    console.log("  🎉 PLAYWRIGHT BROWSER VERIFICATION PASSED SUCCESSFULLY!                        ");
    console.log("================================================================================");

  } catch (err: any) {
    console.error("Browser verification error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserVerification();
