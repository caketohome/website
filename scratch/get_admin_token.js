async function getAdminToken() {
  console.log("Authenticating admin user against http://localhost:9000...");

  try {
    const res = await fetch("http://localhost:9000/auth/user/emailpass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@email.com", password: "supersecret" }),
    });

    console.log("Auth Response Status:", res.status);
    const data = await res.json().catch(() => ({}));
    console.log("Auth Response Data:", data);

    const token = data.token || data.access_token;
    if (token) {
      console.log("\nGot Admin Token:", token.substring(0, 35) + "...");

      // Now test POST /admin/branches with Bearer token
      const branchRes = await fetch("http://localhost:9000/admin/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: "PostgreSQL Authenticated Branch",
          code: "HUB-777",
          address: "100 Feet Road, Indiranagar, Bengaluru",
          city: "Bengaluru",
          phone: "+91 98765 88888",
          email: `auth_hub_${Date.now()}@cakes2home.com`,
          latitude: 12.9716,
          longitude: 77.6412,
          shop_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
          is_open: true,
        }),
      });

      console.log("\nPOST /admin/branches Status:", branchRes.status);
      console.log("POST /admin/branches Headers:", Object.fromEntries(branchRes.headers.entries()));
      const branchData = await branchRes.json();
      console.log("POST /admin/branches Body:", branchData);
    }
  } catch (err) {
    console.error("Auth Test Error:", err.message);
  }
}

getAdminToken();
