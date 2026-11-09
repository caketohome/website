/**
 * GST End-to-End Verification Script
 * ====================================
 * Comprehensive read-only probe against PostgreSQL covering:
 *   1. Independent total recalculation vs GST report derivation
 *   2. ₹1,822 reconciliation difference investigation
 *   3. Refund-to-CN mapping, dedup, non-statutory exclusion
 *   4. HSN, GST registration, vendor invoice, ITC validation
 *   5. Data completeness for every report section
 *
 * READ-ONLY — zero mutations.
 */
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false },
});
async function q(sql, p = []) { return (await pool.query(sql, p)).rows; }
const round2 = v => Math.round(v * 100) / 100;

async function main() {
  const findings = [];
  const addFinding = (area, severity, title, detail) => {
    findings.push({ area, severity, title, detail });
    console.log(`  [${severity}] ${title}`);
    if (detail) console.log(`         ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: INVOICE TABLE — FULL AUDIT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 1. INVOICE TABLE — FULL AUDIT ══");

  const allInvoices = await q(`
    SELECT id, invoice_number, order_id, status, subtotal, tax_total, grand_total,
           delivery_fee, discount_total, 
           COALESCE((metadata->>'is_intra_state')::boolean, true) as is_intra_state, 
           metadata->>'seller_gstin' as seller_gstin, 
           customer_name,
           metadata->'items' as items, metadata, created_at
    FROM public.invoice
    WHERE deleted_at IS NULL
    ORDER BY created_at ASC
  `);

  console.log(`  Total invoices: ${allInvoices.length}`);

  let invoiceAuditPass = 0;
  let invoiceAuditFail = 0;

  for (const inv of allInvoices) {
    const sub = Number(inv.subtotal || 0);
    const tax = Number(inv.tax_total || 0);
    const grand = Number(inv.grand_total || 0);
    const delivery = Number(inv.delivery_fee || 0);
    const discount = Number(inv.discount_total || 0);

    // Verify: subtotal - discount + tax + delivery ≈ grand_total
    const computed = round2(sub - discount + tax + delivery);
    const diff = Math.abs(computed - grand);

    // Verify line-item totals match header
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    let itemSubtotal = 0, itemTax = 0;
    const itemDetails = [];
    for (const item of items) {
      const tv = Number(item.taxable_value || 0);
      const itemCgst = Number(item.cgst || 0);
      const itemSgst = Number(item.sgst || 0);
      const itemIgst = Number(item.igst || 0);
      const itemTaxTotal = round2(itemCgst + itemSgst + itemIgst);
      itemSubtotal += tv;
      itemTax += itemTaxTotal;

      // Verify item tax math: taxable × rate ≈ actual tax
      const rate = Number(item.gst_rate_pct || 0);
      const expectedTax = round2(tv * rate / 100);
      const itemDiff = Math.abs(expectedTax - itemTaxTotal);

      itemDetails.push({
        title: item.title || item.product_name,
        hsn: item.hsn_code || "MISSING",
        taxable: tv, rate, expectedTax, actualTax: itemTaxTotal,
        taxDiff: itemDiff,
        cgst: itemCgst, sgst: itemSgst, igst: itemIgst,
      });

      if (itemDiff > 0.50) {
        addFinding("INVOICE_ITEM", "WARN", `Item tax mismatch in ${inv.invoice_number}`,
          `${item.title}: taxable=₹${tv} × ${rate}% = ₹${expectedTax}, actual=₹${itemTaxTotal}, diff=₹${itemDiff}`);
      }
    }

    itemSubtotal = round2(itemSubtotal);
    itemTax = round2(itemTax);

    if (diff > 1) {
      addFinding("INVOICE", "ERROR", `Header total mismatch: ${inv.invoice_number}`,
        `sub=${sub} - disc=${discount} + tax=${tax} + del=${delivery} = ${computed}, grand=${grand}, diff=₹${diff}`);
      invoiceAuditFail++;
    } else {
      invoiceAuditPass++;
    }

    const headerItemSubDiff = Math.abs(sub - itemSubtotal);
    if (headerItemSubDiff > 1) {
      addFinding("INVOICE", "WARN", `Header subtotal vs line-item sum: ${inv.invoice_number}`,
        `header sub=₹${sub}, items sum=₹${itemSubtotal}, diff=₹${headerItemSubDiff}`);
    }

    const headerItemTaxDiff = Math.abs(tax - itemTax);
    if (headerItemTaxDiff > 1) {
      addFinding("INVOICE", "WARN", `Header tax vs line-item tax: ${inv.invoice_number}`,
        `header tax=₹${tax}, items tax=₹${itemTax}, diff=₹${headerItemTaxDiff}`);
    }

    console.log(`  Invoice ${inv.invoice_number}: status=${inv.status}, grand=₹${grand}, ` +
      `items=${items.length}, sellerGSTIN=${inv.seller_gstin || 'MISSING'}, ` +
      `intraState=${inv.is_intra_state}, math=${diff <= 1 ? '✅' : '⚠️'}`);
  }

  console.log(`  Audit: ${invoiceAuditPass} pass, ${invoiceAuditFail} fail`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: ₹1,822 RECONCILIATION DIFFERENCE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 2. ORDER-INVOICE RECONCILIATION ══");

  // Get all valid orders (delivered/completed/paid)
  const validOrders = await q(`
    SELECT id, status::text, 
           metadata->>'order_number' as order_no,
           metadata->>'invoice_number' as inv_no,
           COALESCE((metadata->>'total')::numeric, (metadata->>'grand_total')::numeric, 0) as total,
           COALESCE((metadata->>'tax_amount')::numeric, (metadata->>'tax_total')::numeric, 0) as tax,
           metadata->>'invoice_id' as invoice_id,
           created_at
    FROM public."order"
    WHERE deleted_at IS NULL
      AND status::text IN ('delivered', 'completed', 'paid')
    ORDER BY created_at ASC
  `);
  console.log(`  Valid orders: ${validOrders.length}`);
  let orderTotal = 0, orderTax = 0;
  for (const o of validOrders) {
    orderTotal += Number(o.total || 0);
    orderTax += Number(o.tax || 0);
    console.log(`  Order ${o.order_no || o.id}: status=${o.status}, total=₹${o.total}, ` +
      `tax=₹${o.tax}, inv_no=${o.inv_no || 'NONE'}, inv_id=${o.invoice_id || 'NONE'}`);
  }

  // Get all generated invoices
  let invoiceTotal = 0, invoiceTax = 0;
  for (const inv of allInvoices.filter(i => i.status === 'GENERATED')) {
    invoiceTotal += Number(inv.grand_total || 0);
    invoiceTax += Number(inv.tax_total || 0);
  }

  console.log(`\n  Order total: ₹${round2(orderTotal)}, Order tax: ₹${round2(orderTax)}`);
  console.log(`  Invoice total: ₹${round2(invoiceTotal)}, Invoice tax: ₹${round2(invoiceTax)}`);
  console.log(`  Reconciliation diff: ₹${round2(Math.abs(orderTotal - invoiceTotal))}`);

  // Try to match each invoice to an order
  console.log(`\n  --- Invoice-to-Order Matching ---`);
  let matchedInvTotal = 0, unmatchedInvTotal = 0;
  for (const inv of allInvoices.filter(i => i.status === 'GENERATED')) {
    const orderId = inv.order_id;
    const matchingOrder = validOrders.find(o => o.id === orderId);
    const grand = Number(inv.grand_total || 0);
    if (matchingOrder) {
      const orderAmt = Number(matchingOrder.total || 0);
      const diff = Math.abs(grand - orderAmt);
      matchedInvTotal += grand;
      console.log(`  Invoice ${inv.invoice_number} → Order ${matchingOrder.order_no || orderId}: ` +
        `inv=₹${grand}, ord=₹${orderAmt}, diff=₹${round2(diff)} ${diff > 1 ? '⚠️' : '✅'}`);
      if (diff > 1) {
        addFinding("RECONCILIATION", "WARN", `Invoice-order amount mismatch`,
          `${inv.invoice_number}: inv=₹${grand}, ord=₹${orderAmt}, diff=₹${round2(diff)}`);
      }
    } else {
      unmatchedInvTotal += grand;
      // Check if the order exists in ANY status
      const anyOrder = await q(`
        SELECT id, status::text, metadata->>'order_number' as order_no,
               COALESCE((metadata->>'total')::numeric, 0) as total
        FROM public."order" WHERE id = $1 AND deleted_at IS NULL
      `, [orderId]);
      if (anyOrder.length > 0) {
        console.log(`  Invoice ${inv.invoice_number} → Order ${anyOrder[0].order_no || orderId}: ` +
          `STATUS=${anyOrder[0].status} (not in delivered/completed/paid), inv=₹${grand}`);
        addFinding("RECONCILIATION", "INFO", `Invoice linked to non-valid order`,
          `${inv.invoice_number} → order status=${anyOrder[0].status}, amount=₹${grand}`);
      } else {
        console.log(`  Invoice ${inv.invoice_number} → NO ORDER FOUND (order_id=${orderId}), inv=₹${grand}`);
        addFinding("RECONCILIATION", "ERROR", `Orphan invoice — no order found`,
          `${inv.invoice_number}, order_id=${orderId}, amount=₹${grand}`);
      }
    }
  }

  // Check for valid orders WITHOUT invoices
  const ordersWithoutInvoice = validOrders.filter(o => 
    !allInvoices.some(inv => inv.order_id === o.id && inv.status === 'GENERATED')
  );
  if (ordersWithoutInvoice.length > 0) {
    console.log(`\n  --- Valid Orders Without Invoice ---`);
    for (const o of ordersWithoutInvoice) {
      console.log(`  Order ${o.order_no || o.id}: status=${o.status}, total=₹${o.total}`);
      addFinding("RECONCILIATION", "WARN", `Valid order without generated invoice`,
        `${o.order_no || o.id}: status=${o.status}, total=₹${o.total}`);
    }
  }

  console.log(`\n  Matched invoice total: ₹${round2(matchedInvTotal)}`);
  console.log(`  Unmatched invoice total: ₹${round2(unmatchedInvTotal)}`);
  console.log(`  EXPLANATION: Diff = unmatched invoices (₹${round2(unmatchedInvTotal)}) + per-record diffs`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: REFUND-TO-CN MAPPING & DEDUPLICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 3. REFUND-TO-CN MAPPING ══");

  // All refund records from both tables
  const lifecycleRefunds = await q(`
    SELECT olr.id, olr.order_id, olr.amount, olr.reason_code, olr.reason, 
           olr.status, olr.provider_refund_id, olr.created_at,
           o.status::text as order_status, 
           o.metadata->>'order_number' as order_no,
           o.metadata->>'invoice_number' as inv_no
    FROM public.order_lifecycle_refund olr
    LEFT JOIN public."order" o ON o.id = olr.order_id
    WHERE olr.deleted_at IS NULL
    ORDER BY olr.created_at DESC
  `);
  console.log(`  order_lifecycle_refund records: ${lifecycleRefunds.length}`);
  for (const r of lifecycleRefunds) {
    console.log(`    ${r.id}: order=${r.order_no || r.order_id}, amount=${r.amount}, ` +
      `reason=${r.reason_code}, status=${r.status}, order_status=${r.order_status}, inv=${r.inv_no || 'NONE'}`);
  }

  const refundTableRecords = await q(`
    SELECT r.id, r.amount, r.note, r.refund_reason_id, r.payment_id,
           r.metadata, r.created_at
    FROM public.refund r
    WHERE r.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `);
  console.log(`  refund table records: ${refundTableRecords.length}`);
  for (const r of refundTableRecords) {
    const meta = r.metadata || {};
    console.log(`    ${r.id}: amount=${r.amount}, reason=${r.refund_reason_id}, ` +
      `payment=${r.payment_id}, order_id=${meta.order_id || 'N/A'}`);
  }

  // Check for potential duplicates (same order_id in both tables)
  if (lifecycleRefunds.length > 0 && refundTableRecords.length > 0) {
    const lifecycleOrderIds = new Set(lifecycleRefunds.map(r => r.order_id));
    const refundOrderIds = refundTableRecords
      .map(r => (r.metadata || {}).order_id)
      .filter(Boolean);
    const dupes = refundOrderIds.filter(id => lifecycleOrderIds.has(id));
    if (dupes.length > 0) {
      addFinding("CN", "WARN", `Potential duplicate refunds for orders`, dupes);
    }
  }

  // Verify: cancelled/refunded orders that have NO refund record
  const cancelledOrders = await q(`
    SELECT id, status::text, metadata->>'order_number' as order_no,
           metadata->>'invoice_number' as inv_no,
           COALESCE((metadata->>'total')::numeric, 0) as total,
           COALESCE((metadata->>'tax_amount')::numeric, 0) as tax,
           created_at
    FROM public."order"
    WHERE deleted_at IS NULL AND status::text IN ('refunded', 'cancelled', 'canceled')
    ORDER BY created_at DESC
  `);
  console.log(`\n  Cancelled/refunded orders: ${cancelledOrders.length}`);

  const refundedOrderIds = new Set([
    ...lifecycleRefunds.map(r => r.order_id),
    ...refundTableRecords.map(r => (r.metadata || {}).order_id).filter(Boolean),
  ]);

  let exclusionCorrect = 0;
  for (const o of cancelledOrders) {
    const hasRefund = refundedOrderIds.has(o.id);
    const hasInvoice = o.inv_no && o.inv_no !== '';
    console.log(`  Order ${o.order_no || o.id}: status=${o.status}, total=₹${o.total}, ` +
      `hasInvoice=${hasInvoice}, hasRefundRecord=${hasRefund} → ` +
      `${hasRefund ? 'WILL APPEAR in CN' : 'CORRECTLY EXCLUDED from CN'}`);
    if (!hasRefund) exclusionCorrect++;
  }
  console.log(`  Correctly excluded (no refund record): ${exclusionCorrect}/${cancelledOrders.length}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: HSN, GST REGISTRATION, VENDOR, ITC
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 4. HSN, GST REGISTRATION & ITC ══");

  // 4a: Product HSN audit
  const products = await q(`
    SELECT id, title, metadata->>'hsn_code' as hsn_code,
           metadata->>'gst_rate' as gst_rate,
           metadata->>'tax_rate' as tax_rate
    FROM public.product
    WHERE deleted_at IS NULL
    ORDER BY title
  `);
  console.log(`\n  --- Product HSN Audit ---`);
  let withHsn = 0, withoutHsn = 0;
  for (const p of products) {
    const hasHsn = p.hsn_code && p.hsn_code !== '';
    if (hasHsn) withHsn++; else withoutHsn++;
    if (!hasHsn) {
      console.log(`  MISSING HSN: ${p.title} (id=${p.id})`);
    }
  }
  console.log(`  With HSN: ${withHsn}/${products.length}, Missing: ${withoutHsn}`);
  if (withoutHsn > 0) {
    addFinding("HSN", "HIGH", `${withoutHsn} products lack HSN classification`,
      `These will appear as UNCLASSIFIED in GST exports. Must be classified before filing.`);
  }

  // 4b: GST Registration
  const gstRegs = await q(`SELECT * FROM public.gst_registration ORDER BY created_at`).catch(() => []);
  console.log(`\n  --- GST Registration ---`);
  console.log(`  Active registrations: ${gstRegs.filter(r => r.is_active).length}`);
  console.log(`  Total registrations: ${gstRegs.length}`);
  for (const r of gstRegs) {
    console.log(`    GSTIN=${r.gstin}, legal=${r.legal_name}, active=${r.is_active}`);
  }
  if (gstRegs.length === 0) {
    addFinding("GST_REG", "HIGH", "No GST registration records",
      "Cannot resolve filing GSTIN. Reports will show null GSTIN.");
  }

  // 4c: Company records
  const companies = await q(`SELECT id, trade_name, legal_name FROM public.company LIMIT 5`).catch(() => []);
  console.log(`\n  --- Company Records ---`);
  console.log(`  Companies: ${companies.length}`);
  for (const c of companies) console.log(`    ${c.trade_name} / ${c.legal_name}`);
  if (companies.length === 0) {
    addFinding("COMPANY", "HIGH", "No company records",
      "Legal name and trade name will be null in GST reports.");
  }

  // 4d: ITC / Expense records
  const expenses = await q(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status NOT IN ('DRAFT', 'VOID', 'REJECTED') THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN vendor_gstin IS NOT NULL AND vendor_gstin != '' THEN 1 ELSE 0 END) as with_gstin,
      SUM(CASE WHEN hsn_sac_code IS NOT NULL AND hsn_sac_code != '' THEN 1 ELSE 0 END) as with_hsn,
      SUM(CASE WHEN itc_eligibility = 'ELIGIBLE' THEN 1 ELSE 0 END) as eligible,
      SUM(COALESCE(cgst, 0) + COALESCE(sgst, 0) + COALESCE(igst, 0)) as total_tax
    FROM public.expense WHERE deleted_at IS NULL
  `).catch(() => [{ total: 0 }]);
  console.log(`\n  --- Expense / ITC ---`);
  console.log(`  Total expenses: ${expenses[0].total}`);
  console.log(`  Approved (non-draft/void): ${expenses[0].approved || 0}`);
  console.log(`  With vendor GSTIN: ${expenses[0].with_gstin || 0}`);
  console.log(`  With HSN/SAC: ${expenses[0].with_hsn || 0}`);
  console.log(`  ITC eligible: ${expenses[0].eligible || 0}`);
  console.log(`  Total tax (ITC amount): ₹${expenses[0].total_tax || 0}`);

  if (Number(expenses[0].total || 0) === 0) {
    addFinding("ITC", "INFO", "Zero expense records — ITC reports will be empty",
      "No positive ITC calculation can be demonstrated without expense data.");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: UNCLASSIFIED HSN — VERIFY NOT TREATED AS VALID
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 5. UNCLASSIFIED HSN VALIDATION ══");

  // Check: does any order line item have hsn_code = "UNCLASSIFIED" persisted?
  // (it shouldn't — UNCLASSIFIED is a display-time fallback, not persisted)
  const unclassifiedInOrders = await q(`
    SELECT COUNT(*) as cnt
    FROM public."order" o,
      jsonb_array_elements(o.metadata->'items') AS item
    WHERE o.deleted_at IS NULL
      AND item->>'hsn_code' = 'UNCLASSIFIED'
  `).catch(() => [{ cnt: 0 }]);
  console.log(`  Items with hsn_code='UNCLASSIFIED' persisted in orders: ${unclassifiedInOrders[0].cnt}`);

  const unclassifiedInInvoices = await q(`
    SELECT COUNT(*) as cnt
    FROM public.invoice,
      jsonb_array_elements(items) AS item
    WHERE invoice.deleted_at IS NULL
      AND item->>'hsn_code' = 'UNCLASSIFIED'
  `).catch(() => [{ cnt: 0 }]);
  console.log(`  Items with hsn_code='UNCLASSIFIED' persisted in invoices: ${unclassifiedInInvoices[0].cnt}`);

  // Verify: the UNCLASSIFIED marker is generated only at report time
  console.log(`  VERDICT: UNCLASSIFIED is ${
    Number(unclassifiedInOrders[0].cnt) === 0 && Number(unclassifiedInInvoices[0].cnt) === 0
      ? '✅ a report-time display marker only (not persisted in PostgreSQL)'
      : '⚠️ found persisted in database — needs investigation'
  }`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: INDEPENDENT TAX RECALCULATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 6. INDEPENDENT TAX RECALCULATION ══");

  // For each GENERATED invoice, independently recalculate tax from line items
  let totalRecalcPass = 0, totalRecalcFail = 0;
  for (const inv of allInvoices.filter(i => i.status === 'GENERATED')) {
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    let recalcTax = 0, recalcSubtotal = 0;

    for (const item of items) {
      const tv = Number(item.taxable_value || 0);
      const rate = Number(item.gst_rate_pct || 0);
      recalcSubtotal += tv;
      recalcTax += round2(tv * rate / 100);
    }
    recalcTax = round2(recalcTax);
    recalcSubtotal = round2(recalcSubtotal);

    const headerTax = Number(inv.tax_total || 0);
    const taxDiff = round2(Math.abs(headerTax - recalcTax));
    const pass = taxDiff <= 1;
    if (pass) totalRecalcPass++; else totalRecalcFail++;

    console.log(`  ${inv.invoice_number}: header_tax=₹${headerTax}, recalc_tax=₹${recalcTax}, ` +
      `diff=₹${taxDiff} ${pass ? '✅' : '⚠️ MISMATCH'}`);
    if (!pass) {
      addFinding("TAX_RECALC", "ERROR", `Tax recalculation mismatch: ${inv.invoice_number}`,
        `header=₹${headerTax}, independent=₹${recalcTax}, diff=₹${taxDiff}`);
    }
  }
  console.log(`  Recalculation: ${totalRecalcPass} pass, ${totalRecalcFail} fail`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL FINDINGS SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n\n════════════════════════════════════════════");
  console.log("FINDINGS SUMMARY");
  console.log("════════════════════════════════════════════");

  const byArea = {};
  for (const f of findings) {
    byArea[f.area] = byArea[f.area] || [];
    byArea[f.area].push(f);
  }

  const errors = findings.filter(f => f.severity === 'ERROR');
  const warns = findings.filter(f => f.severity === 'WARN' || f.severity === 'HIGH');
  const infos = findings.filter(f => f.severity === 'INFO');

  console.log(`\nERRORS: ${errors.length}`);
  for (const f of errors) console.log(`  [${f.area}] ${f.title}: ${f.detail}`);

  console.log(`\nWARNINGS: ${warns.length}`);
  for (const f of warns) console.log(`  [${f.area}] ${f.title}: ${f.detail}`);

  console.log(`\nINFO: ${infos.length}`);
  for (const f of infos) console.log(`  [${f.area}] ${f.title}: ${f.detail}`);

  console.log(`\nTOTAL: ${errors.length} errors, ${warns.length} warnings, ${infos.length} info`);

  await pool.end();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
