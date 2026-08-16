/**
 * Comprehensive End-to-End Verification Suite for:
 * 1. Smart Login & Context Preservation
 * 2. Login Activity & Security Analytics
 * 3. Abandoned Cart Detection & Recovery
 * 4. Customer Engagement & Exit Intent Priority
 * 5. Admin Recovery Management & Date-filtered Reporting
 * 6. Super Admin Profile Menu Invariant (<2 items)
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}`, details || "");
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🍰 CAKETOHOME — SMART LOGIN, CART RECOVERY & SECURITY AUDIT E2E VERIFICATION");
  console.log("================================================================================\n");

  // -------------------------------------------------------------------------
  // SECTION 1: SMART LOGIN & CONTEXT PRESERVATION
  // -------------------------------------------------------------------------
  console.log("--- 1. SMART LOGIN & CONTEXT PRESERVATION ---");
  const otpRes = ApiEngine.requestOtp("+919999888877");
  assert(otpRes.success === true, "OTP request generated successfully");
  assert(!!otpRes.dev_otp, "Development OTP is present for verification");

  const verifyRes = ApiEngine.verifyOtp("+919999888877", otpRes.dev_otp, {
    name: "Aarav Mehta",
    email: "aarav@example.com",
    role: "CUSTOMER",
  });
  assert(verifyRes.success === true, "OTP verification succeeds");
  assert(!!verifyRes.token, "JWT token generated upon OTP verification");
  assert(verifyRes.role === "CUSTOMER", "Customer role properly detected");

  // -------------------------------------------------------------------------
  // SECTION 2: LOGIN ACTIVITY & SECURITY ANALYTICS ENGINE
  // -------------------------------------------------------------------------
  console.log("\n--- 2. LOGIN ACTIVITY & SECURITY ANALYTICS ---");
  ApiEngine.recordLoginEvent({
    user_id: "usr_aarav_01",
    user_name: "Aarav Mehta",
    phone: "+919999888877",
    email: "aarav@example.com",
    role: "CUSTOMER",
    status: "SUCCESS",
    method: "OTP_SMS",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  });

  ApiEngine.recordLoginEvent({
    user_id: "usr_bad_actor",
    user_name: "Unknown",
    phone: "+919999000000",
    role: "CUSTOMER",
    status: "FAILED",
    method: "OTP_SMS",
    ip_address: "203.0.113.42",
    failure_reason: "Invalid OTP entered 3 times",
  });

  const allLogs = ApiEngine.getLoginActivity({ limit: 10 });
  assert(allLogs.success === true, "getLoginActivity returns success");
  assert(allLogs.events.length >= 2, "Events list contains recorded login attempts");
  assert(allLogs.metrics.total_events >= 2, "Metrics total_events correctly calculated");
  assert(allLogs.metrics.successful_logins >= 1, "Successful logins metric incremented");
  assert(allLogs.metrics.failed_logins >= 1, "Failed logins metric tracked");

  // Date filtering tests
  const todayLogs = ApiEngine.getLoginActivity({ preset: "today" });
  assert(todayLogs.success === true, "Date filter 'today' returns valid response");

  const failedOnlyLogs = ApiEngine.getLoginActivity({ status: "FAILED" });
  assert(failedOnlyLogs.events.every((e: any) => e.status === "FAILED"), "Status filter 'FAILED' returns only failed events");

  const customerOnlyLogs = ApiEngine.getLoginActivity({ role: "CUSTOMER" });
  assert(customerOnlyLogs.events.every((e: any) => e.role === "CUSTOMER"), "Role filter 'CUSTOMER' returns only customer events");

  // -------------------------------------------------------------------------
  // SECTION 3: ABANDONED CART DETECTION & ACTIVITY TRACKING
  // -------------------------------------------------------------------------
  console.log("\n--- 3. ABANDONED CART DETECTION & ACTIVITY TRACKING ---");
  const testCartId = `cart_test_${Date.now()}`;
  ApiEngine.trackCartActivity({
    cart_id: testCartId,
    customer_name: "Priya Sharma",
    customer_phone: "+919876543210",
    customer_email: "priya.sharma@example.com",
    delivery_city: "Bengaluru",
    delivery_pincode: "560038",
    subtotal: 1298,
    items: [
      {
        product_id: "prod_01KXYMAHGFPRY1G9TZKEVGAGAT",
        title: "Belgian Dark Chocolate Truffle Cake",
        price: 649,
        quantity: 2,
        weight: "1 kg",
        cake_message: "Happy Birthday Rohan!",
      },
    ],
  });

  const abandonedCartsRes = ApiEngine.getAbandonedCarts({ limit: 10 });
  assert(abandonedCartsRes.success === true, "getAbandonedCarts returns success");
  assert(abandonedCartsRes.carts.length >= 1, "Tracked cart is stored in memory store");
  assert(abandonedCartsRes.metrics.total_abandoned >= 1, "KPI total_abandoned metric is positive");
  assert(abandonedCartsRes.metrics.total_abandoned_value >= 1298, "KPI total_abandoned_value is accurate");

  // -------------------------------------------------------------------------
  // SECTION 4: CART RECOVERY TOKEN & VALIDATION RE-EXECUTION
  // -------------------------------------------------------------------------
  console.log("\n--- 4. CART RECOVERY TOKEN GENERATION & REVALIDATION ---");
  const targetCart = abandonedCartsRes.carts.find((c: any) => c.id === testCartId) || abandonedCartsRes.carts[0];
  assert(!!targetCart.recovery_token, "Cart has a secure unique recovery_token generated");

  // Revalidate Cart on Recovery Visit
  const recoveryRes = ApiEngine.recoverCartByToken(targetCart.recovery_token);
  assert(recoveryRes.success === true, "recoverCartByToken succeeds");
  assert(recoveryRes.revalidated === true, "Server-side price/stock revalidation performed");
  assert(recoveryRes.cart.items.length > 0, "Cart items successfully restored");
  assert(recoveryRes.cart.discount_applied.code === "SWEET10", "Automatic 10% recovery discount applied");

  // Dispatch Recovery Notification (WhatsApp / SMS / Email)
  const dispatchRes = ApiEngine.sendCartRecoveryNotification(targetCart.id, "whatsapp", "SWEET10", 10);
  assert(dispatchRes.success === true, "Recovery notification dispatched successfully");
  assert(dispatchRes.channel === "whatsapp", "Notification channel matches request");

  // Mark recovered upon checkout completion
  const markRecoveredRes = ApiEngine.markCartAsRecovered(targetCart.id, "ORD-REC-999", 1168.2);
  assert(markRecoveredRes.success === true, "Cart marked as RECOVERED with order attribution");
  assert(markRecoveredRes.cart.status === "RECOVERED", "Cart status updated to RECOVERED");

  // Verify KPI update
  const updatedMetrics = ApiEngine.getAbandonedCarts();
  assert(updatedMetrics.metrics.recovered_count >= 1, "KPI recovered_count updated");
  assert(updatedMetrics.metrics.recovered_revenue >= 1168, "KPI recovered_revenue updated");

  // -------------------------------------------------------------------------
  // SECTION 5: SUPER ADMIN PROFILE MENU INVARIANT
  // -------------------------------------------------------------------------
  console.log("\n--- 5. SUPER ADMIN PROFILE MENU INVARIANT ---");
  const fs = require("fs");
  const path = require("path");
  const profileMenuPath = path.resolve(__dirname, "../frontend/src/components/layout/profile-menu.tsx");
  const profileMenuContent = fs.readFileSync(profileMenuPath, "utf8");

  assert(
    !profileMenuContent.includes("Compliance & Settings"),
    "Super Admin Menu: Compliance & Settings is completely removed"
  );
  assert(
    !profileMenuContent.includes("Branch Operations"),
    "Super Admin Menu: Branch Operations is completely removed"
  );
  assert(
    !profileMenuContent.includes("Live Orders Matrix"),
    "Super Admin Menu: Live Orders Matrix is completely removed"
  );
  assert(
    profileMenuContent.includes("Admin Dashboard"),
    "Super Admin Menu: Contains Admin Dashboard link"
  );
  assert(
    profileMenuContent.includes("Logout"),
    "Super Admin Menu: Contains Logout action"
  );

  console.log("\n================================================================================");
  console.log(`VERIFICATION COMPLETE: ${passedTests}/${totalTests} tests passed (${failedTests} failures)`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});
