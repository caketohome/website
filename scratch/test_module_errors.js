async function testModuleErrors() {
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

  console.log("--- 1. TEST POST /admin/branches ---");
  const bRes = await fetch("http://localhost:9000/admin/branches", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Direct Branch ${Date.now()}`,
      code: `HUB-${Math.floor(100 + Math.random() * 900)}`,
      address: "100 Feet Road, Indiranagar",
      city: "Bengaluru",
      phone: "+91 98765 88888",
      email: `direct_b_${Date.now()}@cakes2home.com`,
      latitude: 12.9716,
      longitude: 77.6412,
      shop_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      is_open: true,
    }),
  });
  console.log("Branches Status:", bRes.status, await bRes.text());

  console.log("\n--- 2. TEST POST /admin/offers ---");
  const oRes = await fetch("http://localhost:9000/admin/offers", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Summer Discount", code: `SUMMER${Math.floor(100 + Math.random() * 900)}`, type: "flat" }),
  });
  console.log("Offers Status:", oRes.status, await oRes.text());

  console.log("\n--- 3. TEST POST /admin/settings ---");
  const sRes = await fetch("http://localhost:9000/admin/settings", {
    method: "POST",
    headers,
    body: JSON.stringify({ group: "general", key: `test_key_${Date.now()}`, value: "+91 80 4900 1234" }),
  });
  console.log("Settings Status:", sRes.status, await sRes.text());

  console.log("\n--- 4. TEST POST /admin/crm/customers ---");
  const cRes = await fetch("http://localhost:9000/admin/crm/customers", {
    method: "POST",
    headers,
    body: JSON.stringify({ first_name: "Anita", last_name: "Roy", email: `anita_${Date.now()}@example.com` }),
  });
  console.log("Customers Status:", cRes.status, await cRes.text());

  console.log("\n--- 5. TEST POST /admin/delivery/partners ---");
  const dRes = await fetch("http://localhost:9000/admin/delivery/partners", {
    method: "POST",
    headers,
    body: JSON.stringify({ first_name: "Mahesh", last_name: "Rider", phone: "+91 99000 88888" }),
  });
  console.log("Partners Status:", dRes.status, await dRes.text());
}

testModuleErrors();
