async function testDeliveryPartner() {
  const res = await fetch("http://localhost:3000/dashboard/delivery-partner", {
    headers: {
      Cookie: "_cth_role=SUPER_ADMIN; _cth_jwt=jwt_super_admin_token; _cth_user_id=admin_01; _cth_phone=%2B91%2098765%2000000"
    }
  });

  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response Preview:\n", text.slice(0, 2500));
}

testDeliveryPartner().catch(console.error);
