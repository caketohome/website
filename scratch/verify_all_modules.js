const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000/api/v1";

const results = [];

async function runVerification() {
  console.log("==================================================================");
  console.log("STARTING DUAL-MODE DATASTORE HEADER & PROXY VERIFICATION");
  console.log("==================================================================\n");

  await new Promise((r) => setTimeout(r, 1000));

  // 1. Dashboard Overview
  try {
    const res = await fetch(`${BASE_URL}/admin/health`);
    const data = await res.json();
    const sourceHeader = res.headers.get("x-data-source") || "unknown";
    results.push({
      module: "Dashboard Overview Health",
      endpoint: "/admin/health",
      method: "GET",
      status: res.status,
      dataSourceHeader: sourceHeader,
      storageProperty: data?.storage,
      persistence: res.status === 200 ? "PASSED" : "FAILED",
      notes: `Served via ${sourceHeader}`,
    });
  } catch (err) {
    results.push({ module: "Dashboard Overview Health", endpoint: "/admin/health", method: "GET", status: 500, dataSourceHeader: "none", storageProperty: "none", persistence: "FAILED", notes: err.message });
  }

  // 2. Branches (Create & List)
  try {
    const testBranchName = `Header Verification Branch ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testBranchName,
        city: "Bangalore",
        address: "100 Feet Rd, Indiranagar",
        phone: "+91 98765 99999",
      }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source") || "unknown";

    const fetchRes = await fetch(`${BASE_URL}/admin/branches`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.branches?.some((b) => b.name === testBranchName);

    results.push({
      module: "Branches (Create & List)",
      endpoint: "/admin/branches",
      method: "POST / GET",
      status: createRes.status,
      dataSourceHeader: sourceHeader,
      storageProperty: createData?.storage,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Branch created and verified via ${sourceHeader}` : "Branch NOT found",
    });
  } catch (err) {
    results.push({ module: "Branches", endpoint: "/admin/branches", method: "POST", status: 500, dataSourceHeader: "none", storageProperty: "none", persistence: "FAILED", notes: err.message });
  }

  // 3. Products & Catalog
  try {
    const prodTitle = `Header Verification Cake ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/catalog/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: prodTitle, name: prodTitle, price: 799, category: "Artisanal Cakes", description: "Test Cake" }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source") || "unknown";

    const fetchRes = await fetch(`${BASE_URL}/admin/catalog/products`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.products?.some((p) => p.title === prodTitle || p.name === prodTitle);

    results.push({
      module: "Products & Catalog",
      endpoint: "/admin/catalog/products",
      method: "POST / GET",
      status: createRes.status,
      dataSourceHeader: sourceHeader,
      storageProperty: createData?.storage,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Product published and verified via ${sourceHeader}` : "Product NOT found",
    });
  } catch (err) {
    results.push({ module: "Products & Catalog", endpoint: "/admin/catalog/products", method: "POST", status: 500, dataSourceHeader: "none", storageProperty: "none", persistence: "FAILED", notes: err.message });
  }

  console.log("\n==================================================================");
  console.log("VERIFICATION COMPLETE — DUAL-MODE HEADER & PROXY MATRIX:");
  console.log("==================================================================");
  console.table(results.map(r => ({ Module: r.module, Endpoint: r.endpoint, Method: r.method, Status: r.status, DataSourceHeader: r.dataSourceHeader, StorageProperty: r.storageProperty, Persistence: r.persistence, Notes: r.notes })));

  const scratchDir = path.join(process.cwd(), "scratch");
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
  fs.writeFileSync(path.join(scratchDir, "header_verification_results.json"), JSON.stringify(results, null, 2), "utf-8");
}

runVerification();
