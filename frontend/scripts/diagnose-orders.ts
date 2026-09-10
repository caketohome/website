async function testOrders() {
  try {
    const listRes = await fetch("http://localhost:3000/api/v1/admin/orders?limit=5");
    console.log("admin/orders status:", listRes.status);
    const listData = await listRes.json();
    console.log("listData top level keys:", Object.keys(listData));
    const orders = listData.orders || listData.data || (listData.data?.orders) || [];
    console.log("orders count:", orders.length);
    if (orders.length > 0) {
      console.log("First order summary:", {
        id: orders[0].id,
        order_number: orders[0].order_number,
        display_id: orders[0].display_id,
        customer_name: orders[0].customer_name,
      });
      
      const firstId = orders[0].id;
      const firstOrderNum = orders[0].order_number;
      
      console.log("\nTesting detail fetch by ID:", firstId);
      const detailResById = await fetch(`http://localhost:3000/api/v1/admin/orders/${firstId}`);
      console.log("Detail by ID status:", detailResById.status);
      const detailTextById = await detailResById.text();
      console.log("Detail by ID response snippet:", detailTextById.slice(0, 300));
      
      if (firstOrderNum && firstOrderNum !== firstId) {
        console.log("\nTesting detail fetch by order_number:", firstOrderNum);
        const detailResByNum = await fetch(`http://localhost:3000/api/v1/admin/orders/${firstOrderNum}`);
        console.log("Detail by order_number status:", detailResByNum.status);
        const detailTextByNum = await detailResByNum.text();
        console.log("Detail by order_number response snippet:", detailTextByNum.slice(0, 300));
      }

      // Also test CTH-20260829-101 specifically mentioned by user!
      console.log("\nTesting detail fetch specifically for CTH-20260829-101:");
      const detailResSpecific = await fetch("http://localhost:3000/api/v1/admin/orders/CTH-20260829-101");
      console.log("Detail for CTH-20260829-101 status:", detailResSpecific.status);
      const detailTextSpecific = await detailResSpecific.text();
      console.log("Detail for CTH-20260829-101 response snippet:", detailTextSpecific.slice(0, 300));
    }
  } catch (err) {
    console.error("Test error:", err);
  }
}

testOrders();
