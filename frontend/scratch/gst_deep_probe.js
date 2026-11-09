/**
 * Deep probe of refund/credit note tables and order sample data
 * READ-ONLY
 */
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false },
});
async function q(sql, p = []) { return (await pool.query(sql, p)).rows; }

async function main() {
  // 1. Refund table schema
  console.log("═══ REFUND TABLE SCHEMA ═══");
  const refundCols = await q(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refund'
    ORDER BY ordinal_position
  `);
  console.log(refundCols.map(r => `${r.column_name}(${r.data_type})`));

  // 2. Refund table data
  console.log("\n═══ REFUND TABLE DATA (top 5) ═══");
  const refunds = await q(`SELECT * FROM public.refund WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`).catch(() => []);
  for (const r of refunds) {
    console.log(JSON.stringify(r, null, 2));
  }
  console.log(`Total refunds: ${(await q(`SELECT COUNT(*) as c FROM public.refund WHERE deleted_at IS NULL`))[0].c}`);

  // 3. order_lifecycle_refund table
  console.log("\n═══ ORDER_LIFECYCLE_REFUND TABLE ═══");
  const olrCols = await q(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_lifecycle_refund'
    ORDER BY ordinal_position
  `);
  console.log(olrCols.map(r => `${r.column_name}(${r.data_type})`));
  const olrData = await q(`SELECT * FROM public.order_lifecycle_refund WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 3`).catch(() => []);
  console.log(`Records: ${olrData.length}`);
  for (const r of olrData) {
    console.log(JSON.stringify(r, null, 2));
  }

  // 4. refund_reason table
  console.log("\n═══ REFUND_REASON TABLE ═══");
  const rrData = await q(`SELECT * FROM public.refund_reason ORDER BY created_at LIMIT 10`).catch(() => []);
  console.log(rrData);

  // 5. Sample cancelled orders — check if they had an invoice BEFORE cancellation
  console.log("\n═══ CANCELLED ORDER SAMPLES ═══");
  const cancelled = await q(`
    SELECT id, status::text, metadata->>'order_number' as order_no,
           metadata->>'invoice_number' as inv_no,
           metadata->>'total' as total,
           metadata->>'tax_amount' as tax,
           metadata->>'customer_name' as customer,
           metadata->'compliance_snapshot'->>'is_intra_state' as intra_state,
           created_at
    FROM public."order"
    WHERE deleted_at IS NULL AND status::text IN ('refunded', 'cancelled', 'canceled')
    ORDER BY created_at DESC LIMIT 5
  `);
  for (const o of cancelled) console.log(o);

  // 6. Sample valid order to check item-level HSN persistence
  console.log("\n═══ SAMPLE ORDER ITEMS — HSN CHECK ═══");
  const sampleOrder = await q(`
    SELECT id, metadata->>'order_number' as order_no,
           metadata->'items' as items
    FROM public."order"
    WHERE deleted_at IS NULL 
      AND status::text NOT IN ('draft', 'abandoned', 'cancelled', 'canceled')
      AND metadata->'items' IS NOT NULL
    ORDER BY created_at DESC LIMIT 2
  `);
  for (const o of sampleOrder) {
    console.log(`\nOrder ${o.order_no}:`);
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    for (const item of (items || [])) {
      console.log(`  ${item.title || item.product_name}: HSN=${item.hsn_code || "MISSING"}, GST=${item.gst_rate_pct || item.tax_rate || "MISSING"}%, tax_amount=${item.tax_amount || "N/A"}, cgst=${item.cgst}, sgst=${item.sgst}`);
    }
  }

  // 7. Invoice table samples — check item HSN
  console.log("\n═══ SAMPLE INVOICES — LINE ITEMS ═══");
  const sampleInv = await q(`
    SELECT id, invoice_number, order_id, subtotal, tax_total, grand_total,
           is_intra_state, seller_gstin, items
    FROM public.invoice
    WHERE deleted_at IS NULL AND status = 'GENERATED'
    ORDER BY created_at DESC LIMIT 2
  `).catch(() => []);
  for (const inv of sampleInv) {
    console.log(`\nInvoice ${inv.invoice_number}:`);
    console.log(`  GSTIN: ${inv.seller_gstin}, IntraState: ${inv.is_intra_state}`);
    console.log(`  Subtotal: ${inv.subtotal}, Tax: ${inv.tax_total}, Grand: ${inv.grand_total}`);
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
    for (const item of (items || [])) {
      console.log(`  → ${item.title}: HSN=${item.hsn_code || "MISSING"}, rate=${item.gst_rate_pct}%, taxable=${item.taxable_value}, cgst=${item.cgst}, sgst=${item.sgst}, igst=${item.igst}`);
    }
  }

  // 8. GST registration check — company table
  console.log("\n═══ COMPANY & GST REGISTRATION ═══");
  const companies = await q(`SELECT id, trade_name, legal_name FROM public.company LIMIT 5`).catch(() => []);
  console.log("Companies:", companies);
  const gstRegs = await q(`SELECT * FROM public.gst_registration LIMIT 5`).catch(() => []);
  console.log("GST Registrations:", gstRegs);

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
