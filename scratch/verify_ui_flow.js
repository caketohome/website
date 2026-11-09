const path = require("path");
const pgPath = path.join(__dirname, "../backend/node_modules/pg");
const { Client } = require(pgPath);

const BASE_URL = "http://localhost:3000/api/v1";
const connectionString = "[REDACTED_DATABASE_CREDENTIAL]";

async function verifyUiToPostgresFlow() {
  console.log("==================================================================");
  console.log("STARTING FULL END-TO-END PIPELINE VERIFICATION:");
  console.log("UI / API Client -> Next.js Proxy -> Backend (9000) -> PostgreSQL");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const testBranchName = `UI Verification Hub ${timestamp}`;
  const testBranchEmail = `ui_hub_${timestamp}@cakes2home.com`;

  // 1. Dispatch POST request through Next.js API Proxy Gateway (/api/v1/admin/branches)
  console.log("1. DISPATCHING POST REQUEST TO NEXT.JS PROXY GATEWAY (/api/v1/admin/branches)...");
  const requestPayload = {
    name: testBranchName,
    code: `HUB-${Math.floor(100 + Math.random() * 900)}`,
    address: "100 Feet Road, Indiranagar, Bengaluru",
    city: "Bengaluru",
    phone: "+91 98765 88888",
    email: testBranchEmail,
    latitude: 12.9716,
    longitude: 77.6412,
    shop_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
    is_open: true,
  };

  const createRes = await fetch(`${BASE_URL}/admin/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });

  const createData = await createRes.json();
  const dataSourceHeader = createRes.headers.get("x-data-source");

  console.log("\n--- HTTP RESPONSE DETAILS ---");
  console.log("HTTP Status:", createRes.status);
  console.log("X-Data-Source Header:", dataSourceHeader);
  console.log("Response Body Payload:", JSON.stringify(createData, null, 2));

  // 2. Refresh verification: Call GET /api/v1/admin/branches
  console.log("\n2. EXECUTING PAGE REFRESH VERIFICATION (GET /api/v1/admin/branches)...");
  const fetchRes = await fetch(`${BASE_URL}/admin/branches`);
  const fetchData = await fetchRes.json();

  const foundInApi = fetchData?.branches?.some((b) => b.name === testBranchName || b.email === testBranchEmail);
  console.log("Branch Present in Refresh GET Response:", foundInApi ? "YES ✅" : "NO ❌");

  // 3. Direct PostgreSQL Database Query Assertion
  console.log("\n3. QUERYING SUPABASE POSTGRESQL DATABASE FOR ROW...");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const pgRes = await client.query(
    `SELECT id, name, code, email, phone, address, shop_id, created_at 
     FROM branch 
     ORDER BY created_at DESC 
     LIMIT 5;`
  );

  console.log("\n--- POSTGRESQL TABLE 'branch' SELECT OUTPUT ---");
  console.table(pgRes.rows);

  const foundInPostgres = pgRes.rows.some((r) => r.name === testBranchName || r.email === testBranchEmail);
  console.log("Branch Found in PostgreSQL Database:", foundInPostgres ? "YES ✅" : "NO ❌");

  await client.end();

  console.log("\n==================================================================");
  console.log("END-TO-END PIPELINE VERIFICATION SUMMARY:");
  console.log(`- Next.js Proxy Target Header: ${dataSourceHeader}`);
  console.log(`- UI GET Refresh Persistence: ${foundInApi ? "PASSED" : "FAILED"}`);
  console.log(`- Supabase PostgreSQL Persistence: ${foundInPostgres ? "PASSED" : "FAILED"}`);
  console.log("==================================================================");
}

verifyUiToPostgresFlow();
