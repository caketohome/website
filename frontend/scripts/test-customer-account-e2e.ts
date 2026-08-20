/**
 * CakeToHome — Customer Experience, Authentication & Account System E2E Test Suite
 * Validates the complete customer lifecycle:
 * Authentication -> Identity Mapping -> Standardized /api/customer/me -> Account Dashboard -> Orders -> Addresses -> Security
 */

import { ApiEngine } from "../src/lib/api-engine";
import type { CustomerProfileDTO, CustomerStatsDTO } from "../src/lib/crm/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — Details: ${detail}` : ""}`);
    failed++;
  }
}

async function runCustomerAccountTestSuite() {
  console.log("================================================================================");
  console.log("  CAKETOHOME CUSTOMER EXPERIENCE & ACCOUNT REBUILD — E2E TEST SUITE");
  console.log("================================================================================\n");

  const runSuffix = String(Date.now()).slice(-5);
  const testPhone = `+91 97777 ${runSuffix}`;
  const cleanTestPhone = `97777${runSuffix}`;
  const testName = "Alex R Ashok";
  const testEmail = `alex.${runSuffix}@example.com`;

  // ════════════════════════════════════════════════════════════════════════════
  // 1. AUTHENTICATION & OTP LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════════
  console.log("▶ GATE 1: Authentication & OTP Lifecycle");

  // 1.1: Request OTP for new customer
  const otpReq = ApiEngine.requestAuthOtp(testPhone);
  assert(otpReq.success === true, "1.1: OTP request succeeds for mobile number");
  assert(otpReq.account_exists === false, "1.2: Detects new phone number as non-existent account");
  assert(Boolean(otpReq.dev_otp), "1.3: Supplies deterministic development OTP");

  // 1.2: New customer registration via OTP
  const regRes = ApiEngine.verifyAuthOtp(testPhone, "123456", { name: testName, email: testEmail });
  assert(regRes.success === true, "1.4: OTP verification succeeds for registration");
  assert(regRes.is_new_customer === true, "1.5: Correctly flags account as new customer");
  assert(regRes.role === "CUSTOMER", "1.6: Assigns CUSTOMER role");
  assert(Boolean(regRes.token), "1.7: Issues valid authentication token");
  assert(regRes.customer_uid === `cth_cus_${cleanTestPhone}`, "1.8: Derives canonical customer_uid");

  // 1.3: Existing customer login via OTP
  const loginReq = ApiEngine.requestAuthOtp(testPhone);
  assert(loginReq.account_exists === true, "1.9: Existing phone number recognized upon subsequent OTP request");

  const loginRes = ApiEngine.verifyAuthOtp(testPhone, "123456");
  assert(loginRes.success === true, "1.10: Existing customer logs in seamlessly with OTP");
  assert(loginRes.is_new_customer === false, "1.11: Flags repeat login as existing customer");
  assert(loginRes.user.name === testName, "1.12: Existing customer name preserved on login");

  // ════════════════════════════════════════════════════════════════════════════
  // 2. IDENTITY MAPPING & NAME PRESERVATION (ZERO GENERIC "CUSTOMER" FALLBACK)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 2: Customer Identity Mapping & Name Integrity");

  const resolvedUser = ApiEngine.resolveUserAccount({ customerUid: regRes.customer_uid });
  assert(resolvedUser !== null, "2.1: User account resolved from canonical memory store");
  assert(resolvedUser?.full_name === testName, "2.2: Full name matches exactly 'Alex R Ashok' (No generic 'Customer')", `Got: ${resolvedUser?.full_name}`);
  assert(resolvedUser?.name === testName, "2.3: Name alias matches 'Alex R Ashok'");
  assert(resolvedUser?.first_name === "Alex", "2.4: First name correctly extracted as 'Alex'");
  assert(resolvedUser?.last_name === "R Ashok", "2.5: Last name correctly extracted as 'R Ashok'");
  assert(resolvedUser?.phone ? resolvedUser.phone.replace(/\s+/g, "").includes(cleanTestPhone) : false, "2.6: Mobile phone correctly formatted");
  assert(resolvedUser?.email === testEmail, "2.7: Email address correctly mapped");

  // ════════════════════════════════════════════════════════════════════════════
  // 3. STANDARDIZED IDENTITY API CONTRACT (/api/customer/me)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 3: Standardized Identity API Contract (/api/customer/me)");

  const customerMe = ApiEngine.getCustomerMe({ customerUid: regRes.customer_uid });
  assert(customerMe !== null, "3.1: ApiEngine.getCustomerMe resolves authenticated customer");
  assert(customerMe?.customer_uid === `cth_cus_${cleanTestPhone}`, "3.2: CustomerProfileDTO contains canonical customer_uid");
  assert(customerMe?.full_name === testName, "3.3: CustomerProfileDTO contains authoritative full_name");
  assert(customerMe?.tier === "STANDARD", "3.4: CustomerProfileDTO contains tier");
  assert(customerMe?.lifecycle_stage === "NEW", "3.5: CustomerProfileDTO contains lifecycle_stage");
  assert(typeof customerMe?.stats === "object", "3.6: CustomerProfileDTO contains stats object");
  assert(typeof customerMe?.stats.orders === "number", "3.7: stats.orders is numeric");
  assert(typeof customerMe?.stats.total_spent === "number", "3.8: stats.total_spent is numeric");
  assert(typeof customerMe?.stats.favourite_cake === "string", "3.9: stats.favourite_cake is string");
  assert(Array.isArray(customerMe?.addresses), "3.10: CustomerProfileDTO contains addresses array");

  // ════════════════════════════════════════════════════════════════════════════
  // 4. ORDER HISTORY, STATS & FAVOURITE CAKE CALCULATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 4: Real Order Stats & Favourite Cake Calculation");

  // Place 2 orders for this customer
  const order1 = ApiEngine.addOrder({
    customer_uid: regRes.customer_uid,
    customer_id: regRes.customer_id,
    customer_name: testName,
    customer_phone: testPhone,
    customer_email: testEmail,
    total: 1299,
    grand_total: 1299,
    status: "confirmed",
    delivery_status: "preparing",
    items: [
      {
        id: "item_cake_1",
        title: "Belgian Dark Chocolate Truffle Cake",
        unit_price: 1299,
        quantity: 2,
        cake_message: "Happy Birthday Alex!",
      },
    ],
  });

  const order2 = ApiEngine.addOrder({
    customer_uid: regRes.customer_uid,
    customer_id: regRes.customer_id,
    customer_name: testName,
    customer_phone: testPhone,
    customer_email: testEmail,
    total: 850,
    grand_total: 850,
    status: "delivered",
    delivery_status: "delivered",
    items: [
      {
        id: "item_cake_2",
        title: "Red Velvet Cream Cheese Cake",
        unit_price: 850,
        quantity: 1,
      },
    ],
  });

  assert(Boolean(order1.id), "4.1: First order placed successfully");
  assert(Boolean(order2.id), "4.2: Second order placed successfully");

  // Re-fetch customer stats
  const updatedStats = ApiEngine.computeCustomerStats(regRes.customer_uid, cleanTestPhone);
  assert(updatedStats.orders === 2, "4.3: stats.orders correctly aggregates 2 orders", `Got ${updatedStats.orders}`);
  assert(updatedStats.total_spent === 2149, "4.4: stats.total_spent accurately sums ₹1299 + ₹850 = ₹2149", `Got ${updatedStats.total_spent}`);
  assert(updatedStats.favourite_cake === "Belgian Dark Chocolate Truffle Cake", "4.5: stats.favourite_cake derives most ordered cake title (Belgian Dark Chocolate Truffle Cake)", `Got ${updatedStats.favourite_cake}`);
  assert(Boolean(updatedStats.last_order_date), "4.6: stats.last_order_date captures latest timestamp");

  // ════════════════════════════════════════════════════════════════════════════
  // 5. PROFILE & PREFERENCE MUTATIONS
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 5: Profile & Preference Mutations");

  const targetUid = regRes.customer_uid || `cth_cus_${cleanTestPhone}`;
  const updateRes: any = ApiEngine.updateCustomerProfile(targetUid, {
    full_name: "Alex R Ashok Senior",
    email: "alex.senior@example.com",
    date_of_birth: "1992-08-15",
    preferences: {
      artisan_only: true,
      favourite_flavour: "Red Velvet Cream Cheese",
      whatsapp_notifications: true,
    },
  });

  assert(updateRes.success === true, "5.1: updateCustomerProfile returns success");
  assert(updateRes.customer?.full_name === "Alex R Ashok Senior", "5.2: Full name updated in customer store");
  assert(updateRes.customer?.email === "alex.senior@example.com", "5.3: Email updated in customer store");
  assert(updateRes.customer?.date_of_birth === "1992-08-15", "5.4: Date of birth updated for birthday surprise program");
  assert(updateRes.customer?.preferences?.artisan_only === true, "5.5: 100% artisan dietary preference saved");
  assert(updateRes.customer?.preferences?.favourite_flavour === "Red Velvet Cream Cheese", "5.6: Favourite flavour preference saved");

  // ════════════════════════════════════════════════════════════════════════════
  // 6. ADDRESS MANAGEMENT & BRANCH MAPPING
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 6: Address Management & Branch Mapping");

  const addrRes: any = ApiEngine.addCustomerAddress(targetUid, {
    id: `addr_test_${Date.now()}`,
    label: "Home Villa",
    type: "HOME",
    name: "Alex R Ashok Senior",
    phone: testPhone,
    address_1: "Villa 42, Palm Meadows, Whitefield",
    landmark: "Behind Columbia Asia",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560066",
    is_default: true,
  });

  assert(addrRes.success === true, "6.1: ApiEngine.addCustomerAddress saves new address");
  assert(addrRes.address?.postal_code === "560066", "6.2: Address postal_code preserved as 560066");
  assert(addrRes.address?.type === "HOME", "6.3: Address category tagged as HOME");
  assert(addrRes.address?.is_default === true, "6.4: Address saved as default delivery address");

  const custAddresses = ApiEngine.getCustomerAddresses(targetUid);
  assert(custAddresses.length >= 1, "6.5: getCustomerAddresses retrieves customer address book");

  // ════════════════════════════════════════════════════════════════════════════
  // 7. CLEAN REMOVAL OF WALLET / REFERRAL / LOYALTY MODULES
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 7: Clean Removal of Wallet, Loyalty & Referrals");

  assert((customerMe as any).wallet === undefined, "7.1: Zero wallet balances on CustomerProfileDTO");
  assert((customerMe as any).referral_code === undefined, "7.2: Zero referral codes on CustomerProfileDTO");
  assert((customerMe as any).gamification_points === undefined, "7.3: Zero gamification balances on CustomerProfileDTO");

  // ════════════════════════════════════════════════════════════════════════════
  // 8. SECURITY & ROLE ISOLATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 8: Security & Role Isolation");

  const unauthMe = ApiEngine.getCustomerMe({});
  assert(unauthMe === null, "8.1: Unauthenticated request rejected by getCustomerMe");

  const crossUser = ApiEngine.resolveUserAccount({ customerUid: "cth_cus_non_existent_99999" });
  assert(crossUser === null, "8.2: Non-existent customer UID returns null");

  const roleCustCannotBeAdmin = ApiEngine.resolveUserAccount({ role: "SUPER_ADMIN", phone: testPhone });
  assert(roleCustCannotBeAdmin === null, "8.3: Regular customer cannot escalate role to SUPER_ADMIN");

  const roleCustCannotBeDriver = ApiEngine.resolveUserAccount({ role: "DELIVERY_PARTNER", phone: testPhone });
  assert(roleCustCannotBeDriver === null, "8.4: Regular customer cannot access DELIVERY_PARTNER role");

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n================================================================================");
  console.log(`  TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`  PASS RATE: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerAccountTestSuite().catch((err) => {
  console.error("FATAL TEST SUITE ERROR:", err);
  process.exit(1);
});
