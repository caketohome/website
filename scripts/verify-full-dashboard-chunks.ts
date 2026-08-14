async function verifyAll() {
  console.log("==================================================================");
  console.log("🛡️ CAKETOHOME — FULL ROUTE & JS/CSS CHUNK VERIFICATION SUITE");
  console.log("==================================================================\n");

  const adminCookie = "_cth_jwt=mock_jwt_super_admin; _cth_role=super_admin; _cth_phone=+919876543210; _cth_user_id=usr_admin_1";

  const routes = [
    { path: "/", auth: false },
    { path: "/login", auth: false },
    { path: "/products", auth: false },
    { path: "/cart", auth: false },
    { path: "/checkout", auth: false },
    { path: "/dashboard", auth: true },
    { path: "/dashboard?tab=orders", auth: true },
    { path: "/dashboard?tab=catalog", auth: true },
    { path: "/dashboard?tab=branches", auth: true },
    { path: "/dashboard?tab=delivery", auth: true },
    { path: "/dashboard?tab=customers", auth: true },
    { path: "/dashboard?tab=marketing", auth: true },
    { path: "/dashboard?tab=analytics", auth: true },
    { path: "/dashboard?tab=settings", auth: true },
  ];

  let allPassed = true;
  let totalChunksTested = 0;
  let failedChunks = 0;

  for (const { path: routePath, auth } of routes) {
    console.log(`\nTesting Route: http://localhost:3000${routePath}`);
    const headers: Record<string, string> = {};
    if (auth) {
      headers["Cookie"] = adminCookie;
    }

    const res = await fetch(`http://localhost:3000${routePath}`, { headers });
    console.log(`  Route HTTP Status: ${res.status} ${res.statusText}`);
    const html = await res.text();

    // Check CSS
    const cssLinks = (html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []).map(l => {
      const m = l.match(/href=["'](.*?)["']/);
      return m ? m[1] : "";
    }).filter(Boolean);

    for (const cssUrl of cssLinks) {
      const fullUrl = cssUrl.startsWith("http") ? cssUrl : `http://localhost:3000${cssUrl}`;
      const cssRes = await fetch(fullUrl);
      const isOk = cssRes.status === 200;
      console.log(`    CSS [${cssRes.status}] ${cssUrl} -> ${isOk ? "✅ OK" : "❌ FAILED"}`);
      if (!isOk) allPassed = false;
    }

    // Check Scripts
    const scriptSrcs = (html.match(/<script[^>]*src=["'](.*?)["'][^>]*>/gi) || []).map(s => {
      const m = s.match(/src=["'](.*?)["']/);
      return m ? m[1] : "";
    }).filter(Boolean);

    for (const src of scriptSrcs) {
      totalChunksTested++;
      const fullUrl = src.startsWith("http") ? src : `http://localhost:3000${src}`;
      const scriptRes = await fetch(fullUrl);
      const scriptText = await scriptRes.text();
      const isOk = scriptRes.status === 200 && !scriptText.includes("<!DOCTYPE html>");
      console.log(`    JS  [${scriptRes.status}] ${src} (${scriptText.length} bytes) -> ${isOk ? "✅ 200 OK" : "❌ FAILED"}`);
      if (!isOk) {
        allPassed = false;
        failedChunks++;
      }
    }
  }

  console.log("\n==================================================================");
  console.log(`TOTAL CHUNKS TESTED: ${totalChunksTested}`);
  console.log(`FAILED CHUNKS (404/500): ${failedChunks}`);
  console.log(`ALL ROUTES STATUS: ${allPassed ? "🎉 100% PASSED — ZERO 404s!" : "❌ SOME CHUNKS FAILED"}`);
  console.log("==================================================================\n");
}

verifyAll();
