async function testCustomerError() {
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

  const res = await fetch("http://localhost:9000/admin/crm/customers", {
    method: "POST",
    headers,
    body: JSON.stringify({ first_name: "Ananya", last_name: "Rao", email: `test_cus_${Date.now()}@example.com`, phone: "+91 98765 43210" }),
  });
  console.log("Customer POST Status:", res.status);
  console.log("Customer POST Body:", await res.text());
}

testCustomerError();
