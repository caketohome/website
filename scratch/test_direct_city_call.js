async function testDirectCityCall() {
  const authRes = await fetch("http://localhost:9000/auth/user/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@email.com", password: "supersecret" }),
  });
  const authData = await authRes.json();
  const token = authData.token || authData.access_token;

  console.log("Direct POST to http://localhost:9000/admin/cities...");
  const res = await fetch("http://localhost:9000/admin/cities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ name: `Direct City ${Date.now()}`, state: "Karnataka", is_active: true }),
  });

  console.log("Direct Status:", res.status);
  console.log("Direct Body:", await res.text());
}

testDirectCityCall();
