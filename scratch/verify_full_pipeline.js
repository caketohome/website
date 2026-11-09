const path = require("path");
const pgPath = path.join(__dirname, "../backend/node_modules/pg");
const { Client } = require(pgPath);

const BASE_URL = "http://localhost:3000/api/v1";
const connectionString = "[REDACTED_DATABASE_CREDENTIAL]";

async function verifyFullPipeline() {
  console.log("==================================================================");
  console.log("STARTING FINAL END-TO-END POSTGRESQL PIPELINE PROOF VERIFICATION");
  console.log("==================================================================\n");

  // 1. Authenticate Admin User on backend port 9000 to acquire JWT Bearer Token
  console.log("1. AUTHENTICATING ADMIN USER ON PORT 9000...");
  const authRes = await fetch("http://localhost:9000/auth/user/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@email.com", password: "supersecret" }),
  });
  const authData = await authRes.json();
  const token = authData.token || authData.access_token;
  console.log("JWT Bearer Token Acquired:", token ? `${token.substring(0, 35)}...` : "NONE");

  // 2. Dispatch POST /api/v1/admin/branches through Next.js Proxy Gateway WITH Authorization Header
  console.log("\n2. DISPATCHING POST /api/v1/admin/branches THROUGH NEXT.JS PROXY GATEWAY WITH BEARER TOKEN...");
  const timestamp = Date.now();
  const testBranchName = `Full Pipeline PostgreSQL Hub ${timestamp}`;
  const testBranchEmail = `pipeline_hub_${timestamp}@cakes2home.com`;

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
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(requestPayload),
  });

  const createData = await createRes.json();
  const dataSourceHeader = createRes.headers.get("x-data-source");

  console.log("\n--- HTTP RESPONSE DETAILS ---");
  console.log("HTTP Status Code:", createRes.status);
  console.log("X-Data-Source Header:", dataSourceHeader);
  console.log("Response Body Payload:", JSON.stringify(createData, null, 2));

  // 3. Page Refresh GET Assertion
  console.log("\n3. EXECUTING PAGE REFRESH VERIFICATION (GET /api/v1/admin/branches WITH BEARER TOKEN)...");
  const fetchRes = await fetch(`${BASE_URL}/admin/branches`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const fetchData = await fetchRes.json();
  const getDataSourceHeader = fetchRes.headers.get("x-data-source");
  console.log("GET X-Data-Source Header:", getDataSourceHeader);

  const foundInApi = fetchData?.branches?.some((b) => b.name === testBranchName || b.email === testBranchEmail || b.id === createData?.branch?.id);
  console.log("Branch Present in Refresh GET Response:", foundInApi ? "YES ✅" : "NO ❌");

  // 4. PostgreSQL Database Query Assertion
  console.log("\n4. QUERYING SUPABASE POSTGRESQL DATABASE FOR PERSISTED ROW...");
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

  const foundInPostgres = pgRes.rows.some((r) => r.name === testBranchName || r.email === testBranchEmail || r.id === createData?.branch?.id);
  console.log("\nCreated Branch Found in PostgreSQL Database:", foundInPostgres ? "YES ✅" : "NO ❌");

  await client.end();

  console.log("\n==================================================================");
  console.log("FINAL END-TO-END POSTGRESQL PIPELINE PROOF RESULTS:");
  console.log(`- Next.js Proxy Target Header: ${dataSourceHeader}`);
  console.log(`- Datastore Storage Field: ${createData?.storage}`);
  console.log(`- UI GET Refresh Persistence: ${foundInApi ? "PASSED" : "FAILED"}`);
  console.log(`- Supabase PostgreSQL Persistence: ${foundInPostgres ? "PASSED" : "FAILED"}`);
  console.log("==================================================================");
}

verifyFullPipeline();
