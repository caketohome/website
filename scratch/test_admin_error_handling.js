async function testAdminErrorHandling() {
  console.log("=== Testing Explicit Error Handling on Admin API Mutations ===");

  // 1. Invalid Product ID Update
  console.log("\n1. Testing PATCH /api/v1/products/invalid_nonexistent_id ...");
  const res1 = await fetch('http://localhost:3000/api/v1/products/invalid_nonexistent_id', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=9999999999'
    },
    body: JSON.stringify({ title: 'New Test Name' })
  });
  const data1 = await res1.json().catch(() => ({}));
  console.log(`Status: ${res1.status}, Success: ${data1.success}, Error: "${data1.error || data1.message}"`);
  const pass1 = res1.status >= 400 || data1.success === false;
  console.log(`Explicit Error Returned: ${pass1 ? 'PASS' : 'FAIL (Fake Success Detected)'}`);

  // 2. Invalid CMS Section ID
  console.log("\n2. Testing PUT /api/v1/cms/sections/invalid_sec_123 ...");
  const res2 = await fetch('http://localhost:3000/api/v1/cms/sections/invalid_sec_123', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      cookie: '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=9999999999'
    },
    body: JSON.stringify({ content: { title: 'Test' } })
  });
  const data2 = await res2.json().catch(() => ({}));
  console.log(`Status: ${res2.status}, Success: ${data2.success}, Error: "${data2.error || data2.message}"`);
  const pass2 = res2.status >= 400 || data2.success === false;
  console.log(`Explicit Error Returned: ${pass2 ? 'PASS' : 'FAIL (Fake Success Detected)'}`);

  // 3. Invalid Order ID Status Transition
  console.log("\n3. Testing POST /api/v1/orders/invalid_ord_999/status ...");
  const res3 = await fetch('http://localhost:3000/api/v1/orders/invalid_ord_999/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=9999999999'
    },
    body: JSON.stringify({ status: 'DELIVERED' })
  });
  const data3 = await res3.json().catch(() => ({}));
  console.log(`Status: ${res3.status}, Success: ${data3.success}, Error: "${data3.error || data3.message}"`);
  const pass3 = res3.status >= 400 || data3.success === false;
  console.log(`Explicit Error Returned: ${pass3 ? 'PASS' : 'FAIL (Fake Success Detected)'}`);
}

testAdminErrorHandling().catch(console.error);
