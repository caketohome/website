const path = require("path");
const fs = require("fs");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));
const crypto = require("crypto");

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || "supersecret";
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const fullPayload = { ...payload, iat: Math.floor(Date.now() / 1000), exp };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function runAuthAndFailureAudit() {
  const baseUrl = "http://localhost:3000";
  console.log("Starting Phase 14 & 15: Auth/Authorization Matrix & Database Resilience Audit...\n");

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  const custRes = await pgClient.query(`SELECT id, email, phone FROM customer WHERE deleted_at IS NULL LIMIT 1;`);
  const realCust = custRes.rows[0];
  await pgClient.end();

  console.log(`Loaded real customer from PostgreSQL: ${realCust.id} (${realCust.email || realCust.phone})`);

  const results = {
    phase14_auth_matrix: [],
    phase15_resilience_and_mock_inspection: {
      catch_block_mock_fallbacks_found: [],
      error_handling_verified: []
    },
    overall_status: "PENDING"
  };

  const branchAId = "br_koramangala";
  const branchBId = "br_mumbai_bandra";

  // Canonical Tokens
  const tokenCustomerA = signTestToken({
    userId: realCust.id,
    customerId: realCust.id,
    customerUid: realCust.id,
    phone: realCust.phone,
    email: realCust.email,
    role: "CUSTOMER"
  });

  const tokenManagerA = signTestToken({
    userId: "shpmgr_koramangala",
    role: "BRANCH_MANAGER",
    branchId: branchAId
  });

  const tokenManagerB = signTestToken({
    userId: "shpmgr_mumbai_bandra",
    role: "BRANCH_MANAGER",
    branchId: branchBId
  });

  const tokenSuperAdmin = signTestToken({
    userId: "admin_01",
    role: "SUPER_ADMIN",
    isSuperAdmin: true
  });

  // Helper tester
  async function testEndpoint(testName, path, method, token, expectedStatus, body = null) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${baseUrl}${path}`, opts);
    const passed = res.status === expectedStatus;
    const item = {
      test: testName,
      path,
      method,
      expectedStatus,
      actualStatus: res.status,
      status: passed ? "PASS" : "FAIL"
    };
    results.phase14_auth_matrix.push(item);
    console.log(`[${item.status}] ${testName}: Expected ${expectedStatus}, Got ${res.status}`);
    return res;
  }

  // ==========================================
  // PHASE 14: AUTH & AUTHORIZATION MATRIX
  // ==========================================
  console.log("\n--- Executing Phase 14 Auth Matrix Tests ---");

  // 1. Unauthenticated checks
  await testEndpoint("Unauthenticated Profile Access", "/api/customer/profile", "GET", null, 401);
  await testEndpoint("Unauthenticated Manager Dashboard Access", "/api/v1/manager/dashboard", "GET", null, 401);
  await testEndpoint("Unauthenticated Admin Telemarketing Access", "/api/v1/admin/telemarketing/candidates", "GET", null, 401);
  await testEndpoint("Unauthenticated Admin Reports Access", "/api/v1/admin/reports/sales", "GET", null, 401);

  // 2. Customer Access Checks (RBAC & BOLA)
  await testEndpoint("Customer Access to Own Profile", "/api/customer/profile", "GET", tokenCustomerA, 200);
  await testEndpoint("Customer Access to Manager Dashboard (Forbidden)", "/api/v1/manager/dashboard", "GET", tokenCustomerA, 403);
  await testEndpoint("Customer Access to Admin Telemarketing (Forbidden)", "/api/v1/admin/telemarketing/candidates", "GET", tokenCustomerA, 403);
  await testEndpoint("Customer Access to Admin Reports (Forbidden)", "/api/v1/admin/reports/sales", "GET", tokenCustomerA, 403);

  // 3. Manager Isolation Checks
  await testEndpoint("Manager A Access to Own Branch Dashboard", "/api/v1/manager/dashboard", "GET", tokenManagerA, 200);
  await testEndpoint("Manager A Cross-Branch Availability Edit to Branch B (Forbidden)", `/api/v1/branches/${branchBId}/products/acc_01/availability`, "POST", tokenManagerA, 403, {
    is_available: false
  });
  await testEndpoint("Manager B Access to Own Branch Dashboard", "/api/v1/manager/dashboard", "GET", tokenManagerB, 200);
  await testEndpoint("Manager B Cross-Branch Availability Edit to Branch A (Forbidden)", `/api/v1/branches/${branchAId}/products/acc_01/availability`, "POST", tokenManagerB, 403, {
    is_available: false
  });
  await testEndpoint("Manager A Access to Admin Telemarketing (Forbidden)", "/api/v1/admin/telemarketing/candidates", "GET", tokenManagerA, 403);
  await testEndpoint("Manager A Access to Global Admin Reports (Forbidden)", "/api/v1/admin/reports/sales", "GET", tokenManagerA, 403);

  // 4. Super Admin Operations
  await testEndpoint("Super Admin Access to Manager Dashboard", "/api/v1/manager/dashboard", "GET", tokenSuperAdmin, 200);
  await testEndpoint("Super Admin Cross-Branch Product Availability Edit", `/api/v1/branches/${branchBId}/products/acc_01/availability`, "POST", tokenSuperAdmin, 200, {
    is_available: true
  });
  await testEndpoint("Super Admin Access to Admin Telemarketing Candidates", "/api/v1/admin/telemarketing/candidates", "GET", tokenSuperAdmin, 200);
  await testEndpoint("Super Admin Access to Admin Sales Reports", "/api/v1/admin/reports/sales", "GET", tokenSuperAdmin, 200);

  // ==========================================
  // PHASE 15: DATABASE FAILURE & FALLBACK RESILIENCE
  // ==========================================
  console.log("\n--- Executing Phase 15 Database Failure & Resilience Audit ---");

  // Inspect repositories for silent mock fallbacks
  const repoDir = path.join(__dirname, "../frontend/src/lib/repositories");
  const repoFiles = fs.readdirSync(repoDir).filter(f => f.endsWith(".ts"));

  let mockFallbacksDetected = 0;
  for (const file of repoFiles) {
    const content = fs.readFileSync(path.join(repoDir, file), "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/catch\s*\(.*?\)/i.test(line)) {
        const block = lines.slice(i, i + 6).join("\n");
        if (/return\s*\[\s*\{.*?(mock|dummy|fake|sample)/i.test(block)) {
          results.phase15_resilience_and_mock_inspection.catch_block_mock_fallbacks_found.push({
            file,
            line: i + 1,
            snippet: block
          });
          mockFallbacksDetected++;
        }
      }
    }
  }

  console.log(`Audited ${repoFiles.length} repository files for silent catch-block mock fallbacks. Found: ${mockFallbacksDetected}`);

  // Test invalid query parameter handling - should return 400 or 404, never fabricate fake records
  const badParamRes = await fetch(`${baseUrl}/api/v1/catalog/products/non_existent_uuid_999999999999`);
  const passBadParam = badParamRes.status === 404;
  results.phase15_resilience_and_mock_inspection.error_handling_verified.push({
    test: "Non-existent Product Query returns 404 (No synthetic fallback)",
    expectedStatus: 404,
    actualStatus: badParamRes.status,
    status: passBadParam ? "PASS" : "FAIL"
  });
  console.log(`[${passBadParam ? "PASS" : "FAIL"}] Non-existent Product Query: ${badParamRes.status}`);

  // Test non-existent branch inventory query
  const badBranchRes = await fetch(`${baseUrl}/api/v1/branches/non_existent_branch_999/inventory`, {
    headers: { "Authorization": `Bearer ${tokenSuperAdmin}` }
  });
  const passBadBranch = badBranchRes.status === 404 || badBranchRes.status === 400 || (badBranchRes.status === 200 && (await badBranchRes.clone().json()).inventory?.length === 0);
  results.phase15_resilience_and_mock_inspection.error_handling_verified.push({
    test: "Non-existent Branch Inventory Query handles gracefully (No synthetic inventory generated)",
    status: passBadBranch ? "PASS" : "FAIL",
    actualStatus: badBranchRes.status
  });
  console.log(`[${passBadBranch ? "PASS" : "FAIL"}] Non-existent Branch Inventory Query: ${badBranchRes.status}`);

  // Overall Status
  const allAuthPassed = results.phase14_auth_matrix.every(t => t.status === "PASS");
  const allFailurePassed = results.phase15_resilience_and_mock_inspection.error_handling_verified.every(t => t.status === "PASS") && mockFallbacksDetected === 0;

  results.overall_status = allAuthPassed && allFailurePassed ? "PASS" : "FAIL";

  console.log("\n=================================================");
  console.log("PHASE 14 & 15 AUDIT SUMMARY");
  console.log("=================================================");
  console.log(`Overall Status: ${results.overall_status}`);
  console.log(`Auth Matrix Tests Passed: ${results.phase14_auth_matrix.filter(t => t.status === "PASS").length}/${results.phase14_auth_matrix.length}`);

  fs.writeFileSync(
    path.join(__dirname, "phase14_phase15_auth_failure_results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log("Saved results to scratch/phase14_phase15_auth_failure_results.json");
}

runAuthAndFailureAudit().catch(err => {
  console.error("Phase 14 & 15 failed:", err);
  process.exit(1);
});
