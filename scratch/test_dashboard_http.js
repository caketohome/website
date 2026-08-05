async function testDashboardEndpoints() {
  console.log("=== TESTING DASHBOARD API ENDPOINTS VIA HTTP FETCH ===");
  
  const endpoints = [
    "/admin/health",
    "/admin/orders",
    "/admin/branches",
    "/admin/delivery",
    "/admin/crm/customers",
    "/admin/catalog/products",
    "/admin/offers",
    "/admin/settings",
    "/admin/marketing/seo",
    "/admin/analytics/dashboard",
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(`http://localhost:3000/api/v1${ep}`);
      const duration = Date.now() - start;
      const text = await res.text();
      console.log(`[GET /api/v1${ep}] Status: ${res.status} | Duration: ${duration}ms | X-Data-Source: ${res.headers.get("x-data-source")}`);
      console.log(`   Response snippet: ${text.slice(0, 150)}\n`);
    } catch (err) {
      console.log(`[GET /api/v1${ep}] FAILED: ${err.message}\n`);
    }
  }
}

testDashboardEndpoints();
