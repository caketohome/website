const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const invs = await pool.query(
    "SELECT * FROM public.invoice WHERE invoice_number IN ('CTH/26-27/000034', 'CTH/26-27/000035')"
  );
  for (const inv of invs.rows) {
    console.log("=== INVOICE:", inv.invoice_number, "===");
    console.log("Subtotal:", inv.subtotal, "Tax:", inv.tax_total, "Delivery:", inv.delivery_fee, "Discount:", inv.discount_total, "Grand:", inv.grand_total);
    console.log("Invoice Metadata:", JSON.stringify(inv.metadata, null, 2));
    const ord = await pool.query('SELECT * FROM public."order" WHERE id = $1', [inv.order_id]);
    if (ord.rows[0]) {
      console.log("Order Metadata:", JSON.stringify(ord.rows[0].metadata, null, 2));
    }
  }
  await pool.end();
}

main().catch(console.error);
