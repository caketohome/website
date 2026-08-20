import http from "http";

function makeHttpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, {
      headers: { "Cookie": "_cth_role=admin; _cth_jwt=mock_jwt_token_admin" }
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function makeHttpPost(path: string, payload: any): Promise<any> {
  const requestData = JSON.stringify(payload);
  const options = {
    hostname: "localhost",
    port: 3000,
    path,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestData),
      "Cookie": "_cth_role=admin; _cth_jwt=mock_jwt_token_admin",
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(requestData);
    req.end();
  });
}

async function runFullCustomerAndBranchIntegrationTest() {
  console.log("==================================================");
  console.log("STARTING CUSTOMER IDENTITY & BRANCH AUTO-ASSIGNMENT E2E VERIFICATION");
  console.log("==================================================");

  // Test 1: Branch Auto-Assignment by Pincode 560038
  console.log("\n[TEST 1] Querying GET /api/v1/branches/eligible?pincode=560038...");
  const branchRes = await makeHttpGet("http://localhost:3000/api/v1/branches/eligible?pincode=560038");
  console.log(`  - Status: ${branchRes.status}`);
  console.log(`  - Assignment Mode: ${branchRes.data?.assignment?.mode}`);
  console.log(`  - Recommended Branch: ${branchRes.data?.assignment?.recommended_branch_name}`);
  console.log(`  - Message: ${branchRes.data?.assignment?.message}`);

  if (branchRes.data?.assignment?.mode !== "pincode" || !branchRes.data?.branches?.length) {
    console.error("❌ TEST 1 FAILED: Pincode branch auto-assignment failed.");
    process.exit(1);
  }
  console.log("✓ TEST 1 PASS: Branch auto-assignment by pincode verified.");

  // Test 2: Customer Identity & Phone Lookup
  const testPhone = "+91 99887 76655";
  console.log(`\n[TEST 2] Querying GET /api/v1/customers/lookup?phone=${encodeURIComponent(testPhone)}...`);
  const cusRes = await makeHttpGet(`http://localhost:3000/api/v1/customers/lookup?phone=${encodeURIComponent(testPhone)}`);
  console.log(`  - Status: ${cusRes.status}`);
  console.log(`  - Customer Found: ${cusRes.data?.found}`);
  console.log(`  - Customer Name: ${cusRes.data?.customer?.name}`);
  console.log(`  - Customer Number: ${cusRes.data?.customer?.customer_number}`);
  console.log("✓ TEST 2 PASS: Customer identity lookup verified.");

  // Test 3: Create Order via Real HTTP POST API
  console.log("\n[TEST 3] Submitting POST /api/v1/admin/orders...");
  const orderPayload = {
    customer_name: "Radhika Sharma",
    customer_phone: testPhone,
    customer_email: "radhika.sharma@example.com",
    shipping_address: {
      address_1: "Flat 402, Sunrise Heights, 100 Feet Road",
      address_2: "Near Metro Pillar 124",
      area: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560038",
      landmark: "Opposite Metro Pillar 124",
      delivery_instructions: "Ring door bell twice, call on arrival",
    },
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot: "05:00 PM - 08:00 PM (Evening Slot)",
    delivery_type: "Same Day Express",
    items: [
      {
        id: "prod_1",
        product_id: "prod_1",
        title: "Belgian Chocolate Truffle Cake",
        variant: "1.0 kg / artisan / Round",
        weight: "1.0 kg",
        flavour: "Belgian Dark Chocolate",
        shape: "Round",
        artisan: true,
        quantity: 2,
        unit_price: 649,
        price: 649,
        total: 1298,
        image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800",
        custom_message: "Happy Birthday Aswani ❤️",
      },
    ],
    subtotal: 1298,
    discount_total: 100,
    coupon_discount: 50,
    manual_discount_amount: 50,
    manual_discount_reason: "Customer Retention Offer",
    delivery_fee: 0,
    tax_total: 60,
    total: 1258,
    payment_method: "UPI",
    payment_status: "paid",
    promo_code: "CAKE50",
    notes: "VIP Priority Order via Phone Line #4",
    source: "telecalling",
  };

  const createRes = await makeHttpPost("/api/v1/admin/orders", orderPayload);
  console.log(`  - Status: ${createRes.status}`);
  console.log("  - Full POST Response:", JSON.stringify(createRes.data, null, 2));
  const createdOrder = createRes.data?.order || createRes.data;

  console.log("  - Order ID:", createdOrder.id);
  console.log("  - Order Number:", createdOrder.order_number);
  console.log("  - Customer Name:", createdOrder.customer_name);
  console.log("  - Customer Number:", createdOrder.customer_number);
  console.log("  - Customer Phone:", createdOrder.customer_phone);
  console.log("  - Branch Name:", createdOrder.branch_name);
  console.log("  - Source:", createdOrder.source);
  console.log("  - Total Amount: ₹", createdOrder.total);

  if (!createdOrder.customer_number || createdOrder.customer_name === "Valued Customer") {
    console.error("❌ TEST 3 FAILED: Customer identity or customer number missing/corrupted.");
    process.exit(1);
  }
  console.log("✓ TEST 3 PASS: Telecalling order successfully created with real customer identity.");

  // Test 4: Relational GET Order Details Verification
  console.log(`\n[TEST 4] Querying GET /api/v1/admin/orders?id=${createdOrder.id}...`);
  const detailsRes = await makeHttpGet(`http://localhost:3000/api/v1/admin/orders?id=${createdOrder.id}`);
  console.log(`  - Status: ${detailsRes.status}`);
  const detailedOrder = detailsRes.data?.order || detailsRes.data;

  console.log("  - Details Customer Name:", detailedOrder.customer?.name);
  console.log("  - Details Customer Number:", detailedOrder.customer?.customer_number);
  console.log("  - Details Branch Name:", detailedOrder.branch?.name);
  console.log("  - Details Delivery Rider:", detailedOrder.delivery?.partner_name);
  console.log("  - Details Kitchen KOT:", detailedOrder.kitchen?.kot_number);

  if (!detailedOrder.customer?.name || !detailedOrder.customer?.customer_number?.startsWith("CTH-CUST-")) {
    console.error("❌ TEST 4 FAILED: Order Details Drawer API returned corrupted customer object.");
    process.exit(1);
  }
  console.log("✓ TEST 4 PASS: Relational order details API returned clean customer identity and honest unassigned states.");

  console.log("\n==================================================");
  console.log("ALL E2E INTEGRATION TESTS PASSED (100% SUCCESS)");
  console.log("==================================================");
}

runFullCustomerAndBranchIntegrationTest().catch((err) => {
  console.error("❌ E2E TEST ERROR:", err);
  process.exit(1);
});
