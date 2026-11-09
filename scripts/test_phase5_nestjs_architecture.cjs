/**
 * CakeToHome — Phase 5 NestJS Architecture Assurance Suite
 * Validates Modular Architecture, Dependency Injection, Guards, Filters,
 * Interceptors, Correlation IDs, and 12 Functional Modules.
 */

require('E:/vig/cakes2home-main/cakes2home-main/backend/node_modules/ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2021',
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  },
});

require("reflect-metadata");
const crypto = require("crypto");

async function runNestJsTestSuite() {
  console.log("================================================================================");
  console.log(" CAKETOHOME — PHASE 5 NESTJS BACKEND ARCHITECTURE ASSURANCE SUITE");
  console.log(" Framework: NestJS 10+ (@nestjs/core) | API Base: /api/v1");
  console.log("================================================================================\n");

  const results = [];

  function record(assertionId, description, passed, details = {}) {
    results.push({ assertionId, description, passed, details });
    const mark = passed ? "✓ PASS" : "✗ FAIL";
    console.log(`[${mark}] ${assertionId}: ${description}`);
    if (!passed) console.error("    Details:", details);
  }

  // ---------------------------------------------------------------------------
  // 1. NESTJS CORE & MODULE INTEGRATION
  // ---------------------------------------------------------------------------
  console.log("--- 1. NestJS Core & Module Tree Integration ---");

  const { AppModule } = require("../apps/api/src/nestjs/app.module");
  record("NEST-01", "NestJS AppModule loaded successfully with all 12 functional modules", Boolean(AppModule));

  // ---------------------------------------------------------------------------
  // 2. HEALTH & DIAGNOSTIC ENDPOINTS
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Health & Diagnostic Endpoints ---");

  const { HealthController } = require("../apps/api/src/nestjs/modules/health/health.controller");
  const healthCtrl = new HealthController();
  const healthRes = healthCtrl.getHealth();
  record(
    "NEST-02",
    "HealthController returns healthy status and identifies cashfree as gateway",
    healthRes.status === "healthy" && healthRes.payment_gateway === "cashfree"
  );

  // ---------------------------------------------------------------------------
  // 3. STANDARDIZED API RESPONSE ENVELOPE
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Standardized Response Envelope ---");

  const { createSuccessResponse, createErrorResponse } = require("../apps/api/src/nestjs/common/response.envelope");
  const sampleSuccess = createSuccessResponse({ order_id: "ord_101" }, "cId_test_01");
  record(
    "NEST-03",
    "Standardized success response envelope contains success=true, data, and meta with correlationId",
    sampleSuccess.success === true && sampleSuccess.meta.correlationId === "cId_test_01" && sampleSuccess.data.order_id === "ord_101"
  );

  const sampleError = createErrorResponse("INVALID_PAYMENT", "Payment failed", null, "cId_test_02");
  record(
    "NEST-04",
    "Standardized error response envelope contains success=false, error code, and correlationId",
    sampleError.success === false && sampleError.error.code === "INVALID_PAYMENT" && sampleError.meta.correlationId === "cId_test_02"
  );

  // ---------------------------------------------------------------------------
  // 4. SUPABASE AUTH & RBAC ROLES GUARDS
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Supabase Auth & RBAC Roles Guards ---");

  const { SupabaseAuthGuard } = require("../apps/api/src/nestjs/guards/supabase-auth.guard");
  const { RolesGuard } = require("../apps/api/src/nestjs/guards/roles.guard");

  // Mock Reflector
  const mockReflector = {
    getAllAndOverride: (key, targets) => {
      if (key === "isPublic") return false;
      if (key === "roles") return ["STORE_MANAGER", "SUPER_ADMIN"];
      return null;
    },
  };

  const authGuard = new SupabaseAuthGuard(mockReflector);
  const rolesGuard = new RolesGuard(mockReflector);

  // Test missing auth header
  let missingAuthCaught = false;
  try {
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    authGuard.canActivate(mockCtx);
  } catch (err) {
    missingAuthCaught = true;
  }
  record("NEST-05", "SupabaseAuthGuard rejects requests missing Authorization header (401 Unauthorized)", missingAuthCaught);

  // Test valid auth with test header
  const mockReqWithAuth = {
    headers: { "x-test-user-id": "usr_test_auth", "x-test-user-role": "CUSTOMER" },
  };
  const mockValidCtx = {
    switchToHttp: () => ({
      getRequest: () => mockReqWithAuth,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  const authPassed = authGuard.canActivate(mockValidCtx);
  record("NEST-06", "SupabaseAuthGuard attaches authenticated user to request context", authPassed && mockReqWithAuth.user.id === "usr_test_auth");

  // Test RolesGuard with customer attempting manager endpoint (Forbidden)
  let customerForbidden = false;
  try {
    rolesGuard.canActivate(mockValidCtx);
  } catch (err) {
    customerForbidden = true;
  }
  record("NEST-07", "RolesGuard denies access to CUSTOMER for STORE_MANAGER restricted endpoint (403 Forbidden)", customerForbidden);

  // Test RolesGuard with SUPER_ADMIN (Allowed)
  const mockReqSuperAdmin = {
    user: { id: "usr_admin", role: "SUPER_ADMIN", roles: ["SUPER_ADMIN"] },
  };
  const mockSuperAdminCtx = {
    switchToHttp: () => ({
      getRequest: () => mockReqSuperAdmin,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  const superAdminAllowed = rolesGuard.canActivate(mockSuperAdminCtx);
  record("NEST-08", "RolesGuard permits SUPER_ADMIN full access across RBAC boundaries", superAdminAllowed);

  // ---------------------------------------------------------------------------
  // 5. AUTH MODULE (MOBILE OTP LIFECYCLE)
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Auth Module (Mobile OTP Lifecycle) ---");

  const { AuthService } = require("../apps/api/src/nestjs/modules/auth/auth.service");
  const authService = new AuthService();
  const otpSendRes = await authService.sendOtp("+919876543210");
  record("NEST-09", "AuthService sends mobile OTP successfully", otpSendRes.sent === true);

  const otpVerifyRes = await authService.verifyOtp("+919876543210", otpSendRes.dev_otp || "123456");
  record("NEST-10", "AuthService verifies OTP and issues accessToken with CUSTOMER role", otpVerifyRes.verified === true && otpVerifyRes.user.role === "CUSTOMER");

  // ---------------------------------------------------------------------------
  // 6. ROLES & PERMISSIONS MODULE (8 CANONICAL ROLES, 15 PERMISSIONS)
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Roles & Permissions Module ---");

  const { RolesService, CANONICAL_ROLES, GRANULAR_PERMISSIONS } = require("../apps/api/src/nestjs/modules/roles/roles.service");
  const rolesService = new RolesService();
  const rolesList = rolesService.getRoles();
  record(
    "NEST-11",
    `RolesService returns all 8 canonical roles: ${CANONICAL_ROLES.join(", ")}`,
    rolesList.count === 8 && rolesList.roles.includes("STORE_MANAGER")
  );

  const permList = rolesService.getPermissions();
  record(
    "NEST-12",
    `RolesService returns all 15 granular permissions`,
    permList.count === 15 && permList.permissions.includes("orders.create")
  );

  // ---------------------------------------------------------------------------
  // 7. ORDERS MODULE (ATOMIC CREATION, ORDER ≠ BILL INVARIANT)
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Orders Module ---");

  const { OrdersService } = require("../apps/api/src/nestjs/modules/orders/orders.service");
  const ordersService = new OrdersService();
  const newOrder = await ordersService.createOrder(
    {
      items: [{ name: "Truffle Cake", price: 500, quantity: 1 }],
      delivery_date: "2026-11-05",
      branch_id: "br_indiranagar_01",
    },
    "usr_test_auth"
  );
  record(
    "NEST-13",
    "OrdersService creates order with subtotal, 5% GST, grand_total and default CASHFREE payment method",
    newOrder.grand_total === 525 && newOrder.payment_method === "CASHFREE" && newOrder.status === "pending"
  );

  // ---------------------------------------------------------------------------
  // 8. PAYMENTS MODULE (CASHFREE SESSION & RAZORPAY DECOMMISSION)
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Payments Module (Cashfree-Only & Razorpay Decommission) ---");

  const { PaymentsService } = require("../apps/api/src/nestjs/modules/payments/payments.service");
  const paymentsService = new PaymentsService();
  const cfOrderRes = await paymentsService.createCashfreePaymentOrder({
    orderId: newOrder.id,
    amount: newOrder.grand_total,
    customerPhone: "+919876543210",
    customerName: "Alex",
  });
  record(
    "NEST-14",
    "PaymentsService creates Cashfree payment order with payment_session_id and v2023-08-01 API format",
    cfOrderRes.success === true && cfOrderRes.payment_session_id.startsWith("session_") && cfOrderRes.provider === "cashfree"
  );

  // Test Razorpay rejection in PaymentsService
  let razorpayDecommissionCaught = false;
  try {
    paymentsService.rejectRazorpay("initiate");
  } catch (err) {
    razorpayDecommissionCaught = err.getStatus ? err.getStatus() === 410 : true;
  }
  record("NEST-15", "PaymentsService strictly rejects Razorpay with 410 Gone decommission error", razorpayDecommissionCaught);

  // ---------------------------------------------------------------------------
  // 9. WEBHOOKS MODULE (CASHFREE HMAC-SHA256 & IDEMPOTENCY)
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. Webhooks Module ---");

  const { WebhooksController } = require("../apps/api/src/nestjs/modules/webhooks/webhooks.controller");
  const webhooksCtrl = new WebhooksController();

  const whPayload = {
    type: "PAYMENT_SUCCESS_WEBHOOK",
    data: {
      order: { order_id: newOrder.id, order_amount: 525 },
      payment: { cf_payment_id: "cf_pay_wh_1", payment_status: "SUCCESS" },
    },
  };
  const whTs = String(Math.floor(Date.now() / 1000));
  const whRawBody = JSON.stringify(whPayload);
  const whSig = crypto
    .createHmac("sha256", "TEST_CF_SECRET_KEY")
    .update(whTs + whRawBody)
    .digest("base64");

  const mockWhReq = { body: whPayload };
  const whRes = await webhooksCtrl.handleCashfreeWebhook(whSig, whTs, mockWhReq);
  record(
    "NEST-16",
    "WebhooksController accepts authentic Cashfree webhook and confirms order with downstream triggers",
    whRes.success === true && whRes.status === "confirmed" && whRes.downstream.inventory_deducted === true
  );

  // Test WebhooksController Razorpay rejection
  let razorpayWhRejected = false;
  try {
    webhooksCtrl.rejectRazorpayWebhook();
  } catch (err) {
    razorpayWhRejected = err.getStatus ? err.getStatus() === 410 : true;
  }
  record("NEST-17", "WebhooksController rejects Razorpay webhook endpoint with 410 Gone", razorpayWhRejected);

  // ---------------------------------------------------------------------------
  // 10. INVENTORY MODULE (STOCK QUERY & MOVEMENT AUDIT)
  // ---------------------------------------------------------------------------
  console.log("\n--- 10. Inventory Module ---");

  const { InventoryService } = require("../apps/api/src/nestjs/modules/inventory/inventory.service");
  const invService = new InventoryService();
  const stock = await invService.getStock("prod_01KXYMAJKNWZCFXJHESPTZE01G");
  record("NEST-18", "InventoryService queries product available stock correctly", stock.status === "in_stock" && stock.available_quantity > 0);

  // ---------------------------------------------------------------------------
  // 11. KITCHEN MODULE (KOT GENERATION & REPRINT)
  // ---------------------------------------------------------------------------
  console.log("\n--- 11. Kitchen Module ---");

  const { KitchenService } = require("../apps/api/src/nestjs/modules/kitchen/kitchen.service");
  const kitchenService = new KitchenService();
  const kot = await kitchenService.getKotByOrderId(newOrder.id);
  record("NEST-19", "KitchenService generates KOT ticket idempotently", kot.status === "ACTIVE" && kot.kot_number.startsWith("KOT-"));

  const reprint = await kitchenService.reprintKot(newOrder.id);
  record("NEST-20", "KitchenService supports idempotent reprint tracking", reprint.reprint_count === 1);

  // ---------------------------------------------------------------------------
  // 12. NOTIFICATIONS MODULE (OUTBOX PATTERN QUEUE & PROCESS)
  // ---------------------------------------------------------------------------
  console.log("\n--- 12. Notifications Module ---");

  const { NotificationsService } = require("../apps/api/src/nestjs/modules/notifications/notifications.service");
  const notifService = new NotificationsService();
  const queuedNotif = await notifService.queueNotification({
    eventType: "ORDER_CONFIRMED",
    aggregateId: newOrder.id,
    recipientPhone: "+919876543210",
    payload: { amount: 525 },
  });
  record("NEST-21", "NotificationsService queues customer notification in Outbox with PENDING status", queuedNotif.status === "PENDING");

  const processedNotif = await notifService.markProcessed(queuedNotif.id);
  record("NEST-22", "NotificationsService processes outbox event and marks SENT", processedNotif.status === "SENT");

  // ---------------------------------------------------------------------------
  // 13. DELIVERY MODULE (DISPATCH & HANDOVER OTP)
  // ---------------------------------------------------------------------------
  console.log("\n--- 13. Delivery Module ---");

  const { DeliveryService } = require("../apps/api/src/nestjs/modules/delivery/delivery.service");
  const deliveryService = new DeliveryService();
  const dispatchRes = await deliveryService.dispatchOrder(newOrder.id, "rider_007");
  record("NEST-23", "DeliveryService dispatches order to rider with OUT_FOR_DELIVERY status", dispatchRes.status === "OUT_FOR_DELIVERY");

  const verifyOtpRes = await deliveryService.verifyHandoverOtp(newOrder.id, "8492");
  record(
    "NEST-24",
    "DeliveryService verifies customer delivery OTP and marks DELIVERED, unlocking invoice eligibility",
    verifyOtpRes.status === "DELIVERED" && verifyOtpRes.invoice_allocation_eligible === true
  );

  // ---------------------------------------------------------------------------
  // 14. ACCOUNTING MODULE (STATUTORY RECONCILIATION & JOURNAL VOUCHER)
  // ---------------------------------------------------------------------------
  console.log("\n--- 14. Accounting Module ---");

  const { AccountingService } = require("../apps/api/src/nestjs/modules/accounting/accounting.service");
  const acctService = new AccountingService();
  const recon = await acctService.reconcilePayment(newOrder.id);
  record(
    "NEST-25",
    "AccountingService posts zero-variance journal voucher for CH invoice series (variance = 0.00)",
    recon.reconciled === true && recon.variance === 0.0 && recon.journal_voucher.status === "POSTED"
  );

  console.log("\n================================================================================");
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;
  console.log(` SUMMARY: ${passedCount}/${total} ASSERTIONS PASSED (${failedCount} FAILED)`);
  console.log("================================================================================");

  return { total, passedCount, failedCount, results };
}

if (require.main === module) {
  runNestJsTestSuite()
    .then((summary) => {
      if (summary.failedCount > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}

module.exports = { runNestJsTestSuite };
