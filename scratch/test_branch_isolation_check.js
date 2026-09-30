const path = require("path");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
const crypto = require("crypto");

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || "supersecret";
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const fullPayload = { ...payload, iat: Math.floor(Date.now() / 1000), exp };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function test() {
  const branchA_id = "br_01KYWH5SXYWVPHC73TZN245CKR";
  const branchB_id = "br_01KYWH6N9KF1FZBJ252K82TE82";

  const tokenManagerA = signTestToken({
    userId: "shpmgr_test_a",
    role: "BRANCH_MANAGER",
    branchId: branchA_id
  });

  const baseUrl = "http://localhost:3000";

  // Test 1: Manager A attempts to tamper with Branch B via /branches/:bId/products/:pId/availability
  console.log("Testing POST /api/v1/branches/" + branchB_id + "/products/acc_01/availability with Manager A token...");
  const res = await fetch(`${baseUrl}/api/v1/branches/${branchB_id}/products/acc_01/availability`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tokenManagerA}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ is_available: false })
  });
  console.log("Status:", res.status);
  const body = await res.json();
  console.log("Body:", body);
}

test();
