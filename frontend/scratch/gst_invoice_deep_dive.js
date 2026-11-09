/**
 * Invoice deep-dive: metadata structure, line items, tax reconciliation
 * READ-ONLY
 */
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false },
});
async function q(sql, p = []) { return (await pool.query(sql, p)).rows; }
const round2 = v => Math.round(v * 100) / 100;

async function main() {
  // Full invoice dump with metadata
  const invoices = await q(`
    SELECT i.id, i.invoice_number, i.order_id, i.subtotal, i.tax_total,
           i.delivery_fee, i.discount_total, i.grand_total, i.customer_name,
           i.status, i.metadata,
           o.metadata as order_metadata, o.status::text as order_status,
           COALESCE((o.metadata->>'total')::numeric, 0) as order_total,
           COALESCE((o.metadata->>'tax_amount')::numeric, (o.metadata->>'tax_total')::numeric, 0) as order_tax
    FROM public.invoice i
    LEFT JOIN public."order" o ON o.id = i.order_id
    WHERE i.deleted_at IS NULL
    ORDER BY i.created_at ASC
  `);

  console.log(`Total invoices: ${invoices.length}\n`);

  let totalInvGrand = 0, totalOrdTotal = 0;

  for (const inv of invoices) {
    const meta = inv.metadata || {};
    const items = Array.isArray(meta.items) ? meta.items : [];
    const grand = Number(inv.grand_total || 0);
    const sub = Number(inv.subtotal || 0);
    const tax = Number(inv.tax_total || 0);
    const del = Number(inv.delivery_fee || 0);
    const disc = Number(inv.discount_total || 0);
    totalInvGrand += grand;
    totalOrdTotal += Number(inv.order_total || 0);

    console.log(`═══ Invoice ${inv.invoice_number} ═══`);
    console.log(`  Order: ${inv.order_id} (status=${inv.order_status})`);
    console.log(`  Header: sub=₹${sub}, tax=₹${tax}, del=₹${del}, disc=₹${disc}, grand=₹${grand}`);
    console.log(`  Order total: ₹${inv.order_total}, Order tax: ₹${inv.order_tax}`);
    console.log(`  Metadata: seller_gstin=${meta.seller_gstin || 'NONE'}, is_intra_state=${meta.is_intra_state}, supply_type=${meta.supply_type}`);
    console.log(`  Items count: ${items.length}`);

    // Verify header math
    const computed = round2(sub - disc + tax + del);
    const headerDiff = Math.abs(computed - grand);
    console.log(`  Header math: ${sub} - ${disc} + ${tax} + ${del} = ${computed} vs grand=${grand}, diff=₹${round2(headerDiff)} ${headerDiff <= 1 ? '✅' : '⚠️'}`);

    // Invoice-to-order grand total comparison
    const invOrdDiff = Math.abs(grand - Number(inv.order_total || 0));
    console.log(`  Inv-Order diff: ₹${round2(invOrdDiff)} ${invOrdDiff <= 1 ? '✅' : '⚠️'}`);

    // Line item audit
    let itemSub = 0, itemTax = 0;
    for (const item of items) {
      const tv = Number(item.taxable_value || item.subtotal || 0);
      const rate = Number(item.gst_rate_pct || item.tax_rate || 0);
      const cgst = Number(item.cgst || 0);
      const sgst = Number(item.sgst || 0);
      const igst = Number(item.igst || 0);
      const actualTax = round2(cgst + sgst + igst);
      const expectedTax = round2(tv * rate / 100);
      const taxDiff = Math.abs(expectedTax - actualTax);
      itemSub += tv;
      itemTax += actualTax;

      console.log(`    → ${item.title || item.product_name}: HSN=${item.hsn_code || 'MISSING'}, ` +
        `qty=${item.quantity}, taxable=₹${tv}, rate=${rate}%, ` +
        `tax=₹${actualTax} (expected ₹${expectedTax}), diff=₹${round2(taxDiff)} ${taxDiff <= 0.5 ? '✅' : '⚠️'}`);
    }

    if (items.length > 0) {
      console.log(`  Item totals: sub=₹${round2(itemSub)}, tax=₹${round2(itemTax)}`);
      console.log(`  Header vs items: sub diff=₹${round2(Math.abs(sub - itemSub))}, tax diff=₹${round2(Math.abs(tax - itemTax))}`);
    }

    // Check order items for comparison
    const orderMeta = inv.order_metadata || {};
    const orderItems = Array.isArray(orderMeta.items) ? orderMeta.items : [];
    console.log(`  Order items: ${orderItems.length}`);
    for (const item of orderItems) {
      console.log(`    → ${item.title || item.product_name}: HSN=${item.hsn_code || 'MISSING'}, ` +
        `qty=${item.quantity}, price=₹${item.unit_price || item.price}, ` +
        `gst_rate=${item.gst_rate_pct || item.tax_rate || 'N/A'}%, ` +
        `cgst=${item.cgst || 'N/A'}, sgst=${item.sgst || 'N/A'}`);
    }
    console.log();
  }

  console.log(`\n═══ RECONCILIATION SUMMARY ═══`);
  console.log(`Total invoice grand: ₹${round2(totalInvGrand)}`);
  console.log(`Total linked order total: ₹${round2(totalOrdTotal)}`);
  console.log(`Difference: ₹${round2(Math.abs(totalInvGrand - totalOrdTotal))}`);

  // Check for orders with invoice_id that link to an invoice
  const ordersWithInvId = await q(`
    SELECT o.id, o.status::text, o.metadata->>'order_number' as order_no,
           o.metadata->>'invoice_id' as inv_id, o.metadata->>'invoice_number' as inv_no,
           COALESCE((o.metadata->>'total')::numeric, 0) as total
    FROM public."order" o
    WHERE o.deleted_at IS NULL
      AND o.metadata->>'invoice_id' IS NOT NULL
    ORDER BY o.created_at
  `);
  console.log(`\nOrders with invoice_id: ${ordersWithInvId.length}`);
  for (const o of ordersWithInvId) {
    const invMatch = invoices.find(i => i.id === o.inv_id);
    console.log(`  ${o.order_no || o.id}: inv_id=${o.inv_id}, inv_no=${o.inv_no}, ` +
      `total=₹${o.total}, status=${o.status}, ` +
      `invoice_found=${invMatch ? 'YES (grand=₹'+invMatch.grand_total+')' : 'NO'}`);
  }

  // Key question: why do 5 orders with invoice_id show total=₹0 in the order?
  console.log(`\n═══ ZERO-TOTAL ORDERS WITH INVOICES ═══`);
  for (const o of ordersWithInvId) {
    if (Number(o.total) === 0) {
      const orderFull = await q(`SELECT metadata FROM public."order" WHERE id = $1`, [o.id]);
      const meta = orderFull[0]?.metadata || {};
      console.log(`  ${o.order_no || o.id}: total=${meta.total}, grand_total=${meta.grand_total}, ` +
        `subtotal=${meta.subtotal}, amount=${meta.amount}`);
      // Check all numeric keys
      const numKeys = Object.keys(meta).filter(k => {
        const v = meta[k];
        return typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v !== '');
      });
      console.log(`    Numeric metadata keys:`, numKeys.map(k => `${k}=${meta[k]}`));
    }
  }

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
