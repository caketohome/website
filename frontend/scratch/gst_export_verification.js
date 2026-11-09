/**
 * GST Export Verification Script
 * Probes PostgreSQL to verify statutory accuracy of each GST report component.
 * READ-ONLY — zero mutations.
 */
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false },
});

async function q(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function main() {
  const results = {};

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CREDIT NOTES: Check for persisted credit_note / debit_note table
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n═══ 1. CREDIT NOTES — Persisted Documents ═══");
  
  // Check if credit_note table exists
  const cnTables = await q(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name ILIKE '%credit_note%' OR table_name ILIKE '%debit_note%'
           OR table_name ILIKE '%cn_%' OR table_name ILIKE '%dn_%'
           OR table_name ILIKE '%refund%')
    ORDER BY table_name
  `);
  console.log("Credit/Debit note related tables:", cnTables.map(r => r.table_name));
  results.creditNoteTables = cnTables.map(r => r.table_name);

  // Check invoice table for credit note records
  const invoiceTypes = await q(`
    SELECT DISTINCT 
      COALESCE(metadata->>'document_type', metadata->>'type', 'UNKNOWN') as doc_type,
      COUNT(*) as cnt
    FROM public.invoice
    WHERE deleted_at IS NULL
    GROUP BY doc_type
    ORDER BY cnt DESC
    LIMIT 20
  `).catch(() => []);
  console.log("Invoice document types:", invoiceTypes);
  results.invoiceDocTypes = invoiceTypes;

  // Check if any invoices have CN/DN markers
  const cnInvoices = await q(`
    SELECT COUNT(*) as cnt,
      SUM(CASE WHEN metadata->>'document_type' ILIKE '%credit%' OR metadata->>'type' ILIKE '%credit%' THEN 1 ELSE 0 END) as credit_notes,
      SUM(CASE WHEN metadata->>'document_type' ILIKE '%debit%' OR metadata->>'type' ILIKE '%debit%' THEN 1 ELSE 0 END) as debit_notes,
      SUM(CASE WHEN status = 'GENERATED' THEN 1 ELSE 0 END) as generated,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
    FROM public.invoice
    WHERE deleted_at IS NULL
  `).catch(() => [{ cnt: 0 }]);
  console.log("Invoice CN/DN counts:", cnInvoices[0]);
  results.invoiceCnDnCounts = cnInvoices[0];

  // Check refunded/cancelled orders that the CN method would pick up
  const cancelledOrders = await q(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status::text = 'refunded' THEN 1 ELSE 0 END) as refunded,
      SUM(CASE WHEN status::text IN ('cancelled', 'canceled') THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN (metadata->>'invoice_number') IS NOT NULL THEN 1 ELSE 0 END) as has_invoice
    FROM public."order"
    WHERE deleted_at IS NULL
      AND status::text IN ('refunded', 'cancelled', 'canceled')
  `);
  console.log("Cancelled/refunded orders:", cancelledOrders[0]);
  results.cancelledRefundedOrders = cancelledOrders[0];

  // Check if there are persisted credit_note records in the order metadata
  const orderCnCheck = await q(`
    SELECT COUNT(*) as cnt,
      SUM(CASE WHEN metadata->>'credit_note_number' IS NOT NULL THEN 1 ELSE 0 END) as has_cn_number,
      SUM(CASE WHEN metadata->>'credit_note_id' IS NOT NULL THEN 1 ELSE 0 END) as has_cn_id,
      SUM(CASE WHEN metadata->>'refund_id' IS NOT NULL THEN 1 ELSE 0 END) as has_refund_id
    FROM public."order"
    WHERE deleted_at IS NULL
      AND status::text IN ('refunded', 'cancelled', 'canceled')
  `);
  console.log("Orders with persisted CN data:", orderCnCheck[0]);
  results.orderCnPersistence = orderCnCheck[0];

  // ──────────────────────────────────────────────────────────────────────────
  // 2. DEFAULT HSN CODE — Is 19059090 used in tax calculation?
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n═══ 2. HSN CODE COVERAGE ═══");

  // Check product-level HSN codes
  const hsnCoverage = await q(`
    SELECT 
      COUNT(*) as total_products,
      SUM(CASE WHEN metadata->>'hsn_code' IS NOT NULL AND metadata->>'hsn_code' != '' THEN 1 ELSE 0 END) as has_hsn,
      SUM(CASE WHEN metadata->>'hsn_code' IS NULL OR metadata->>'hsn_code' = '' THEN 1 ELSE 0 END) as missing_hsn
    FROM public.product
    WHERE deleted_at IS NULL
  `);
  console.log("Product HSN coverage:", hsnCoverage[0]);
  results.hsnCoverage = hsnCoverage[0];

  // Check distinct HSN codes used
  const distinctHsn = await q(`
    SELECT DISTINCT metadata->>'hsn_code' as hsn_code, COUNT(*) as cnt
    FROM public.product
    WHERE deleted_at IS NULL AND metadata->>'hsn_code' IS NOT NULL AND metadata->>'hsn_code' != ''
    GROUP BY hsn_code
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log("Distinct HSN codes on products:", distinctHsn);
  results.distinctHsnCodes = distinctHsn;

  // Check order items for HSN codes
  const orderItemHsn = await q(`
    SELECT COUNT(*) as total_orders,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(metadata->'items') AS item
        WHERE item->>'hsn_code' IS NOT NULL AND item->>'hsn_code' != ''
      ) THEN 1 ELSE 0 END) as orders_with_item_hsn,
      SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(metadata->'items') AS item
        WHERE item->>'hsn_code' IS NOT NULL AND item->>'hsn_code' != ''
      ) THEN 1 ELSE 0 END) as orders_without_item_hsn
    FROM public."order"
    WHERE deleted_at IS NULL
      AND status::text NOT IN ('draft', 'abandoned')
      AND metadata->'items' IS NOT NULL
      AND jsonb_typeof(metadata->'items') = 'array'
    LIMIT 500
  `);
  console.log("Order item HSN coverage:", orderItemHsn[0]);
  results.orderItemHsnCoverage = orderItemHsn[0];

  // Check if HSN code affects tax RATE (does the code use HSN for rate lookup?)
  const itemGstRates = await q(`
    SELECT 
      item->>'hsn_code' as hsn,
      item->>'gst_rate_pct' as gst_rate,
      item->>'tax_rate' as tax_rate,
      COUNT(*) as cnt
    FROM public."order" o,
      jsonb_array_elements(o.metadata->'items') AS item
    WHERE o.deleted_at IS NULL
      AND o.status::text NOT IN ('draft', 'abandoned')
      AND o.metadata->'items' IS NOT NULL
      AND jsonb_typeof(o.metadata->'items') = 'array'
    GROUP BY hsn, gst_rate, tax_rate
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log("Item GST rate distribution:", itemGstRates);
  results.itemGstRateDistribution = itemGstRates;

  // ──────────────────────────────────────────────────────────────────────────
  // 3. INPUT TAX CREDIT — Expense table validation
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n═══ 3. INPUT TAX CREDIT ═══");

  // Check expense table existence and structure
  const expenseExists = await q(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expense'
    ORDER BY ordinal_position
  `).catch(() => []);
  console.log("Expense table columns:", expenseExists.length > 0 ? expenseExists.map(r => `${r.column_name}(${r.data_type})`) : "TABLE DOES NOT EXIST");
  results.expenseTableExists = expenseExists.length > 0;
  results.expenseColumns = expenseExists.map(r => r.column_name);

  if (expenseExists.length > 0) {
    const expenseSummary = await q(`
      SELECT 
        COUNT(*) as total_expenses,
        SUM(CASE WHEN vendor_gstin IS NOT NULL AND vendor_gstin != '' THEN 1 ELSE 0 END) as has_vendor_gstin,
        SUM(CASE WHEN itc_eligibility IS NOT NULL THEN 1 ELSE 0 END) as has_itc_field,
        SUM(CASE WHEN itc_eligibility = 'ELIGIBLE' THEN 1 ELSE 0 END) as eligible_itc,
        SUM(CASE WHEN itc_eligibility = 'INELIGIBLE' THEN 1 ELSE 0 END) as ineligible_itc,
        SUM(CASE WHEN rcm_applicable = true THEN 1 ELSE 0 END) as rcm_applicable,
        SUM(COALESCE(cgst, 0) + COALESCE(sgst, 0) + COALESCE(igst, 0)) as total_itc_amount,
        SUM(CASE WHEN invoice_number IS NOT NULL AND invoice_number != '' THEN 1 ELSE 0 END) as has_supplier_invoice
      FROM public.expense
      WHERE deleted_at IS NULL AND status NOT IN ('DRAFT', 'VOID', 'REJECTED')
    `).catch(() => [{ total_expenses: 0 }]);
    console.log("Expense/ITC summary:", expenseSummary[0]);
    results.expenseSummary = expenseSummary[0];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. GSTR-1 / GSTR-3B — Invoice reconciliation
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n═══ 4. GSTR-1 / GSTR-3B RECONCILIATION ═══");

  // Count delivered orders with invoices
  const invoiceReconciliation = await q(`
    SELECT
      COUNT(*) as total_delivered,
      SUM(CASE WHEN metadata->>'invoice_number' IS NOT NULL THEN 1 ELSE 0 END) as has_invoice_number,
      SUM(CASE WHEN metadata->>'invoice_id' IS NOT NULL THEN 1 ELSE 0 END) as has_invoice_id,
      SUM(CASE WHEN metadata->'compliance_snapshot' IS NOT NULL THEN 1 ELSE 0 END) as has_compliance_snapshot,
      SUM(CASE WHEN metadata->'compliance_snapshot'->>'seller_gstin' IS NOT NULL THEN 1 ELSE 0 END) as has_seller_gstin,
      SUM(CASE WHEN metadata->'compliance_snapshot'->>'is_intra_state' IS NOT NULL THEN 1 ELSE 0 END) as has_supply_type
    FROM public."order"
    WHERE deleted_at IS NULL AND status::text = 'delivered'
  `);
  console.log("Delivered order invoice coverage:", invoiceReconciliation[0]);
  results.invoiceReconciliation = invoiceReconciliation[0];

  // Check invoice table totals vs order table totals
  const orderTotals = await q(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(COALESCE((metadata->>'total')::numeric, (metadata->>'grand_total')::numeric, 0)) as order_total,
      SUM(COALESCE((metadata->>'tax_amount')::numeric, (metadata->>'tax_total')::numeric, 0)) as order_tax_total
    FROM public."order"
    WHERE deleted_at IS NULL 
      AND status::text IN ('delivered', 'completed', 'paid')
  `);
  console.log("Valid order totals:", orderTotals[0]);
  results.orderTotals = orderTotals[0];

  const invoiceTotals = await q(`
    SELECT 
      COUNT(*) as total_invoices,
      SUM(COALESCE(grand_total, 0)) as invoice_total,
      SUM(COALESCE(tax_total, 0)) as invoice_tax_total
    FROM public.invoice
    WHERE deleted_at IS NULL AND status = 'GENERATED'
  `).catch(() => [{ total_invoices: 0, invoice_total: 0, invoice_tax_total: 0 }]);
  console.log("Invoice table totals:", invoiceTotals[0]);
  results.invoiceTotals = invoiceTotals[0];

  // Tax component breakdown from invoices
  const invoiceTaxBreakdown = await q(`
    SELECT 
      COUNT(*) as cnt,
      SUM(COALESCE(subtotal, 0)) as subtotal,
      SUM(COALESCE(tax_total, 0)) as tax_total,
      SUM(COALESCE(grand_total, 0)) as grand_total,
      SUM(COALESCE(delivery_fee, 0)) as delivery_fees,
      SUM(COALESCE(discount_total, 0)) as discounts
    FROM public.invoice
    WHERE deleted_at IS NULL AND status = 'GENERATED'
  `).catch(() => []);
  console.log("Invoice tax component breakdown:", invoiceTaxBreakdown[0]);
  results.invoiceTaxBreakdown = invoiceTaxBreakdown[0];

  // Check GST registration
  const gstReg = await q(`
    SELECT g.gstin, g.legal_name, g.is_active, c.trade_name
    FROM public.gst_registration g
    LEFT JOIN public.company c ON c.id = g.company_id
    WHERE g.is_active = true
    ORDER BY g.created_at ASC
    LIMIT 5
  `).catch(() => []);
  console.log("Active GST registrations:", gstReg);
  results.gstRegistrations = gstReg;

  // ──────────────────────────────────────────────────────────────────────────
  // 5. SAMPLE INVOICE AUDIT — Pick 3 invoices and verify tax math
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n═══ 5. SAMPLE INVOICE TAX MATH AUDIT ═══");

  const sampleInvoices = await q(`
    SELECT id, invoice_number, order_id, subtotal, tax_total, grand_total,
           delivery_fee, discount_total, status, is_intra_state,
           seller_gstin, customer_name,
           jsonb_array_length(COALESCE(items, '[]'::jsonb)) as item_count
    FROM public.invoice
    WHERE deleted_at IS NULL AND status = 'GENERATED'
    ORDER BY created_at DESC
    LIMIT 3
  `).catch(() => []);

  for (const inv of sampleInvoices) {
    console.log(`\nInvoice ${inv.invoice_number}:`);
    console.log(`  Subtotal: ${inv.subtotal}, Tax: ${inv.tax_total}, Grand: ${inv.grand_total}`);
    console.log(`  Delivery: ${inv.delivery_fee}, Discount: ${inv.discount_total}`);
    console.log(`  Items: ${inv.item_count}, IntraState: ${inv.is_intra_state}`);
    
    // Verify: subtotal - discount + tax + delivery ≈ grand_total
    const computed = Number(inv.subtotal || 0) - Number(inv.discount_total || 0) 
                   + Number(inv.tax_total || 0) + Number(inv.delivery_fee || 0);
    const diff = Math.abs(computed - Number(inv.grand_total || 0));
    console.log(`  Computed total: ${computed.toFixed(2)}, Diff: ${diff.toFixed(2)} ${diff > 1 ? "⚠️ MISMATCH" : "✅"}`);

    // Check individual line items
    const lineItems = await q(`
      SELECT item->>'title' as title, item->>'hsn_code' as hsn,
             item->>'quantity' as qty, item->>'unit_price' as unit_price,
             item->>'taxable_value' as taxable, item->>'gst_rate_pct' as gst_rate,
             item->>'cgst' as cgst, item->>'sgst' as sgst, item->>'igst' as igst,
             item->>'total' as total
      FROM public.invoice, jsonb_array_elements(items) AS item
      WHERE invoice.id = $1
    `, [inv.id]).catch(() => []);
    
    for (const li of lineItems) {
      const tv = Number(li.taxable || 0);
      const rate = Number(li.gst_rate || 5);
      const expectedTax = Math.round(tv * rate / 100 * 100) / 100;
      const actualTax = Number(li.cgst || 0) + Number(li.sgst || 0) + Number(li.igst || 0);
      const taxDiff = Math.abs(expectedTax - actualTax);
      console.log(`  → ${li.title}: HSN=${li.hsn || "MISSING"}, Qty=${li.qty}, Taxable=₹${tv}, Rate=${rate}%, Tax=₹${actualTax.toFixed(2)} (expected ₹${expectedTax.toFixed(2)}) ${taxDiff > 0.5 ? "⚠️" : "✅"}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n\n════════════════════════════════════════════");
  console.log("GST EXPORT VERIFICATION SUMMARY");
  console.log("════════════════════════════════════════════");
  
  // Issue 1: Credit Notes
  const hasCnTable = results.creditNoteTables.length > 0;
  const hasCnInOrders = Number(results.orderCnPersistence?.has_cn_number || 0) > 0;
  const hasCnInInvoices = Number(results.invoiceCnDnCounts?.credit_notes || 0) > 0;
  console.log(`\n1. CREDIT NOTES:`);
  console.log(`   Dedicated CN tables: ${hasCnTable ? "YES" : "NO"}`);
  console.log(`   CN numbers in orders: ${results.orderCnPersistence?.has_cn_number || 0}`);
  console.log(`   CN records in invoices: ${results.invoiceCnDnCounts?.credit_notes || 0}`);
  console.log(`   Refund IDs in orders: ${results.orderCnPersistence?.has_refund_id || 0}`);
  console.log(`   VERDICT: ${(hasCnTable || hasCnInOrders || hasCnInInvoices) ? "✅ Persisted CN documents exist" : "⚠️ DEFECT — CNs fabricated from order status alone"}`);

  // Issue 2: HSN
  const hsnPct = Number(results.hsnCoverage?.has_hsn || 0) / Math.max(1, Number(results.hsnCoverage?.total_products || 1)) * 100;
  console.log(`\n2. HSN CODE:`);
  console.log(`   Products with HSN: ${results.hsnCoverage?.has_hsn || 0}/${results.hsnCoverage?.total_products || 0} (${hsnPct.toFixed(1)}%)`);
  console.log(`   Missing HSN: ${results.hsnCoverage?.missing_hsn || 0}`);
  console.log(`   Distinct HSN codes: ${results.distinctHsnCodes?.length || 0}`);
  console.log(`   VERDICT: ${hsnPct > 80 ? "✅ Good HSN coverage" : "⚠️ DEFECT — Default HSN used for classification"}`);

  // Issue 3: ITC
  console.log(`\n3. INPUT TAX CREDIT:`);
  console.log(`   Expense table exists: ${results.expenseTableExists ? "YES" : "NO"}`);
  if (results.expenseSummary) {
    console.log(`   Total expenses: ${results.expenseSummary.total_expenses}`);
    console.log(`   With vendor GSTIN: ${results.expenseSummary.has_vendor_gstin}`);
    console.log(`   ITC eligible: ${results.expenseSummary.eligible_itc}`);
    console.log(`   With supplier invoice: ${results.expenseSummary.has_supplier_invoice}`);
  }
  console.log(`   VERDICT: ${results.expenseTableExists ? "Expense table exists — verify eligibility rules" : "⚠️ No expense table — ITC report returns empty"}`);

  // Issue 4: GSTR-1/3B
  console.log(`\n4. GSTR-1 / GSTR-3B:`);
  console.log(`   Delivered orders: ${results.invoiceReconciliation?.total_delivered || 0}`);
  console.log(`   With invoice number: ${results.invoiceReconciliation?.has_invoice_number || 0}`);
  console.log(`   With compliance snapshot: ${results.invoiceReconciliation?.has_compliance_snapshot || 0}`);
  console.log(`   With seller GSTIN: ${results.invoiceReconciliation?.has_seller_gstin || 0}`);
  console.log(`   Active GST registrations: ${results.gstRegistrations?.length || 0}`);
  console.log(`   Order total: ₹${Number(results.orderTotals?.order_total || 0).toFixed(2)}`);
  console.log(`   Invoice total: ₹${Number(results.invoiceTotals?.invoice_total || 0).toFixed(2)}`);
  const totalDiff = Math.abs(Number(results.orderTotals?.order_total || 0) - Number(results.invoiceTotals?.invoice_total || 0));
  console.log(`   Reconciliation diff: ₹${totalDiff.toFixed(2)}`);
  console.log(`   VERDICT: Management report only — NOT portal-upload format`);

  await pool.end();
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
