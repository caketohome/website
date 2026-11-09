const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || "supersecret";
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = {
    userId: payload.userId || "admin_01",
    role: payload.role || "SUPER_ADMIN",
    phone: payload.phone || "+91 99999 00001",
    isSuperAdmin: payload.role === "SUPER_ADMIN" || payload.userId === "admin_01",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

const token = signTestToken({ userId: "admin_01", role: "SUPER_ADMIN" });

const endpoints = [
  "kpis",
  "transactional",
  "products",
  "branches",
  "cities",
  "service-areas",
  "payments",
  "gst",
  "orders",
  "customers",
  "cross-sell",
  "delivery",
  "exceptions",
  "daily",
  "weekly",
  "monthly"
];

async function checkEndpoint(ep) {
  return new Promise((resolve) => {
    const url = `/api/v1/admin/reports/${ep}?startDate=2026-01-01&endDate=2026-12-31`;
    const options = {
      hostname: "localhost",
      port: 3001,
      path: url,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Cookie": `_cth_jwt=${token}; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01`,
        "Accept": "application/json"
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({
            endpoint: ep,
            status: res.statusCode,
            success: res.statusCode === 200,
            hasData: json && (json.data !== undefined || json.kpis !== undefined || json.metrics !== undefined || json.success === true),
            rawSnippet: data.substring(0, 150)
          });
        } catch (e) {
          resolve({
            endpoint: ep,
            status: res.statusCode,
            success: false,
            error: e.message,
            rawSnippet: data.substring(0, 150)
          });
        }
      });
    });

    req.on("error", (e) => {
      resolve({ endpoint: ep, status: "ERROR", error: e.message });
    });

    req.end();
  });
}

async function run() {
  console.log("== Testing /api/v1/admin/reports/* Endpoints on localhost:3001 ==");
  const results = [];
  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    console.log(`[${res.success ? "PASS" : "FAIL"}] /api/v1/admin/reports/${ep} -> HTTP ${res.status}`);
    results.push(res);
  }
  fs.writeFileSync(path.join(__dirname, "reports_api_test_results.json"), JSON.stringify(results, null, 2));
  console.log("Results written to scratch/reports_api_test_results.json");
}

run();
