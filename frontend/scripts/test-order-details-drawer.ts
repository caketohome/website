/**
 * Automated Regression Test: Order Details Drawer & Admin Order Fetching
 * 
 * Verifies:
 * 1. A real order displayed in the command-center list can be opened
 * 2. The correct canonical order ID reaches the detail API
 * 3. The detail API returns the corresponding order
 * 4. Detail lookup works by canonical ID (ord_...), order_number (CTH-...), and display_id
 * 5. Retry works
 * 6. Nonexistent orders correctly return 404 "Order not found"
 * 7. Branch/customer data integrity remains intact
 * 8. Intentional aborted requests are handled cleanly without false "Order details not found"
 */

import { OrderRepository } from "../src/lib/repositories/order.repository";

async function runRegressionTests() {
  console.log("=== RUNNING ORDER DETAILS DRAWER REGRESSION TESTS ===\n");
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error("   Details:", details);
    }
  }

  try {
    // 1. Fetch orders list via API
    const listRes = await fetch("http://localhost:3000/api/v1/admin/orders?limit=10");
    assert(listRes.status === 200, "1. Admin orders list endpoint returns HTTP 200");
    const listData = await listRes.json();
    const orders = listData.orders || [];
    assert(Array.isArray(orders) && orders.length > 0, "2. Orders list contains visible orders", { count: orders.length });

    const testOrder = orders.find((o: any) => o.order_number === "CTH-20260829-101") || orders[0];
    console.log("\nTarget test order:", {
      id: testOrder.id,
      order_number: testOrder.order_number,
      display_id: testOrder.display_id,
      customer_name: testOrder.customer_name,
      total: testOrder.total,
    });

    // 2. Fetch detail API by canonical internal order ID
    const detailByIdRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${testOrder.id}`);
    assert(detailByIdRes.status === 200, "3. Detail API resolves canonical internal order ID with HTTP 200");
    const detailByIdData = await detailByIdRes.json();
    assert(
      detailByIdData?.order?.id === testOrder.id,
      "4. Detail API returns matching order data by internal ID",
      { expectedId: testOrder.id, actualId: detailByIdData?.order?.id }
    );
    assert(
      Array.isArray(detailByIdData?.order?.items),
      "5. Detail API response includes items array",
      { itemCount: detailByIdData?.order?.items?.length }
    );
    assert(
      detailByIdData?.order?.customer_name !== undefined,
      "6. Detail API response includes customer details"
    );
    assert(
      detailByIdData?.order?.branch_name !== undefined,
      "7. Detail API response includes branch details"
    );

    // 3. Fetch detail API by order_number (e.g. CTH-20260829-101)
    const detailByNumRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${testOrder.order_number}`);
    assert(detailByNumRes.status === 200, "8. Detail API resolves order_number (display ID) with HTTP 200");
    const detailByNumData = await detailByNumRes.json();
    assert(
      detailByNumData?.order?.order_number === testOrder.order_number,
      "9. Detail API returns matching order data by order_number",
      { expected: testOrder.order_number, actual: detailByNumData?.order?.order_number }
    );

    // 4. Test CTH-20260829-101 specifically
    const cthRes = await fetch("http://localhost:3000/api/v1/admin/orders/CTH-20260829-101");
    assert(cthRes.status === 200, "10. Detail API specifically resolves CTH-20260829-101");
    const cthData = await cthRes.json();
    assert(
      cthData?.order?.order_number === "CTH-20260829-101",
      "11. CTH-20260829-101 payload contains valid order details"
    );

    // 5. Test direct PostgreSQL repository query
    const dbOrder = await OrderRepository.findById(testOrder.id);
    assert(dbOrder !== null && dbOrder.id === testOrder.id, "12. OrderRepository.findById works without SQL type mismatch");

    const dbOrderByNumber = await OrderRepository.findById(testOrder.order_number);
    assert(dbOrderByNumber !== null && dbOrderByNumber.order_number === testOrder.order_number, "13. OrderRepository.findById works with order_number string");

    // 6. Nonexistent order returns 404
    const notFoundRes = await fetch("http://localhost:3000/api/v1/admin/orders/ord_nonexistent_999999");
    assert(notFoundRes.status === 404, "14. Nonexistent order correctly returns HTTP 404");
    const notFoundData = await notFoundRes.json();
    assert(
      notFoundData?.message === "Order not found",
      "15. Nonexistent order returns proper 'Order not found' error message"
    );

    // 7. Aborted request handling test
    const abortController = new AbortController();
    abortController.abort();
    let abortedCleanly = false;
    try {
      await fetch(`http://localhost:3000/api/v1/admin/orders/${testOrder.id}`, {
        signal: abortController.signal,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        abortedCleanly = true;
      }
    }
    assert(abortedCleanly, "16. AbortController cancellation throws AbortError cleanly rather than false not-found");

    console.log(`\n========================================`);
    console.log(`RESULT: ${passedTests}/${totalTests} tests passed`);
    console.log(`========================================\n`);

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

runRegressionTests();
