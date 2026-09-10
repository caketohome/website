import { ApiEngine } from "../src/lib/api-engine";
import { dbQuery } from "../src/lib/db";

async function runCacheSafetyAudit() {
  console.log("================================================================================");
  console.log("CAKETOHOME — PHASE 8 FINAL HARDENING: CACHE SAFETY & BRANCH ISOLATION AUDIT");
  console.log("================================================================================\n");

  await ApiEngine.ensureHydrated();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DATA AUDIT: Public Canonical vs Context-Dependent Fields
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- 1. AUDITING PUBLIC PRODUCT FIELDS ---");
  const canonicalProduct = ApiEngine.getProductById("classic-chocolate-truffle-cake");
  if (!canonicalProduct) {
    throw new Error("Target product 'classic-chocolate-truffle-cake' not found in catalog.");
  }

  console.log("Canonical Product ID:", canonicalProduct.id);
  console.log("Canonical Price:", canonicalProduct.price);
  console.log("Has Dynamic Customer Price?", canonicalProduct.customer_price !== undefined);
  console.log("Has Cart/Checkout Tax?", canonicalProduct.tax_amount !== undefined);
  console.log("Has Delivery Fee?", canonicalProduct.delivery_fee !== undefined);
  console.log("Has Live Branch Inventory?", canonicalProduct.live_inventory !== undefined || canonicalProduct.stock_count !== undefined);
  console.log("Canonical branch_status:", canonicalProduct.branch_status);
  console.log("Canonical is_out_of_stock_at_branch:", canonicalProduct.is_out_of_stock_at_branch);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. REAL BRANCHES AVAILABILITY ISOLATION TEST
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. AUDITING REAL POSTGRESQL BRANCHES & AVAILABILITY ISOLATION ---");
  const realBranchesRes = await dbQuery<{ id: string; name: string }>(
    "SELECT id, name FROM branch ORDER BY id LIMIT 5"
  );
  const realBranches = realBranchesRes.rows;
  console.log("Found real PostgreSQL branches:", realBranches.map(b => `${b.name} (${b.id})`));

  if (realBranches.length < 2) {
    throw new Error("At least 2 real branches required in PostgreSQL database.");
  }

  const branchA = realBranches[0];
  const branchB = realBranches[1];
  console.log(`Branch A: ${branchA.name} [${branchA.id}]`);
  console.log(`Branch B: ${branchB.name} [${branchB.id}]`);

  const prodId = canonicalProduct.id;

  // Set an override on Branch A in memory store
  const store = ApiEngine.getStore();
  const bRecordA = store.branches.find((b: any) => b.id === branchA.id);
  const bRecordB = store.branches.find((b: any) => b.id === branchB.id);

  if (!bRecordA || !bRecordB) {
    throw new Error("Failed to find branch records in store.");
  }

  // Ensure branch A has product OUT_OF_STOCK, branch B has product AVAILABLE
  if (!bRecordA.product_availability) bRecordA.product_availability = {};
  if (!bRecordB.product_availability) bRecordB.product_availability = {};

  bRecordA.product_availability[prodId] = { status: "OUT_OF_STOCK", reason: "Batch depleted at Indiranagar" };
  bRecordB.product_availability[prodId] = { status: "AVAILABLE" };

  const queryBranchA = ApiEngine.getProductById(prodId, branchA.id);
  const queryBranchB = ApiEngine.getProductById(prodId, branchB.id);

  console.log(`\nDirect Availability Test:`);
  console.log(`Branch A [${branchA.name}] -> branch_status:`, queryBranchA.branch_status, "| is_out_of_stock_at_branch:", queryBranchA.is_out_of_stock_at_branch);
  console.log(`Branch B [${branchB.name}] -> branch_status:`, queryBranchB.branch_status, "| is_out_of_stock_at_branch:", queryBranchB.is_out_of_stock_at_branch);

  const isBranchIsolationPreserved = 
    queryBranchA.is_out_of_stock_at_branch === true && 
    queryBranchB.is_out_of_stock_at_branch === false;

  console.log("Branch Availability Isolation Verified in Engine:", isBranchIsolationPreserved ? "✅ PASS" : "❌ FAIL");

  // ──────────────────────────────────────────────────────────────────────────
  // 3. HTTP ENDPOINT CACHE-CONTROL & ISOLATION CHECK
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. AUDITING LIVE HTTP ENDPOINTS & CACHE-CONTROL HEADERS ---");
  const BASE_URL = "http://localhost:3000";

  // Test 1: Canonical public product listing (no branch)
  const respGlobal = await fetch(`${BASE_URL}/api/v1/products`);
  const globalCacheControl = respGlobal.headers.get("cache-control");
  console.log("GET /api/v1/products (No branch) -> HTTP", respGlobal.status, "| Cache-Control:", globalCacheControl);

  // Test 2: Branch-specific product listing (Branch A)
  const respBranchA = await fetch(`${BASE_URL}/api/v1/products?branch_id=${encodeURIComponent(branchA.id)}`);
  const branchACacheControl = respBranchA.headers.get("cache-control");
  const dataBranchA = await respBranchA.json();
  const prodInBranchA = dataBranchA.products?.find((p: any) => p.id === prodId || p.product_id === prodId);
  console.log(`GET /api/v1/products?branch_id=${branchA.id} -> HTTP`, respBranchA.status, "| Cache-Control:", branchACacheControl, "| BranchStatus:", prodInBranchA?.branch_status);

  // Test 3: Branch-specific product listing (Branch B)
  const respBranchB = await fetch(`${BASE_URL}/api/v1/products?branch_id=${encodeURIComponent(branchB.id)}`);
  const branchBCacheControl = respBranchB.headers.get("cache-control");
  const dataBranchB = await respBranchB.json();
  const prodInBranchB = dataBranchB.products?.find((p: any) => p.id === prodId || p.product_id === prodId);
  console.log(`GET /api/v1/products?branch_id=${branchB.id} -> HTTP`, respBranchB.status, "| Cache-Control:", branchBCacheControl, "| BranchStatus:", prodInBranchB?.branch_status);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. CUSTOMER PRIVATE DATA ENDPOINT AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. AUDITING SENSITIVE / CUSTOMER DATA ENDPOINTS FOR CACHE LEAKS ---");
  const SENSITIVE_ENDPOINTS = [
    "/api/v1/cart",
    "/api/v1/checkout/validate",
    "/api/v1/orders",
    "/api/v1/customer/me",
    "/api/v1/auth/me",
    "/api/v1/store/orders",
  ];

  for (const ep of SENSITIVE_ENDPOINTS) {
    try {
      const r = await fetch(`${BASE_URL}${ep}`);
      const cc = r.headers.get("cache-control") || "none (default)";
      const isPublic = cc.includes("public");
      console.log(`  Endpoint: ${ep} -> HTTP ${r.status} | Cache-Control: ${cc} | Leak Risk: ${isPublic ? "❌ CRITICAL (PUBLIC CACHE!)" : "✅ SAFE"}`);
    } catch (err: any) {
      console.log(`  Endpoint: ${ep} -> Failed: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. FIVE-RUN LATENCY STABILITY PROFILING
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. MEASURING REPEAT REQUEST STABILITY (5 ITERATIONS) ---");
  console.log("\n[Endpoint: /api/v1/products (Canonical)]");
  for (let i = 1; i <= 5; i++) {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/api/v1/products`);
    const duration = Math.round(performance.now() - start);
    const text = await res.text();
    console.log(`  Request ${i}: HTTP ${res.status} | Time: ${duration}ms | Size: ${text.length} bytes | Cache: ${res.headers.get("cache-control")}`);
  }

  console.log("\n[Endpoint: /api/v1/products/classic-chocolate-truffle-cake]");
  for (let i = 1; i <= 5; i++) {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/api/v1/products/classic-chocolate-truffle-cake`);
    const duration = Math.round(performance.now() - start);
    const text = await res.text();
    console.log(`  Request ${i}: HTTP ${res.status} | Time: ${duration}ms | Size: ${text.length} bytes | Cache: ${res.headers.get("cache-control")}`);
  }

  console.log("\n================================================================================");
  console.log("CACHE SAFETY AUDIT COMPLETE");
  console.log("================================================================================");
  process.exit(0);
}

// Hard safety timeout of 30 seconds
const safetyTimer = setTimeout(() => {
  console.error("❌ TIMEOUT: audit-phase8-cache-safety exceeded 30s timeout");
  process.exit(1);
}, 30000);
safetyTimer.unref();

runCacheSafetyAudit().catch(err => {
  console.error("Audit failed with error:", err);
  process.exit(1);
});

