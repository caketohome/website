async function testDirectRoutes() {
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

  console.log("--- TEST POST /admin/regions ---");
  const regRes = await fetch("http://localhost:9000/admin/regions", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: `Direct Region ${Date.now()}`, currency_code: "inr" }),
  });
  console.log("Regions Status:", regRes.status);
  console.log("Regions Response:", await regRes.text());

  console.log("\n--- TEST POST /admin/delivery/zones ---");
  const zoneRes = await fetch("http://localhost:9000/admin/delivery/zones", {
    method: "POST",
    headers,
    body: JSON.stringify({ pincode: "560038", branch_id: "br_01KYWH0RTHVHRD04J79T28RAHN", delivery_fee: 50, is_serviceable: true }),
  });
  console.log("Delivery Zones Status:", zoneRes.status);
  console.log("Delivery Zones Response:", await zoneRes.text());
}

testDirectRoutes();
