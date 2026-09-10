async function testDetailUrls() {
  const idsToTest = [
    "order_1788862305751_y8eh",
    "ORD-305751",
    "305751",
    "ord_1787987782845_uen52",
    "CTH-20260829-101",
    "1001",
  ];

  for (const id of idsToTest) {
    try {
      const url = `http://localhost:3000/api/v1/admin/orders/${id}`;
      const res = await fetch(url);
      const data = await res.json();
      console.log(`\nGET /admin/orders/${id}`);
      console.log(`  Status: ${res.status}`);
      console.log(`  Success: ${data.success}`);
      if (data.order) {
        console.log(`  Order found: id="${data.order.id}" order_number="${data.order.order_number}" status="${data.order.status}" total=₹${data.order.total}`);
      } else {
        console.log(`  Response:`, data);
      }
    } catch (err: any) {
      console.error(`  Fetch error for ${id}:`, err.message);
    }
  }
}

testDetailUrls();
