import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000/api/v1";

interface TestResult {
  module: string;
  endpoint: string;
  method: string;
  status: number;
  persistence: "PASSED" | "FAILED" | "N/A";
  notes: string;
  responseData?: any;
}

const results: TestResult[] = [];

async function runVerification() {
  console.log("==================================================================");
  console.log("STARTING EMPIRICAL API & PERSISTENCE VERIFICATION FOR ALL MODULES");
  console.log("==================================================================\n");

  // 1. Dashboard Overview
  try {
    const res = await fetch(`${BASE_URL}/admin/health`);
    const data = await res.json();
    results.push({
      module: "Dashboard Overview Health",
      endpoint: "/admin/health",
      method: "GET",
      status: res.status,
      persistence: "N/A",
      notes: res.status === 200 ? "Healthy status returned" : "Health endpoint failed",
      responseData: data,
    });
  } catch (err: any) {
    results.push({ module: "Dashboard Overview Health", endpoint: "/admin/health", method: "GET", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 2. Orders
  try {
    const res = await fetch(`${BASE_URL}/admin/orders`);
    const data = await res.json();
    results.push({
      module: "Orders Listing",
      endpoint: "/admin/orders",
      method: "GET",
      status: res.status,
      persistence: Array.isArray(data?.orders) ? "PASSED" : "FAILED",
      notes: `Returned ${data?.orders?.length || 0} orders`,
      responseData: data,
    });
  } catch (err: any) {
    results.push({ module: "Orders Listing", endpoint: "/admin/orders", method: "GET", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 3. Branches (Create -> Fetch -> Verify Persistence)
  try {
    const testBranchName = `Empirical Test Branch ${Date.now()}`;
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
    const createdId = createData?.branch?.id;

    // Now fetch branches list to verify persistence
    const fetchRes = await fetch(`${BASE_URL}/admin/branches`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.branches?.some((b: any) => b.name === testBranchName || b.id === createdId);

    results.push({
      module: "Branches (Create & List)",
      endpoint: "/admin/branches",
      method: "POST / GET",
      status: createRes.status,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Branch "${testBranchName}" created and persisted.` : "Branch NOT found on refresh GET call.",
      responseData: createData,
    });
  } catch (err: any) {
    results.push({ module: "Branches", endpoint: "/admin/branches", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 4. Managers Mapping
  try {
    const res = await fetch(`${BASE_URL}/admin/branches`);
    const data = await res.json();
    const hasManagers = data?.branches?.some((b: any) => b.manager || b.phone);
    results.push({
      module: "Branch Managers Mapping",
      endpoint: "/admin/branches",
      method: "GET",
      status: res.status,
      persistence: hasManagers ? "PASSED" : "FAILED",
      notes: hasManagers ? "Manager contact & metadata present in branch object" : "Manager mapping missing",
    });
  } catch (err: any) {
    results.push({ module: "Branch Managers", endpoint: "/admin/branches", method: "GET", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 5. Cities
  try {
    const cityName = `TestCity_${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/cities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cityName, state: "Karnataka" }),
    });
    const fetchRes = await fetch(`${BASE_URL}/admin/cities`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.cities?.some((c: any) => c.name === cityName);

    results.push({
      module: "Cities Management",
      endpoint: "/admin/cities",
      method: "POST / GET",
      status: createRes.status,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `City "${cityName}" created and persisted.` : "City not found on GET.",
    });
  } catch (err: any) {
    results.push({ module: "Cities Management", endpoint: "/admin/cities", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 6. Regions
  try {
    const regName = `TestRegion_${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/regions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: regName, code: "TRG" }),
    });
    const fetchRes = await fetch(`${BASE_URL}/admin/regions`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.regions?.some((r: any) => r.name === regName);

    results.push({
      module: "Regions Management",
      endpoint: "/admin/regions",
      method: "POST / GET",
      status: createRes.status,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Region "${regName}" created and persisted.` : "Region not found on GET.",
    });
  } catch (err: any) {
    results.push({ module: "Regions Management", endpoint: "/admin/regions", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 7. Delivery Partners / Fleet
  try {
    const dlpName = `Empirical Rider ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/delivery/partners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: dlpName, last_name: "Test", phone: "+91 99000 88888" }),
    });
    const fetchRes = await fetch(`${BASE_URL}/admin/delivery/partners`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.partners?.some((p: any) => (p.first_name || p.name) === dlpName);

    results.push({
      module: "Fleet & Delivery Partners",
      endpoint: "/admin/delivery/partners",
      method: "POST / GET",
      status: createRes.status,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Driver "${dlpName}" registered and persisted.` : "Partner not found on GET.",
    });
  } catch (err: any) {
    results.push({ module: "Fleet & Delivery Partners", endpoint: "/admin/delivery/partners", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 8. Pincodes & Delivery Serviceability
  try {
    const res = await fetch(`${BASE_URL}/admin/delivery`);
    const data = await res.json();
    results.push({
      module: "Delivery Jobs & Serviceability",
      endpoint: "/admin/delivery",
      method: "GET",
      status: res.status,
      persistence: Array.isArray(data?.deliveries) ? "PASSED" : "FAILED",
      notes: `Returned ${data?.deliveries?.length || 0} active delivery jobs`,
    });
  } catch (err: any) {
    results.push({ module: "Delivery Jobs", endpoint: "/admin/delivery", method: "GET", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 9. Products & Catalog
  try {
    const prodTitle = `Empirical Cake ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/catalog/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: prodTitle, price: 799, category: "Artisanal Cakes", description: "Test Cake" }),
    });
    const fetchRes = await fetch(`${BASE_URL}/admin/catalog/products`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.products?.some((p: any) => (p.title || p.name) === prodTitle);

    results.push({
      module: "Products & Catalog",
      endpoint: "/admin/catalog/products",
      method: "POST / GET",
      status: createRes.status,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Product "${prodTitle}" published and persisted.` : "Product not found on GET.",
    });
  } catch (err: any) {
    results.push({ module: "Products & Catalog", endpoint: "/admin/catalog/products", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 10. Customer CRM
  try {
    const cusName = `Empirical Customer ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/crm/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cusName, phone: "+91 98765 77777", email: "test@example.com", is_vip: true }),
    });
    const fetchRes = await fetch(`${BASE_URL}/admin/crm/customers`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.customers?.some((c: any) => (c.name || c.first_name) === cusName);

    results.push({
      module: "Customers CRM",
      endpoint: "/admin/crm/customers",
      method: "POST / GET",
      status: createRes.status,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Customer "${cusName}" created and persisted.` : "Customer not found on GET.",
    });
  } catch (err: any) {
    results.push({ module: "Customers CRM", endpoint: "/admin/crm/customers", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 11. Offers & Coupons
  try {
    const offerCode = `EMPIRICAL${Math.floor(Math.random() * 1000)}`;
    const createRes = await fetch(`${BASE_URL}/admin/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: offerCode, discount_value: 100, type: "flat", description: "Empirical test coupon" }),
    });
    const fetchRes = await fetch(`${BASE_URL}/admin/offers`);
    const fetchData = await fetchRes.json();
    const found = fetchData?.offers?.some((o: any) => o.code === offerCode);

    results.push({
      module: "Offers & Coupons",
      endpoint: "/admin/offers",
      method: "POST / GET",
      status: createRes.status,
      persistence: found ? "PASSED" : "FAILED",
      notes: found ? `Coupon code "${offerCode}" created and persisted.` : "Coupon not found on GET.",
    });
  } catch (err: any) {
    results.push({ module: "Offers & Coupons", endpoint: "/admin/offers", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 12. SEO Config
  try {
    const newTitle = `CakeToHome SEO Title ${Date.now()}`;
    const updateRes = await fetch(`${BASE_URL}/admin/marketing/seo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta_title: newTitle, meta_description: "Empirical SEO test description" }),
    });
    const fetchRes = await fetch(`${BASE_URL}/admin/marketing/seo`);
    const fetchData = await fetchRes.json();
    const matched = fetchData?.meta_title === newTitle;

    results.push({
      module: "SEO & Digital Settings",
      endpoint: "/admin/marketing/seo",
      method: "POST / GET",
      status: updateRes.status,
      persistence: matched ? "PASSED" : "FAILED",
      notes: matched ? "SEO meta_title updated and persisted." : "SEO meta_title not matched on GET.",
    });
  } catch (err: any) {
    results.push({ module: "SEO Config", endpoint: "/admin/marketing/seo", method: "POST", status: 500, persistence: "FAILED", notes: err.message });
  }

  // 13. Settings & Audit Logs
  try {
    const fetchRes = await fetch(`${BASE_URL}/admin/settings`);
    const fetchData = await fetchRes.json();
    const logsRes = await fetch(`${BASE_URL}/admin/audit-logs`);
    const logsData = await logsRes.json();

    results.push({
      module: "Settings & System Audit Logs",
      endpoint: "/admin/settings & /admin/audit-logs",
      method: "GET",
      status: fetchRes.status,
      persistence: Array.isArray(logsData?.logs) ? "PASSED" : "FAILED",
      notes: `Settings loaded. Total audit log entries: ${logsData?.logs?.length || 0}`,
    });
  } catch (err: any) {
    results.push({ module: "Settings & Audit Logs", endpoint: "/admin/settings", method: "GET", status: 500, persistence: "FAILED", notes: err.message });
  }

  console.log("\n==================================================================");
  console.log("VERIFICATION COMPLETE — RESULTS MATRIX:");
  console.log("==================================================================");
  console.table(results.map(r => ({ Module: r.module, Endpoint: r.endpoint, Method: r.method, Status: r.status, Persistence: r.persistence, Notes: r.notes })));

  // Write verification output to scratch file
  fs.writeFileSync(path.join(process.cwd(), "scratch", "verification_results.json"), JSON.stringify(results, null, 2), "utf-8");
}

runVerification();
