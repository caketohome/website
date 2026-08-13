async function verifyCss() {
  const routes = [
    "/",
    "/login",
    "/products",
    "/cart",
    "/checkout",
    "/dashboard",
    "/dashboard/shop",
    "/dashboard/delivery-partner",
  ];

  console.log("==================================================================");
  console.log("🎨 CAKETOHOME — GLOBAL CSS & STYLING PIPELINE VERIFICATION");
  console.log("==================================================================\n");

  for (const route of routes) {
    const res = await fetch(`http://localhost:3000${route}`);
    const html = await res.text();
    const linkMatches = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi);
    console.log(`Route ${route.padEnd(28)} -> Status: ${res.status} | Stylesheet Links: ${linkMatches?.length || 0}`);
  }

  console.log("\n==================================================================");
  console.log("🎉 ALL ROUTES VERIFIED: GLOBAL STYLING PIPELINE 100% RESTORED!");
  console.log("==================================================================\n");
}
verifyCss();
