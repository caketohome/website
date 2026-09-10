import { getDbPool } from "../src/lib/db";
import { OrderRepository } from "../src/lib/repositories/order.repository";

async function inspectOrders() {
  const pool = getDbPool();
  try {
    const res = await pool.query(
      `SELECT id, display_id, status, currency_code, metadata, created_at FROM "order" ORDER BY created_at DESC LIMIT 25`
    );
    console.log(`Found ${res.rows.length} orders in PostgreSQL.`);
    for (let i = 0; i < res.rows.length; i++) {
      const r = res.rows[i];
      const meta = r.metadata || {};
      const domainOrder = await OrderRepository.findById(r.id);
      console.log(`\n------------------------------------------------------------`);
      console.log(`Order #${i + 1}`);
      console.log(`  Row ID: ${r.id}`);
      console.log(`  display_id: ${r.display_id}`);
      console.log(`  meta.order_number: ${meta.order_number}`);
      console.log(`  meta.total: ${meta.total} | meta.subtotal: ${meta.subtotal}`);
      console.log(`  domainOrder total: ${domainOrder?.total} | total_amount: ${domainOrder?.total_amount}`);
      console.log(`  items count: ${(meta.items || []).length}`);
      if (meta.items && meta.items.length > 0) {
        meta.items.forEach((it: any, idx: number) => {
          console.log(`    Item [${idx}]: title="${it.title || it.product_title || it.name}" price=${it.price || it.unit_price} qty=${it.quantity} lineTotal=${it.line_total || it.subtotal}`);
        });
      }
      console.log(`  customer_id: ${meta.customer_id} | customer_name: ${meta.customer_name} | phone: ${meta.customer_phone}`);
      console.log(`  branch_id: ${meta.branch_id} | branch_name: ${meta.branch_name}`);
      console.log(`  status: ${r.status} | bakery_status: ${meta.bakery_status}`);
      console.log(`  payment_status: ${meta.payment_status} | method: ${meta.payment_method}`);
      console.log(`  delivery: ${JSON.stringify(meta.delivery || {})}`);
    }

    // Also check listOrders() vs findById()
    console.log(`\n============================================================`);
    console.log(`Auditing OrderRepository.listOrders() vs findById() on 20 items:`);
    const listRes = await OrderRepository.listOrders({ page: 1, pageSize: 20 });
    console.log(`listOrders returned ${listRes.items.length} items (total: ${listRes.total})`);
    for (const item of listRes.items) {
      const byId = await OrderRepository.findById(item.id);
      const byNumber = item.order_number ? await OrderRepository.findById(item.order_number) : null;
      console.log(`ID: "${item.id}" | Number: "${item.order_number}" | byId: ${byId ? "FOUND" : "NOT FOUND"} | byNumber: ${byNumber ? "FOUND" : "NOT FOUND"} | total: ₹${item.total}`);
    }
  } catch (err: any) {
    console.error("Forensic order inspection error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

inspectOrders();
