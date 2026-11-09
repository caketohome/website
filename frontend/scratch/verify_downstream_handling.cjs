const fs = require('fs');
const path = require('path');

// Simulate order register rows
const simulatedOrders = [
  // 1. Legitimate delivered order WITH statutory invoice -> COMPLIANT
  {
    orderId: 'ord_real_001',
    orderNumber: 'CTH-20261022-0001',
    orderStatus: 'completed',
    deliveryStatus: 'delivered',
    classification: 'PRODUCTION',
    invoiceNumber: 'CTH/26-27/000031',
    taxAmount: 50,
    grandTotal: 1050,
    taxableAmount: 1000
  },
  // 2. Legitimate delivered order WITHOUT invoice -> PENDING_INVOICE (Must be caught!)
  {
    orderId: 'ord_real_002',
    orderNumber: 'CTH-20261022-0002',
    orderStatus: 'completed',
    deliveryStatus: 'delivered',
    classification: 'PRODUCTION',
    invoiceNumber: null,
    taxAmount: 25,
    grandTotal: 525,
    taxableAmount: 500
  },
  // 3. Test COD fixture order (Exempt) -> EXCLUDED from statutory sales register
  {
    orderId: 'ord_test_cod_1792216816562',
    orderNumber: 'ORD-099991-1792216816562',
    orderStatus: 'completed',
    deliveryStatus: 'delivered',
    classification: 'TEST',
    invoicing_exempt: true,
    invoiceNumber: null,
    taxAmount: 0,
    grandTotal: 350,
    taxableAmount: 350
  }
];

// Test downstream filtering logic
const gstExcluded = ['cancelled', 'canceled', 'refunded', 'draft', 'abandoned'];

const invoiceRegister = [];
for (const order of simulatedOrders) {
  if (gstExcluded.includes(order.orderStatus.toLowerCase())) continue;
  // Test exemption filter
  if (order.classification === 'TEST' || order.classification === 'PROTOTYPE' || order.invoicing_exempt === true) {
    console.log(`[GST Filter] Successfully excluded test fixture ${order.orderNumber} (${order.orderId}) from outward statutory return.`);
    continue;
  }

  const invoiceNumber = order.invoiceNumber || null;
  const isDelivered = order.orderStatus === 'delivered' || order.orderStatus === 'completed' || order.deliveryStatus === 'delivered';
  const complianceStatus = invoiceNumber ? 'COMPLIANT' : (isDelivered ? 'PENDING_INVOICE' : 'NOT_INVOICED');

  invoiceRegister.push({
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    invoiceNumber,
    complianceStatus,
    grandTotal: order.grandTotal
  });
}

console.log('\n--- Resulting Statutory Invoice Register ---');
console.table(invoiceRegister);

// Verify tests
const testInRegister = invoiceRegister.some(r => r.orderId.includes('test_cod'));
if (testInRegister) {
  throw new Error('FAILED: Test fixture leaked into statutory invoice register!');
}
console.log('✅ PASS: Test fixture cleanly excluded from statutory invoice register.');

const pendingMissing = invoiceRegister.filter(r => r.complianceStatus === 'PENDING_INVOICE');
if (pendingMissing.length !== 1 || pendingMissing[0].orderId !== 'ord_real_002') {
  throw new Error('FAILED: Legitimate missing invoice was suppressed or not flagged!');
}
console.log('✅ PASS: Legitimate un-invoiced order (ord_real_002) is correctly flagged as PENDING_INVOICE.');

const compliant = invoiceRegister.filter(r => r.complianceStatus === 'COMPLIANT');
if (compliant.length !== 1 || compliant[0].orderId !== 'ord_real_001') {
  throw new Error('FAILED: Invoiced order was not marked COMPLIANT!');
}
console.log('✅ PASS: Legitimate invoiced order is marked COMPLIANT.');
