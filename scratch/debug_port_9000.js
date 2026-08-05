async function testPort9000() {
  console.log("Testing direct HTTP request to backend at http://localhost:9000/admin/branches...");

  const payload = {
    name: "Direct Port 9000 Test Hub",
    code: "HUB-888",
    address: "100 Feet Road, Indiranagar, Bengaluru",
    city: "Bengaluru",
    phone: "+91 98765 88888",
    email: `direct_9000_${Date.now()}@cakes2home.com`,
    latitude: 12.9716,
    longitude: 77.6412,
    shop_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
    is_open: true,
  };

  try {
    const res = await fetch("http://localhost:9000/admin/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("Direct Port 9000 Response Status:", res.status);
    console.log("Direct Port 9000 Response Headers:", Object.fromEntries(res.headers.entries()));

    const text = await res.text();
    console.log("Direct Port 9000 Response Body Text:", text);
  } catch (err) {
    console.error("Direct Port 9000 Fetch Error:", err.message);
  }
}

testPort9000();
