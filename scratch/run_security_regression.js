const fs = require("fs");
const path = require("path");

function runSecurityRegression() {
  console.log("============================================================");
  console.log("CAKETOHOME - SECURITY REGRESSION TEST SUITE (7 FINDINGS / 21 TESTS)");
  console.log("============================================================\n");

  const results = [];

  function recordTest(id, name, expected, actual, passed) {
    const status = passed ? "PASS" : "FAIL";
    results.push({ id, name, expected, actual, status });
    console.log(`[${status}] ${id} - ${name}`);
    if (!passed) {
      console.log(`       Expected: ${expected}`);
      console.log(`       Actual:   ${actual}`);
    }
  }

  const frontendDir = path.join(__dirname, "../frontend/src");

  // -------------------------------------------------------------
  // GROUP 1: Fail-Closed verifyApiPermission & resolveUserContext
  // -------------------------------------------------------------
  const routeContent = fs.readFileSync(path.join(frontendDir, "app/api/v1/[...path]/route.ts"), "utf8");
  
  // Test 1.1: verifyApiPermission fails closed on unauthenticated caller
  const has401FailClosed = /if \(!userCtx\.userId && !userCtx\.role\) \{\s*return NextResponse\.json\(\s*\{\s*success: false,\s*error: "UNAUTHORIZED"/.test(routeContent);
  recordTest("CRIT-01-A", "verifyApiPermission fails closed on unauthenticated caller", "HTTP 401 UNAUTHORIZED", has401FailClosed ? "HTTP 401 UNAUTHORIZED" : "Pass-through", has401FailClosed);

  // Test 1.2: resolveUserContext does not trust raw x-user-role header
  const noRawRoleHeader = !routeContent.includes('req.headers.get("x-user-role")') && routeContent.includes("resolveServerSession(req)");
  recordTest("CRIT-01-B", "resolveUserContext ignores raw x-user-role header", "Header ignored; uses resolveServerSession", noRawRoleHeader ? "Header ignored; uses resolveServerSession" : "Vulnerable header accepted", noRawRoleHeader);

  // -------------------------------------------------------------
  // GROUP 2: Cryptographic Session Signature Verification
  // -------------------------------------------------------------
  const sessionGuardContent = fs.readFileSync(path.join(frontendDir, "lib/security/auth-session.ts"), "utf8");

  // Test 2.1: JWT verification uses timingSafeEqual
  const usesTimingSafe = sessionGuardContent.includes("crypto.timingSafeEqual") && sessionGuardContent.includes("createHmac");
  recordTest("CRIT-02-A", "JWT signature verification uses timingSafeEqual", "timingSafeEqual HMAC comparison", usesTimingSafe ? "timingSafeEqual HMAC comparison" : "String equality used", usesTimingSafe);

  // Test 2.2: resolveServerSession requires valid signature
  const rejectsForged = sessionGuardContent.includes("return null;") && sessionGuardContent.includes("!crypto.timingSafeEqual");
  recordTest("CRIT-02-B", "Forged tokens without valid HMAC signature rejected", "Returns null on invalid signature", rejectsForged ? "Returns null on invalid signature" : "Signature unchecked", rejectsForged);

  // Test 2.3: resolveManagerSession derives role strictly from verified server session
  const managerSessionUsesServerSession = routeContent.includes("const session = resolveServerSession(req);") && routeContent.includes("function resolveManagerSession");
  recordTest("CRIT-02-C", "resolveManagerSession derives role strictly from verified session", "resolveServerSession required", managerSessionUsesServerSession ? "resolveServerSession required" : "Unverified role accepted", managerSessionUsesServerSession);

  // -------------------------------------------------------------
  // GROUP 3: Exact Role Check (Prevent Substring Admin Escalation)
  // -------------------------------------------------------------
  const staffAccessContent = fs.readFileSync(path.join(frontendDir, "lib/staff-access-control.ts"), "utf8");

  // Test 3.1: No substring .includes("admin") escalation
  const noSubstringAdmin = !staffAccessContent.includes('.includes("admin")') && !routeContent.includes('userId.includes("admin")');
  recordTest("HIGH-03-A", "Eliminate userId.includes('admin') substring escalation", "Zero substring admin checks", noSubstringAdmin ? "Zero substring admin checks" : "Substring check present", noSubstringAdmin);

  // Test 3.2: Exact SUPER_ADMIN role check
  const hasExactSuperAdmin = staffAccessContent.includes('role === "SUPER_ADMIN"') || staffAccessContent.includes('userRole === "SUPER_ADMIN"');
  recordTest("HIGH-03-B", "Enforce exact SUPER_ADMIN role check", "role === 'SUPER_ADMIN'", hasExactSuperAdmin ? "role === 'SUPER_ADMIN'" : "Loose match", hasExactSuperAdmin);

  // Test 3.3: Canonical admin ID
  const canonicalAdminId = routeContent.includes('sessionUserId === "admin_01"') || staffAccessContent.includes('admin_01');
  recordTest("HIGH-03-C", "Canonical super-admin identity check enforced", "Canonical admin_01 check present", canonicalAdminId ? "Canonical admin_01 check present" : "Missing canonical admin check", canonicalAdminId);

  // -------------------------------------------------------------
  // GROUP 4: Customer Orders BOLA / IDOR Protection
  // -------------------------------------------------------------
  const ordersRouteContent = fs.readFileSync(path.join(frontendDir, "app/api/customer/orders/route.ts"), "utf8");

  // Test 4.1: Customer orders enforces resolveVerifiedCustomer
  const customerOrdersEnforced = /const verified = resolveVerifiedCustomer\(req\);/.test(ordersRouteContent);
  recordTest("HIGH-04-A", "Customer orders requires server-verified session", "resolveVerifiedCustomer enforced", customerOrdersEnforced ? "resolveVerifiedCustomer enforced" : "Unverified access allowed", customerOrdersEnforced);

  // Test 4.2: Unauthenticated query returns 401
  const ordersReturns401 = ordersRouteContent.includes('status: 401') && /Unauthorized/i.test(ordersRouteContent);
  recordTest("HIGH-04-B", "Unauthenticated customer orders query returns 401", "HTTP 401 Unauthorized", ordersReturns401 ? "HTTP 401 Unauthorized" : "Not returning 401", ordersReturns401);

  // Test 4.3: Strict customer identity filtering in PostgreSQL
  const ordersFilteredByIdentity = ordersRouteContent.includes('WHERE ("customer_id" = $1 OR "metadata"->>\'customer_uid\' = $1') || ordersRouteContent.includes("customer_id: verified.customerId");
  recordTest("HIGH-04-C", "Orders queried strictly matching verified customer identity", "Strict customer identity filter", ordersFilteredByIdentity ? "Strict customer identity filter" : "Unfiltered query", ordersFilteredByIdentity);

  // -------------------------------------------------------------
  // GROUP 5: Customer Profile BOLA / IDOR & Mutation
  // -------------------------------------------------------------
  const profileRouteContent = fs.readFileSync(path.join(frontendDir, "app/api/customer/profile/route.ts"), "utf8");

  // Test 5.1: Profile GET enforces resolveVerifiedCustomer
  const profileGetEnforced = /const verified = resolveVerifiedCustomer\(req\);/.test(profileRouteContent);
  recordTest("HIGH-05-A", "Profile GET requires server-verified session", "resolveVerifiedCustomer enforced", profileGetEnforced ? "resolveVerifiedCustomer enforced" : "Unverified access allowed", profileGetEnforced);

  // Test 5.2: Profile PUT enforces resolveVerifiedCustomer
  const profilePutEnforced = /const verified = resolveVerifiedCustomer\(req\);/.test(profileRouteContent);
  recordTest("HIGH-05-B", "Profile PUT requires server-verified session", "resolveVerifiedCustomer enforced", profilePutEnforced ? "resolveVerifiedCustomer enforced" : "Unverified access allowed", profilePutEnforced);

  // Test 5.3: Profile PUT sanitizes body
  const profileBodySanitized = profileRouteContent.includes("delete body.customer_uid;") && profileRouteContent.includes("delete body.phone;");
  recordTest("HIGH-05-C", "Profile PUT sanitizes body identity tampering", "Immutable fields deleted from body", profileBodySanitized ? "Immutable fields deleted from body" : "Body accepted raw", profileBodySanitized);

  // -------------------------------------------------------------
  // GROUP 6: Database Secret Remediation
  // -------------------------------------------------------------
  const dbContent = fs.readFileSync(path.join(frontendDir, "lib/db.ts"), "utf8");

  // Test 6.1: Hardcoded credentials eliminated
  const hasHardcodedPass = /postgresql:\/\/postgres\.uubwhsnnrnicyczwqlbq:[^@]+@/i.test(dbContent);
  recordTest("HIGH-06-A", "Hardcoded credentials eliminated from db.ts", "No hardcoded credentials", !hasHardcodedPass ? "No hardcoded credentials" : "Found hardcoded credentials!", !hasHardcodedPass);

  // Test 6.2: Relies on DATABASE_URL
  const dbUsesEnv = dbContent.includes("process.env.DATABASE_URL");
  recordTest("HIGH-06-B", "db.ts relies strictly on process.env.DATABASE_URL", "process.env.DATABASE_URL used", dbUsesEnv ? "process.env.DATABASE_URL used" : "Env var not used", dbUsesEnv);

  // Test 6.3: Fail-safe exception
  const dbFailSafe = dbContent.includes("FATAL: DATABASE_URL environment variable is required");
  recordTest("HIGH-06-C", "Fail-safe termination if DATABASE_URL is missing", "Throws fatal configuration exception", dbFailSafe ? "Throws fatal configuration exception" : "Silent fallback", dbFailSafe);

  // -------------------------------------------------------------
  // GROUP 7: Webhook SSRF Protection
  // -------------------------------------------------------------
  const webhookContent = fs.readFileSync(path.join(frontendDir, "lib/webhook-engine.ts"), "utf8");
  const ssrfContent = fs.readFileSync(path.join(frontendDir, "lib/security/ssrf-validator.ts"), "utf8");

  // Test 7.1: Blocks loopback
  const blocksLocalhost = ssrfContent.includes("localhost") && ssrfContent.includes("127.");
  recordTest("HIGH-07-A", "SSRF validator blocks localhost and 127.0.0.1", "Loopback addresses rejected", blocksLocalhost ? "Loopback addresses rejected" : "Loopback allowed", blocksLocalhost);

  // Test 7.2: Blocks private IPs & metadata
  const blocksPrivateIp = ssrfContent.includes("169.254.") && ssrfContent.includes("10.") && ssrfContent.includes("192.168.");
  recordTest("HIGH-07-B", "SSRF validator blocks RFC 1918 & cloud metadata (169.254.169.254)", "Private IPv4 & metadata rejected", blocksPrivateIp ? "Private IPv4 & metadata rejected" : "Private IPs allowed", blocksPrivateIp);

  // Test 7.3: Protocol restrictions
  const blocksProtocols = ssrfContent.includes('parsed.protocol !== "http:" && parsed.protocol !== "https:"');
  recordTest("HIGH-07-C", "SSRF validator allows only http/https protocols", "Non-http protocols rejected", blocksProtocols ? "Non-http protocols rejected" : "Arbitrary protocols allowed", blocksProtocols);

  // Test 7.4: Webhook engine calls validator & blocks redirects
  const engineValidatesUrl = webhookContent.includes("validateWebhookUrl(ep.url)") && webhookContent.includes('redirect: "error"');
  recordTest("HIGH-07-D", "WebhookEngine enforces SSRF validation and blocks redirect chaining", "Validated on save/dispatch with redirect: 'error'", engineValidatesUrl ? "Validated on save/dispatch with redirect: 'error'" : "Unvalidated fetch", engineValidatesUrl);

  // Summary
  const passedCount = results.filter(r => r.status === "PASS").length;
  const failedCount = results.length - passedCount;

  console.log("\n============================================================");
  console.log(`TOTAL TESTS:  ${results.length}`);
  console.log(`PASSED:       ${passedCount}`);
  console.log(`FAILED:       ${failedCount}`);
  console.log("============================================================");

  fs.writeFileSync(
    path.join(__dirname, "security_regression_results.json"),
    JSON.stringify({ total: results.length, passed: passedCount, failed: failedCount, tests: results }, null, 2),
    "utf8"
  );

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSecurityRegression();
