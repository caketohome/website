const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const ts = require("../frontend/node_modules/typescript");
require.extensions[".ts"] = function(module, filename) {
  const content = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    }
  });
  return module._compile(compiled.outputText, filename);
};

const { Client } = require("../frontend/node_modules/pg");
const { OrderService } = require("../frontend/src/lib/services/order.service");
const { DeliveryInvoicingService } = require("../frontend/src/lib/services/delivery-invoicing.service");
const { closeDbPool } = require("../frontend/src/lib/db");

async function run() {
  console.log("================================================================================");
  console.log("REPRODUCING DEFECT: SALES INVOICE & VOUCHER DRAFT AT DELIVERY");
  console.log("================================================================================");

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // 1. Setup mapped test product
  console.log("\n1. Setting up mapped test product...");
  const { ProductRepository } = require("../frontend/src/lib/repositories/product.repository");
  const testProdId = "prod_phase5_invoice_repro";
  await ProductRepository.save({
    id: testProdId,
    title: "Phase 5 Invoice Repro Cake",
    price: 850,
    selling_price: 850,
    merchandise_type: "CAKE",
    tax_rate_id: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", // GST 5%
    tax_class: "GST_5",
    hsn_code: "19059010",
    status: "published",
  });

  // 2. Create a real order with Tax Master mapped product
  console.log("\n2. Creating Order...");
  const orderRes = await OrderService.createOrder({
    customer_id: "cus_anita_test_01",
    customer_name: "Anita Sharma",
    customer_email: "anita.sharma@example.com",
    customer_phone: "+919876543210",
    branch_id: "br_01KYWH9YFVV5AK15D6313HB1NC",
    delivery_date: tomorrow,
    delivery_slot: "14:00 - 16:00",
    delivery_type: "standard",
    payment_method: "card",
    items: [
      {
        product_id: testProdId,
        quantity: 1,
        unit_price: 850,
      }
    ]
  });


  if (!orderRes.success) {
    console.error("Order creation failed:", orderRes.error);
    await client.end();
    await closeDbPool();
    process.exit(1);
  }

  const orderId = orderRes.order.id;
  console.log(`Order created: ${orderId} (Total: ₹${orderRes.order.total_amount})`);


  // Inspect order in PostgreSQL
  const dbOrderRes = await client.query(`SELECT id, status, metadata FROM public."order" WHERE id = $1`, [orderId]);
  const dbOrder = dbOrderRes.rows[0];
  console.log("Order in DB:", {
    id: dbOrder.id,
    status: dbOrder.status,
    is_ledger_eligible: dbOrder.metadata?.is_ledger_eligible,
    items_count: dbOrder.metadata?.items?.length
  });

  // 2. Set order status to delivered and call DeliveryInvoicingService
  console.log("\n2. Attempting Invoice Generation on Delivery...");
  dbOrder.status = "delivered"; // emulate transition to delivered
  const invoiceRes = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, dbOrder);
  console.log("Invoice Generation Result:", {
    success: invoiceRes.success,
    invoice_number: invoiceRes.invoice_number,
    invoice_id: invoiceRes.invoice_id,
    accounting_voucher_id: invoiceRes.accounting_voucher_id,
    error: invoiceRes.error
  });

  // 3. Inspect public.invoice in DB
  const invDbRes = await client.query(`
    SELECT id, invoice_number, order_id, grand_total, paid_amount, outstanding_amount, status, voucher_id, metadata
    FROM public."invoice"
    WHERE order_id = $1
  `, [orderId]);

  console.log("\n3. Invoice Record in PostgreSQL:");
  console.log(JSON.stringify(invDbRes.rows, null, 2));

  // Teardown test order and invoice
  console.log("\n4. Cleaning up test order & invoice...");
  const vchRes = await client.query(`SELECT id FROM public."accounting_voucher" WHERE reference_id = $1 OR id = 'vch_00MVDDNSG2LUBSZK'`, [orderId]);
  const vchIds = vchRes.rows.map(r => r.id);
  if (vchIds.length > 0) {
    await client.query(`DELETE FROM public."accounting_journal_line" WHERE journal_entry_id IN (SELECT id FROM public."accounting_journal_entry" WHERE voucher_id = ANY($1))`, [vchIds]);
    await client.query(`DELETE FROM public."accounting_journal_entry" WHERE voucher_id = ANY($1)`, [vchIds]);
    await client.query(`DELETE FROM public."accounting_voucher" WHERE id = ANY($1)`, [vchIds]);
  }
  await client.query(`DELETE FROM public."invoice" WHERE order_id = $1`, [orderId]);
  await client.query(`DELETE FROM public."order_status_history" WHERE order_id = $1`, [orderId]);
  await client.query(`DELETE FROM public."payment_transaction" WHERE order_id = $1`, [orderId]);
  await client.query(`DELETE FROM public."order" WHERE id = $1`, [orderId]);
  await client.query(`DELETE FROM public."tax_rate_rule" WHERE reference_id = $1`, [testProdId]);
  await client.query(`DELETE FROM public."product" WHERE id = $1`, [testProdId]);

  await client.end();
  await closeDbPool();
}


run().catch(async (err) => {
  console.error("Fatal:", err);
  await closeDbPool();
  process.exit(1);
});
