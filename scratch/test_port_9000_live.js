async function testPort9000Live() {
  try {
    const res = await fetch("http://localhost:9000/auth/user/emailpass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@email.com", password: "supersecret" }),
    });
    console.log("Port 9000 Status:", res.status);
    const data = await res.json().catch(() => ({}));
    console.log("Port 9000 Token Exists:", Boolean(data.token || data.access_token));
  } catch (err) {
    console.error("Port 9000 Offline:", err.message);
  }
}

testPort9000Live();
