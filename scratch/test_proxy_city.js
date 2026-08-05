async function testProxyCity() {
  const authRes = await fetch("http://localhost:9000/auth/user/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@email.com", password: "supersecret" }),
  });
  const authData = await authRes.json();
  const token = authData.token || authData.access_token;

  console.log("Testing POST to http://localhost:3000/api/v1/admin/cities with Bearer Token...");
  const res = await fetch("http://localhost:3000/api/v1/admin/cities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ name: `Proxy Test City ${Date.now()}`, state: "Karnataka", is_active: true }),
  });

  console.log("Proxy Status:", res.status);
  console.log("X-Data-Source Header:", res.headers.get("x-data-source"));
  console.log("Response Body:", await res.json());
}

testProxyCity();
