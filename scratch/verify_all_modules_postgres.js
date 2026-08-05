const path = require("path");
const pgPath = path.join(__dirname, "../backend/node_modules/pg");
const { Client } = require(pgPath);

const BASE_URL = "http://localhost:3000/api/v1";
const connectionString = "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const results = [];

async function verifyAllModulesPostgres() {
  console.log("==================================================================");
  console.log("STARTING MASTER POSTGRESQL MODULE PIPELINE VERIFICATION MATRIX");
  console.log("==================================================================\n");

  // 1. Acquire JWT Bearer token from port 9000
  const authRes = await fetch("http://localhost:9000/auth/user/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@email.com", password: "supersecret" }),
  });
  const authData = await authRes.json();
  const token = authData.token || authData.access_token;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  const pgClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  // --- Module 1: Branches ---
  try {
    const timestamp = Date.now();
    const branchName = `Postgres Pipeline Branch ${timestamp}`;
    const branchEmail = `pg_branch_${timestamp}@cakes2home.com`;

    const createRes = await fetch(`${BASE_URL}/admin/branches`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: branchName,
        code: `HUB-${Math.floor(100 + Math.random() * 900)}`,
        address: "100 Feet Road, Indiranagar, Bengaluru",
        city: "Bengaluru",
        phone: "+91 98765 88888",
        email: branchEmail,
        latitude: 12.9716,
        longitude: 77.6412,
        shop_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
        is_open: true,
      }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source");

    const fetchRes = await fetch(`${BASE_URL}/admin/branches`, { headers });
    const fetchData = await fetchRes.json();
    const foundInGet = fetchData?.branches?.some((b) => b.email === branchEmail || b.name === branchName);

    const pgDbRes = await pgClient.query("SELECT id, name, email FROM branch WHERE email = $1;", [branchEmail]);
    const foundInPg = pgDbRes.rows.length > 0;

    results.push({
      module: "Branches",
      endpoint: "/admin/branches",
      httpStatus: createRes.status,
      xDataSource: sourceHeader,
      storageProperty: createData?.storage,
      getRefresh: foundInGet ? "PASSED ✅" : "FAILED ❌",
      postgresDb: foundInPg ? "PERSISTED ✅" : "FAILED ❌",
      status: sourceHeader === "postgres" && foundInPg ? "VERIFIED ✅" : "PENDING ⏳",
    });
  } catch (err) {
    results.push({ module: "Branches", endpoint: "/admin/branches", httpStatus: 500, xDataSource: "none", storageProperty: "none", getRefresh: "FAILED ❌", postgresDb: "FAILED ❌", status: "PENDING ⏳" });
  }

  // --- Module 2: Cities ---
  try {
    const cityName = `Postgres City ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/cities`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: cityName, state: "Karnataka", is_active: true }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source");

    const fetchRes = await fetch(`${BASE_URL}/admin/cities`, { headers });
    const fetchData = await fetchRes.json();
    const foundInGet = fetchData?.cities?.some((c) => c.name === cityName);

    const pgDbRes = await pgClient.query("SELECT id, name FROM city WHERE name = $1;", [cityName]);
    const foundInPg = pgDbRes.rows.length > 0;

    results.push({
      module: "Cities",
      endpoint: "/admin/cities",
      httpStatus: createRes.status,
      xDataSource: sourceHeader,
      storageProperty: createData?.storage,
      getRefresh: foundInGet ? "PASSED ✅" : "FAILED ❌",
      postgresDb: foundInPg ? "PERSISTED ✅" : "FAILED ❌",
      status: sourceHeader === "postgres" && foundInPg ? "VERIFIED ✅" : "PENDING ⏳",
    });
  } catch (err) {
    results.push({ module: "Cities", endpoint: "/admin/cities", httpStatus: 500, xDataSource: "none", storageProperty: "none", getRefresh: "FAILED ❌", postgresDb: "FAILED ❌", status: "PENDING ⏳" });
  }

  // --- Module 3: Delivery Zones ---
  try {
    const pin = `560${Math.floor(100 + Math.random() * 899)}`;
    const createRes = await fetch(`${BASE_URL}/admin/delivery/zones`, {
      method: "POST",
      headers,
      body: JSON.stringify({ pincode: pin, branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", delivery_fee: 49, is_serviceable: true }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source");

    const fetchRes = await fetch(`${BASE_URL}/admin/delivery/zones`, { headers });
    const fetchData = await fetchRes.json();
    const foundInGet = fetchData?.delivery_zones?.some((z) => z.pincode === pin);

    const pgDbRes = await pgClient.query("SELECT id, pincode FROM delivery_zone WHERE pincode = $1;", [pin]);
    const foundInPg = pgDbRes.rows.length > 0;

    results.push({
      module: "Delivery Zones",
      endpoint: "/admin/delivery/zones",
      httpStatus: createRes.status,
      xDataSource: sourceHeader,
      storageProperty: createData?.storage,
      getRefresh: foundInGet ? "PASSED ✅" : "FAILED ❌",
      postgresDb: foundInPg ? "PERSISTED ✅" : "FAILED ❌",
      status: sourceHeader === "postgres" && foundInPg ? "VERIFIED ✅" : "PENDING ⏳",
    });
  } catch (err) {
    results.push({ module: "Delivery Zones", endpoint: "/admin/delivery/zones", httpStatus: 500, xDataSource: "none", storageProperty: "none", getRefresh: "FAILED ❌", postgresDb: "FAILED ❌", status: "PENDING ⏳" });
  }

  // --- Module 4: Offers & Coupons ---
  try {
    const offerCode = `PROMO${Math.floor(1000 + Math.random() * 8999)}`;
    const createRes = await fetch(`${BASE_URL}/admin/offers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: `Gourmet Offer ${offerCode}`, code: offerCode, type: "flat", status: "active", is_public: true }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source");

    const fetchRes = await fetch(`${BASE_URL}/admin/offers`, { headers });
    const fetchData = await fetchRes.json();
    const foundInGet = fetchData?.offers?.some((o) => o.code === offerCode);

    const pgDbRes = await pgClient.query("SELECT id, code FROM offer WHERE code = $1;", [offerCode]);
    const foundInPg = pgDbRes.rows.length > 0;

    results.push({
      module: "Offers / Coupons",
      endpoint: "/admin/offers",
      httpStatus: createRes.status,
      xDataSource: sourceHeader,
      storageProperty: createData?.storage,
      getRefresh: foundInGet ? "PASSED ✅" : "FAILED ❌",
      postgresDb: foundInPg ? "PERSISTED ✅" : "FAILED ❌",
      status: sourceHeader === "postgres" && foundInPg ? "VERIFIED ✅" : "PENDING ⏳",
    });
  } catch (err) {
    results.push({ module: "Offers / Coupons", endpoint: "/admin/offers", httpStatus: 500, xDataSource: "none", storageProperty: "none", getRefresh: "FAILED ❌", postgresDb: "FAILED ❌", status: "PENDING ⏳" });
  }

  // --- Module 5: Settings ---
  try {
    const setKey = `support_phone_${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/admin/settings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ group: "general", key: setKey, value: "+91 80 4900 9999", description: "Support Phone Number" }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source");

    const fetchRes = await fetch(`${BASE_URL}/admin/settings?group=general`, { headers });
    const fetchData = await fetchRes.json();
    const foundInGet = Boolean(fetchData?.settings || fetchData?.group);

    const pgDbRes = await pgClient.query("SELECT id, key FROM setting WHERE key = $1;", [setKey]);
    const foundInPg = pgDbRes.rows.length > 0;

    results.push({
      module: "Settings",
      endpoint: "/admin/settings",
      httpStatus: createRes.status,
      xDataSource: sourceHeader,
      storageProperty: createData?.storage,
      getRefresh: foundInGet ? "PASSED ✅" : "FAILED ❌",
      postgresDb: foundInPg ? "PERSISTED ✅" : "FAILED ❌",
      status: sourceHeader === "postgres" && foundInPg ? "VERIFIED ✅" : "PENDING ⏳",
    });
  } catch (err) {
    results.push({ module: "Settings", endpoint: "/admin/settings", httpStatus: 500, xDataSource: "none", storageProperty: "none", getRefresh: "FAILED ❌", postgresDb: "FAILED ❌", status: "PENDING ⏳" });
  }

  // --- Module 6: Customers CRM ---
  try {
    const cusEmail = `crm_cus_${Date.now()}@example.com`;
    const createRes = await fetch(`${BASE_URL}/admin/crm/customers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ first_name: "Ananya", last_name: "Rao", email: cusEmail, phone: "+91 98765 43210" }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source");

    const fetchRes = await fetch(`${BASE_URL}/admin/crm/customers`, { headers });
    const fetchData = await fetchRes.json();
    const foundInGet = fetchData?.customers?.some((c) => c.email === cusEmail);

    const pgDbRes = await pgClient.query("SELECT id, email FROM customer WHERE email = $1;", [cusEmail]);
    const foundInPg = pgDbRes.rows.length > 0;

    results.push({
      module: "Customers CRM",
      endpoint: "/admin/crm/customers",
      httpStatus: createRes.status,
      xDataSource: sourceHeader,
      storageProperty: createData?.storage,
      getRefresh: foundInGet ? "PASSED ✅" : "FAILED ❌",
      postgresDb: foundInPg ? "PERSISTED ✅" : "FAILED ❌",
      status: sourceHeader === "postgres" && foundInPg ? "VERIFIED ✅" : "PENDING ⏳",
    });
  } catch (err) {
    results.push({ module: "Customers CRM", endpoint: "/admin/crm/customers", httpStatus: 500, xDataSource: "none", storageProperty: "none", getRefresh: "FAILED ❌", postgresDb: "FAILED ❌", status: "PENDING ⏳" });
  }

  // --- Module 7: Delivery Partners / Drivers ---
  try {
    const driverPhone = `+91 99${Math.floor(10000000 + Math.random() * 89999999)}`;
    const createRes = await fetch(`${BASE_URL}/admin/delivery/partners`, {
      method: "POST",
      headers,
      body: JSON.stringify({ first_name: "Ramesh", last_name: "Rider", phone: driverPhone }),
    });
    const createData = await createRes.json();
    const sourceHeader = createRes.headers.get("x-data-source");

    const fetchRes = await fetch(`${BASE_URL}/admin/delivery/partners`, { headers });
    const fetchData = await fetchRes.json();
    const foundInGet = fetchData?.partners?.some((p) => p.phone === driverPhone);

    const pgDbRes = await pgClient.query("SELECT id, phone FROM delivery_partner WHERE phone = $1;", [driverPhone]);
    const foundInPg = pgDbRes.rows.length > 0;

    results.push({
      module: "Delivery Partners",
      endpoint: "/admin/delivery/partners",
      httpStatus: createRes.status,
      xDataSource: sourceHeader,
      storageProperty: createData?.storage,
      getRefresh: foundInGet ? "PASSED ✅" : "FAILED ❌",
      postgresDb: foundInPg ? "PERSISTED ✅" : "FAILED ❌",
      status: sourceHeader === "postgres" && foundInPg ? "VERIFIED ✅" : "PENDING ⏳",
    });
  } catch (err) {
    results.push({ module: "Delivery Partners", endpoint: "/admin/delivery/partners", httpStatus: 500, xDataSource: "none", storageProperty: "none", getRefresh: "FAILED ❌", postgresDb: "FAILED ❌", status: "PENDING ⏳" });
  }

  await pgClient.end();

  console.log("\n==================================================================");
  console.log("FINAL POSTGRESQL MODULE VERIFICATION MATRIX RESULT:");
  console.log("==================================================================");
  console.table(results);
}

verifyAllModulesPostgres();
