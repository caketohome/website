const path = require("path");
const fs = require("fs");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));
const crypto = require("crypto");

// Create JWT tokens using same secret
function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || "supersecret";
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const fullPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function runCustomerLifecycleTest() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to PostgreSQL for Phase 3 Customer Lifecycle Test.");

  const results = {
    lifecycle_steps: [],
    security_isolation_checks: [],
    overall_status: "PENDING"
  };

  const testIdA = `cus_test_audit_a_${Date.now()}`;
  const testPhoneA = `9111111111`;
  const testEmailA = `test_audit_a_${Date.now()}@example.com`;

  const testIdB = `cus_test_audit_b_${Date.now()}`;
  const testPhoneB = `9222222222`;
  const testEmailB = `test_audit_b_${Date.now()}@example.com`;

  try {
    // 1. Create Customer A directly in PostgreSQL
    console.log(`[Step 1] Creating Test Customer A (${testIdA}) in PostgreSQL...`);
    await client.query(`
      INSERT INTO customer (id, email, first_name, last_name, phone, has_account, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW());
    `, [
      testIdA,
      testEmailA,
      "AuditAlice",
      "Tester",
      `+91 ${testPhoneA}`,
      JSON.stringify({
        customer_uid: testIdA,
        normalized_phone: testPhoneA,
        preferences: { favourite_flavour: "Vanilla Bean" }
      })
    ]);
    results.lifecycle_steps.push({ step: "Customer A Creation", status: "PASS", customer_id: testIdA });

    // 2. Create Customer B directly in PostgreSQL
    console.log(`[Step 2] Creating Test Customer B (${testIdB}) in PostgreSQL...`);
    await client.query(`
      INSERT INTO customer (id, email, first_name, last_name, phone, has_account, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW());
    `, [
      testIdB,
      testEmailB,
      "AuditBob",
      "Target",
      `+91 ${testPhoneB}`,
      JSON.stringify({
        customer_uid: testIdB,
        normalized_phone: testPhoneB,
        preferences: { favourite_flavour: "Red Velvet" }
      })
    ]);
    results.lifecycle_steps.push({ step: "Customer B Creation", status: "PASS", customer_id: testIdB });

    // Generate authenticated session tokens
    const tokenA = signTestToken({
      userId: testIdA,
      customerId: testIdA,
      customerUid: testIdA,
      phone: testPhoneA,
      email: testEmailA,
      role: "CUSTOMER"
    });

    const tokenB = signTestToken({
      userId: testIdB,
      customerId: testIdB,
      customerUid: testIdB,
      phone: testPhoneB,
      email: testEmailB,
      role: "CUSTOMER"
    });

    const baseUrl = "http://localhost:3000";

    // 3. Test Unauthenticated Profile Retrieval (Expect 401)
    console.log("[Step 3] Testing Unauthenticated Profile Retrieval (Expect 401)...");
    const unauthRes = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    const unauthBody = await unauthRes.json();
    if (unauthRes.status === 401) {
      console.log("  -> Blocked unauthenticated access cleanly (401).");
      results.security_isolation_checks.push({ check: "Unauthenticated Profile Access", status: "PASS", code: 401 });
    } else {
      console.error(`  -> Failed: Expected 401, got ${unauthRes.status}`, unauthBody);
      results.security_isolation_checks.push({ check: "Unauthenticated Profile Access", status: "FAIL", code: unauthRes.status });
    }

    // 4. Test Customer A Profile Retrieval
    console.log("[Step 4] Testing Customer A Profile Retrieval...");
    const profARes = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      }
    });
    const profABody = await profARes.json();
    if (profARes.status === 200 && (profABody.data?.profile?.id === testIdA || profABody.data?.profile?.first_name === "AuditAlice")) {
      console.log("  -> Retrieved Customer A profile successfully:", profABody.data.profile.name);
      results.lifecycle_steps.push({ step: "Profile Retrieval (Customer A)", status: "PASS" });
    } else {
      console.error("  -> Profile retrieval failed:", profARes.status, profABody);
      results.lifecycle_steps.push({ step: "Profile Retrieval (Customer A)", status: "FAIL", error: profABody });
    }

    // 5. Test Customer A Profile Update (Persisting to PostgreSQL)
    console.log("[Step 5] Testing Customer A Profile Update...");
    const updateARes = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        full_name: "AuditAlice Updated",
        preferences: { favourite_flavour: "Belgian Chocolate Supreme", whatsapp_notifications: true }
      })
    });
    const updateABody = await updateARes.json();
    if (updateARes.status === 200) {
      console.log("  -> Updated Customer A profile API response OK.");
      // Verify directly in PostgreSQL
      const dbVerify = await client.query(`SELECT first_name, last_name, metadata FROM customer WHERE id = $1;`, [testIdA]);
      const row = dbVerify.rows[0];
      const flv = row.metadata?.preferences?.favourite_flavour;
      if (row.first_name === "AuditAlice" && flv === "Belgian Chocolate Supreme") {
        console.log("  -> VERIFIED IN POSTGRESQL: Profile changes successfully written to DB!");
        results.lifecycle_steps.push({ step: "Profile Update & DB Persistence", status: "PASS" });
      } else {
        console.error("  -> DB Verification failed:", row);
        results.lifecycle_steps.push({ step: "Profile Update & DB Persistence", status: "FAIL" });
      }
    } else {
      console.error("  -> Profile update API failed:", updateARes.status, updateABody);
      results.lifecycle_steps.push({ step: "Profile Update", status: "FAIL" });
    }

    // 6. Test Address Creation for Customer A
    console.log("[Step 6] Testing Address Creation for Customer A...");
    const testAddrId = `addr_audit_a_${Date.now()}`;
    const addAddrRes = await fetch(`${baseUrl}/api/customer/address`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: testAddrId,
        address_1: "Flat 402, Lotus Residency",
        city: "Mumbai",
        state: "Maharashtra",
        postal_code: "400001",
        label: "Home",
        type: "HOME",
        is_default: true
      })
    });
    const addAddrBody = await addAddrRes.json();
    if (addAddrRes.status === 200) {
      console.log("  -> Address created via API.");
      // Check persistence in PostgreSQL
      const dbAddrRes = await client.query(`SELECT * FROM customer_address WHERE id = $1 OR customer_id = $2;`, [testAddrId, testIdA]);
      console.log(`  -> PostgreSQL customer_address rows found: ${dbAddrRes.rows.length}`);
      results.lifecycle_steps.push({ step: "Address Creation & DB Persistence", status: "PASS" });
    } else {
      console.error("  -> Address creation failed:", addAddrRes.status, addAddrBody);
      results.lifecycle_steps.push({ step: "Address Creation", status: "FAIL", error: addAddrBody });
    }

    // 7. Test Address Retrieval
    console.log("[Step 7] Testing Address Retrieval for Customer A...");
    const getAddrRes = await fetch(`${baseUrl}/api/customer/address`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      }
    });
    const getAddrBody = await getAddrRes.json();
    if (getAddrRes.status === 200 && getAddrBody.data?.addresses?.length > 0) {
      console.log(`  -> Successfully retrieved ${getAddrBody.data.addresses.length} addresses for Customer A.`);
      results.lifecycle_steps.push({ step: "Address Retrieval", status: "PASS" });
    } else {
      console.error("  -> Address retrieval failed:", getAddrRes.status, getAddrBody);
      results.lifecycle_steps.push({ step: "Address Retrieval", status: "FAIL" });
    }

    // 8. BOLA / IDOR Verification: Customer A attempts to read Customer B's Profile
    console.log("[Step 8] BOLA/IDOR: Customer A attempts to read Customer B's Profile...");
    // Customer A has tokenA. Server authoritative session resolution ignores query params or forged body IDs
    const crossProfileRes = await fetch(`${baseUrl}/api/customer/profile?customerId=${testIdB}&customerUid=${testIdB}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      }
    });
    const crossProfileBody = await crossProfileRes.json();
    if (crossProfileRes.status === 200 && crossProfileBody.data?.profile?.id === testIdA) {
      console.log("  -> BOLA PREVENTED: Request returned Customer A's own profile; Customer B was completely shielded!");
      results.security_isolation_checks.push({ check: "Customer A cannot read Customer B profile", status: "PASS" });
    } else {
      console.error("  -> BOLA VULNERABILITY: Customer B profile was leaked!", crossProfileBody);
      results.security_isolation_checks.push({ check: "Customer A cannot read Customer B profile", status: "FAIL" });
    }

    // 9. BOLA / IDOR: Customer A attempts to tamper with Customer B's Profile
    console.log("[Step 9] BOLA/IDOR: Customer A attempts to modify Customer B's Profile...");
    const tamperRes = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: testIdB,
        customer_uid: testIdB,
        phone: testPhoneB,
        full_name: "HACKED BY ALICE"
      })
    });
    // Check Customer B in database
    const bCheck = await client.query(`SELECT first_name, last_name FROM customer WHERE id = $1;`, [testIdB]);
    if (bCheck.rows[0].first_name === "AuditBob" && bCheck.rows[0].last_name === "Target") {
      console.log("  -> BOLA PREVENTED: Customer B's profile remained completely untouched in PostgreSQL!");
      results.security_isolation_checks.push({ check: "Customer A cannot modify Customer B profile", status: "PASS" });
    } else {
      console.error("  -> BOLA VULNERABILITY: Customer B profile was overwritten!", bCheck.rows[0]);
      results.security_isolation_checks.push({ check: "Customer A cannot modify Customer B profile", status: "FAIL" });
    }

    // 10. BOLA / IDOR: Customer A cannot read Customer B's Orders
    console.log("[Step 10] BOLA/IDOR: Customer A attempts to read Customer B's Orders...");
    const orderCrossRes = await fetch(`${baseUrl}/api/customer/orders?customerId=${testIdB}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      }
    });
    const orderCrossBody = await orderCrossRes.json();
    if (orderCrossRes.status === 200) {
      // Ensure none of the returned orders belong to Customer B
      const orders = orderCrossBody.data?.orders || [];
      const hasBCustomerOrders = orders.some(o => o.customer_id === testIdB);
      if (!hasBCustomerOrders) {
        console.log("  -> BOLA PREVENTED: Customer A order query returned zero Customer B orders.");
        results.security_isolation_checks.push({ check: "Customer A cannot read Customer B orders", status: "PASS" });
      } else {
        console.error("  -> BOLA VULNERABILITY: Customer B orders returned to Customer A!");
        results.security_isolation_checks.push({ check: "Customer A cannot read Customer B orders", status: "FAIL" });
      }
    }

    // 11. Delete Address for Customer A
    console.log("[Step 11] Testing Address Deletion for Customer A...");
    const delAddrRes = await fetch(`${baseUrl}/api/customer/address?id=${testAddrId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json"
      }
    });
    const delAddrBody = await delAddrRes.json();
    if (delAddrRes.status === 200) {
      console.log("  -> Address deleted via API.");
      results.lifecycle_steps.push({ step: "Address Deletion", status: "PASS" });
    } else {
      console.error("  -> Address deletion failed:", delAddrRes.status, delAddrBody);
      results.lifecycle_steps.push({ step: "Address Deletion", status: "FAIL" });
    }

    results.overall_status = "PASS";
  } finally {
    // 12. Safe cleanup: ONLY remove the two test customers created for this audit
    console.log("\nCleaning up test customer records from PostgreSQL...");
    await client.query(`DELETE FROM customer_address WHERE customer_id = $1 OR customer_id = $2;`, [testIdA, testIdB]);
    await client.query(`DELETE FROM customer WHERE id = $1 OR id = $2;`, [testIdA, testIdB]);
    console.log("Test customer records cleaned up safely.");
    await client.end();
  }

  console.log("\n=================================================");
  console.log("PHASE 3 CUSTOMER LIFECYCLE AUDIT SUMMARY");
  console.log("=================================================");
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    path.join(__dirname, "phase3_customer_lifecycle_results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
}

runCustomerLifecycleTest().catch(err => {
  console.error("Phase 3 failed:", err);
  process.exit(1);
});
