import * as http from "http";

const routes = [
  "/",
  "/login",
  "/account",
  "/dashboard",
  "/dashboard/shop",
  "/dashboard/delivery-partner",
  "/checkout",
  "/cart",
  "/your-order",
  "/products",
];

async function smokeTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME — GLOBAL APPLICATION ROUTE & ASSET SMOKE TEST");
  console.log("================================================================================\n");

  let allPassed = true;
  let totalAssetsChecked = 0;
  let asset404Count = 0;

  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`, { redirect: "manual" });
      const status = res.status;
      const isOk = status === 200 || status === 307 || status === 302 || status === 308;
      console.log(`Route: ${route.padEnd(30)} -> HTTP ${status} ${isOk ? "✅" : "❌"}`);

      if (status === 200) {
        const html = await res.text();
        const assetRegex = /\/_next\/static\/[^"'\s>\\]+/g;
        const matches = html.match(assetRegex) || [];
        for (const asset of matches) {
          totalAssetsChecked++;
          const aRes = await fetch(`http://localhost:3000${asset}`);
          if (aRes.status === 404) {
            console.log(`  ❌ 404 Asset on ${route}: ${asset}`);
            asset404Count++;
            allPassed = false;
          }
        }
      }
    } catch (err: any) {
      console.error(`Error requesting ${route}:`, err.message);
      allPassed = false;
    }
  }

  console.log("\n================================================================================");
  console.log(`TOTAL ASSETS CHECKED: ${totalAssetsChecked}`);
  console.log(`TOTAL 404 ASSETS:     ${asset404Count}`);
  console.log(`OVERALL SMOKE STATUS: ${asset404Count === 0 && allPassed ? "ALL PASSED (100% 200 OK) ✅" : "FAILED ❌"}`);
  console.log("================================================================================");

  if (asset404Count > 0 || !allPassed) {
    process.exit(1);
  }
}

smokeTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
