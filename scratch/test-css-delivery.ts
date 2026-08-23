async function inspectAuthenticatedServer() {
  const testCases = [
    { name: "Public Storefront Home", url: "/", cookies: "" },
    { name: "Public Login Page", url: "/login", cookies: "" },
    { name: "Public Products Catalog", url: "/products", cookies: "" },
    { name: "Super Admin Dashboard", url: "/dashboard", cookies: "_cth_jwt=admin_token; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01" },
    { name: "Admin Orders Tab", url: "/dashboard?tab=orders", cookies: "_cth_jwt=admin_token; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01" },
    { name: "Admin Branches Tab", url: "/dashboard?tab=branches", cookies: "_cth_jwt=admin_token; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01" },
    { name: "Admin Customers Tab", url: "/dashboard?tab=customers", cookies: "_cth_jwt=admin_token; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01" },
    { name: "Branch Kitchen Dashboard", url: "/dashboard/shop", cookies: "_cth_jwt=mgr_token; _cth_role=BRANCH_MANAGER; _cth_user_id=usr_mgr_01; _cth_branch_id=res_01KXYMAHGFPRY1G9TZKEVGAGAT" },
    { name: "Delivery Partner Dashboard", url: "/dashboard/delivery-partner", cookies: "_cth_jwt=dlp_token; _cth_role=DELIVERY_PARTNER; _cth_user_id=dlp_01; _cth_delivery_partner_id=dlp_01" },
    { name: "Customer Account Dashboard", url: "/account", cookies: "_cth_jwt=cus_token; _cth_role=CUSTOMER; _cth_user_id=cus_9876543210; _cth_phone=9876543210" },
  ];

  let allPass = true;

  for (const tc of testCases) {
    try {
      console.log(`\n================ Testing: ${tc.name} (${tc.url}) ================`);
      const headers: Record<string, string> = {};
      if (tc.cookies) headers["Cookie"] = tc.cookies;
      const res = await fetch(`http://localhost:3000${tc.url}`, { headers, redirect: "manual" });
      console.log(`Status: ${res.status} | Content-Type: ${res.headers.get("content-type")}`);
      
      if (res.status === 307 || res.status === 302) {
        console.log(`  Redirected to: ${res.headers.get("location")}`);
        continue;
      }
      
      if (res.status !== 200) {
        console.error(`  [FAIL] Unexpected HTTP status: ${res.status}`);
        allPass = false;
        continue;
      }

      const html = await res.text();
      const cssRegex = /href=["']([^"']+\.css[^"']*)["']/g;
      const matches = [...html.matchAll(cssRegex)].map(m => m[1]);
      console.log(`Found ${matches.length} CSS link tags:`, matches);

      for (const href of matches) {
        const fullUrl = href.startsWith("http") ? href : `http://localhost:3000${href}`;
        const cssRes = await fetch(fullUrl);
        const cssText = await cssRes.text();
        console.log(`  [CSS URL] ${href}`);
        console.log(`    Status: ${cssRes.status}`);
        console.log(`    Content-Type: ${cssRes.headers.get("content-type")}`);
        console.log(`    Size: ${cssText.length} bytes`);
        if (cssRes.status !== 200 || !cssRes.headers.get("content-type")?.includes("css") || cssText.length < 1000) {
          console.error(`  [FAIL] Broken CSS asset: ${href}`);
          allPass = false;
        }
      }
    } catch (e: any) {
      console.error(`Error requesting ${tc.url}:`, e.message);
      allPass = false;
    }
  }

  console.log("\n==================================================");
  console.log(`ALL ROUTES CSS INTEGRITY RESULT: ${allPass ? "100% PASS" : "FAILED"}`);
  console.log("==================================================");
}

inspectAuthenticatedServer();
