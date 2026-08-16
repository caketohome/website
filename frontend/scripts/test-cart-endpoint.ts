async function testCartApi() {
  console.log("Testing POST http://localhost:3000/api/v1/cart/items...");
  const res1 = await fetch("http://localhost:3000/api/v1/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: "prod_1",
      quantity: 1,
    }),
  });
  console.log("Status /api/v1/cart/items:", res1.status);
  const data1 = await res1.json();
  console.log("Data:", data1);

  console.log("\nTesting POST http://localhost:3000/api/v1/cart...");
  const res2 = await fetch("http://localhost:3000/api/v1/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: "prod_1",
      quantity: 1,
    }),
  });
  console.log("Status /api/v1/cart:", res2.status);
  const data2 = await res2.json();
  console.log("Data:", data2);
}

testCartApi().catch(console.error);
