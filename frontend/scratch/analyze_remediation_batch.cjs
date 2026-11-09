const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'remediation_batch_13_orders.json'), 'utf8'));

console.log(`Loaded ${data.length} orders for batch remediation analysis.\n`);

const summary = data.map((o, idx) => {
  const m = o.metadata || {};
  const snap = m.compliance_snapshot || {};
  const delivery = m.delivery || {};

  // 1. Delivery Evidence
  const deliveredAt = m.delivered_at || m.delivery_completed_at || delivery.delivered_at || o.created_at;
  const deliveryRider = m.delivery_partner_id || delivery.partner_id || m.rider_id || 'Self-Pickup / Unassigned';
  const deliveryStatus = m.delivery_status || 'delivered';

  // 2. Cancellation / Refund check
  const hasRefund = (o.refund_records && o.refund_records.length > 0) || m.refund_status || m.is_refunded;

  // 3. Existing Invoice
  const hasExistingInv = o.existing_invoices && o.existing_invoices.length > 0;
  const existingInvNum = hasExistingInv ? o.existing_invoices[0].invoice_number : (m.invoice_number || null);

  // 4. Accounting Voucher
  const hasExistingVoucher = (o.existing_vouchers && o.existing_vouchers.length > 0) || m.accounting_voucher_id || m.voucher_id;
  const existingVoucherId = o.existing_vouchers?.[0]?.id || m.accounting_voucher_id || m.voucher_id || null;

  // 5. Financials & Taxes
  const grandTotal = Number(m.grand_total ?? m.total_amount ?? m.total ?? 0);
  const subtotal = Number(m.subtotal ?? 0);
  const taxTotal = Number(m.tax_amount ?? m.tax_total ?? 0);
  const deliveryFee = Number(m.delivery?.fee ?? m.delivery_fee ?? 0);
  const discountTotal = Number(m.discount_amount ?? m.discount_total ?? 0);
  const taxableValue = subtotal > 0 ? (subtotal - discountTotal) : (grandTotal - taxTotal - deliveryFee);

  // 6. Tax jurisdiction
  const sellerGstin = snap.seller_gstin || m.seller_gstin || '29AAAAA0000A1Z5';
  const sellerState = snap.seller_state || m.seller_state || 'Karnataka';
  const customerState = snap.customer_state || m.delivery_address?.state || m.state || 'Karnataka';
  const isIntraState = snap.is_intra_state !== false;

  const cgst = isIntraState ? Math.round((taxTotal / 2) * 100) / 100 : 0;
  const sgst = isIntraState ? Math.round((taxTotal - cgst) * 100) / 100 : 0;
  const igst = !isIntraState ? taxTotal : 0;

  // 7. Customer
  const customerName = m.customer_name || o.customer_info?.first_name || 'Retail Customer';
  const customerGstin = m.customer_gstin || snap.customer_gstin || o.customer_info?.metadata?.gstin || null;
  const customerType = customerGstin ? 'B2B' : 'B2C';

  // 8. Line Items & HSN
  const items = Array.isArray(m.items) && m.items.length > 0 ? m.items : o.db_items;
  const itemsSummary = items.map(i => ({
    name: i.title || i.name || 'Item',
    qty: i.quantity || 1,
    hsn: i.hsn_code || '19059010',
    rate: i.unit_price || 0,
    gst_pct: i.gst_rate_pct || 5
  }));

  // 9. Payment
  const paymentMethod = m.payment_method || 'prepaid_online';
  const paymentStatus = m.payment_status || 'paid';
  const isCod = paymentMethod.toLowerCase() === 'cod';

  // 10. Eligibility Assessment
  let eligibility = 'ELIGIBLE';
  const blockers = [];

  if (hasExistingInv) {
    eligibility = 'INVOICE_ALREADY_EXISTS';
    blockers.push(`Already has invoice ${existingInvNum}`);
  }
  if (hasRefund) {
    eligibility = 'REFUND_OR_CANCELLATION_RECORD';
    blockers.push('Order has refund/cancellation record');
  }
  if (o.order_status !== 'completed' && o.order_status !== 'delivered') {
    blockers.push(`Order status is '${o.order_status}'`);
  }
  if (grandTotal <= 0) {
    eligibility = 'ZERO_OR_INVALID_TOTAL';
    blockers.push('Order total is 0 or negative');
  }

  return {
    index: idx + 1,
    orderId: o.order_id,
    orderNumber: o.order_number,
    orderStatus: o.order_status,
    sellerEntity: m.partner_id ? `PARTNER_${m.partner_id}` : 'CAKETOHOME_PARENT',
    sellerGstin,
    customerName,
    customerGstin,
    customerType,
    deliveryStatus,
    deliveredAt,
    deliveryRider,
    proposedInvoiceDate: deliveredAt ? new Date(deliveredAt).toISOString().slice(0, 10) : new Date(o.created_at).toISOString().slice(0, 10),
    paymentMethod,
    paymentStatus,
    isCod,
    grandTotal,
    taxableValue: Math.max(0, taxableValue),
    taxTotal,
    cgst,
    sgst,
    igst,
    itemCount: items.length,
    items: itemsSummary,
    hasExistingVoucher: Boolean(hasExistingVoucher),
    existingVoucherId,
    eligibility,
    blockers: blockers.join('; ') || 'None'
  };
});

fs.writeFileSync(path.resolve(__dirname, 'remediation_batch_summary.json'), JSON.stringify(summary, null, 2));

console.log('=== 13-ORDER REMEDIATION BATCH VALIDATION SUMMARY ===');
console.table(summary.map(s => ({
  idx: s.index,
  orderNumber: s.orderNumber,
  customer: s.customerName,
  total: s.grandTotal,
  tax: s.taxTotal,
  pmt: s.paymentMethod,
  voucher: s.existingVoucherId ? s.existingVoucherId.slice(0, 12) + '...' : 'None',
  eligibility: s.eligibility,
  blockers: s.blockers
})));
