const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function smokeTest() {
  console.log("================================================================================");
  console.log("   CAKETOHOME ROUTE SMOKE TESTS (STOREFRONT & DASHBOARD)");
  console.log("================================================================================\n");

  const routes = [
    { name: "Storefront Home", path: "/" },
    { name: "Dashboard Root", path: "/dashboard" },
    { name: "Dashboard Orders Tab", path: "/dashboard?tab=orders" },
    { name: "Dashboard Catalog Tab", path: "/dashboard?tab=catalog" },
    { name: "Dashboard Branches Tab", path: "/dashboard?tab=branches" },
    { name: "API Products", path: "/api/v1/products" },
    { name: "API Orders", path: "/api/v1/orders" },
  ];

  let passed = 0;
  let failed = 0;

  for (const r of routes) {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${r.path}`, {
        headers: { "User-Agent": "SmokeTest/1.0" },
      });
      const duration = Math.round(performance.now() - start);
      const text = await res.text();
      const status = res.status;
      const ok = status >= 200 && status < 400;

      if (ok) {
        console.log(`  ✅ [PASS] ${r.name} (${r.path}) -> HTTP ${status} in ${duration}ms (${text.length} bytes)`);
        passed++;
      } else {
        console.error(`  ❌ [FAIL] ${r.name} (${r.path}) -> HTTP ${status} in ${duration}ms`);
        failed++;
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      console.error(`  ❌ [FAIL] ${r.name} (${r.path}) -> Error after ${duration}ms: ${err.message}`);
      failed++;
    }
  }

  console.log("\n================================================================================");
  console.log(`  SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

const safetyTimer = setTimeout(() => {
  console.error("❌ TIMEOUT: smoke test exceeded 30s timeout");
  process.exit(1);
}, 30000);
safetyTimer.unref();

smokeTest().catch((err) => {
  console.error("Smoke test error:", err);
  process.exit(1);
});
