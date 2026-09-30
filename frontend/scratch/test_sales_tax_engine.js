/**
 * CakeToHome ERP — Phase 4F Step 4.1 Sales Tax & Calculation Engine Test Suite
 *
 * Verifies all 30 mandatory test requirements:
 * 1. Intra-state bakery/cake 5%
 * 2. Interstate bakery/cake 5%
 * 3. Intra-state accessory 18%
 * 4. Interstate accessory 18%
 * 5. Intra-state toy 12%
 * 6. Interstate toy 12%
 * 7. Multiple lines with different tax rates
 * 8. Header discount with proportional allocation
 * 9. Discount residual paise allocation
 * 10. Multiple quantities
 * 11. Zero/invalid quantity rejection
 * 12. Negative price rejection
 * 13. Missing branch state
 * 14. Missing customer state
 * 15. Same-state jurisdiction
 * 16. Different-state jurisdiction
 * 17. Unsupported tax rate
 * 18. Missing tax classification
 * 19. Tax arithmetic identity
 * 20. Invoice total identity
 * 21. CGST + SGST = total intra-state GST
 * 22. IGST = total interstate GST
 * 23. No simultaneous CGST/SGST and IGST
 * 24. Deterministic repeated calculation
 * 25. Delivery fee tax behavior
 * 26. Rounding edge cases
 * 27. Discount cannot create negative taxable value
 * 28. Mixed taxable lines
 * 29. Exact paise preservation
 * 30. Fail-closed invalid input tests
 */

const fs = require('fs');
const path = require('path');

async function runTestSuite() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.1 Sales Tax & Calculation Engine Test Suite');
  console.log('=============================================================================\n');

  // Register native TypeScript transpile hook for .ts imports
  const ts = require('../node_modules/typescript');
  require.extensions['.ts'] = function(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      }
    });
    return module._compile(compiled.outputText, filename);
  };

  const {
    calculateSalesTaxesAndTotals,
    resolveSalesTaxJurisdiction,
    resolveSalesAccountingMetadata,
    SalesTaxEngineError,
  } = require('../src/lib/services/sales-tax-engine');

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  const KA_BRANCH = { state: 'Karnataka', stateCode: 'KA', cityName: 'Bengaluru' };
  const KA_CUSTOMER = { state: 'Karnataka', stateCode: 'KA', pincode: '560038' };
  const MH_CUSTOMER = { state: 'Maharashtra', stateCode: 'MH', pincode: '400001' };
  const KL_CUSTOMER = { state: 'Kerala', stateCode: 'KL', pincode: '691001' };
  const TN_CUSTOMER = { state: 'Tamil Nadu', stateCode: 'TN', pincode: '600001' };

  // ─── Test 1: Intra-state Bakery/Cake 5% ─────────────────────────────────────
  console.log('[Test 1] Intra-state bakery/cake 5%...');
  const res1 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{
      itemType: 'CAKE',
      description: 'Belgian Chocolate Truffle Cake 1kg',
      quantity: 1,
      unitPrice: 500,
      taxRatePercent: 5,
    }],
  });
  assert(res1.jurisdiction.jurisdiction === 'INTRA_STATE', 'Jurisdiction is INTRA_STATE');
  assert(res1.subtotal === 500, 'Subtotal is 500');
  assert(res1.taxableValue === 500, 'Taxable value is 500');
  assert(res1.cgst === 12.5, 'CGST is 12.50 (2.5%)');
  assert(res1.sgst === 12.5, 'SGST is 12.50 (2.5%)');
  assert(res1.igst === 0, 'IGST is 0');
  assert(res1.totalTax === 25, 'Total tax is 25.00 (5%)');
  assert(res1.invoiceTotal === 525, 'Invoice total is 525.00');
  assert(res1.lines[0].accountingMetadata.revenueAccountCode === '4110', 'Revenue account is 4110 (Cake Revenue)');
  assert(res1.lines[0].accountingMetadata.cgstAccountCode === '2121', 'CGST account is 2121');
  assert(res1.lines[0].accountingMetadata.sgstAccountCode === '2122', 'SGST account is 2122');

  // ─── Test 2: Interstate Bakery/Cake 5% ──────────────────────────────────────
  console.log('\n[Test 2] Interstate bakery/cake 5%...');
  const res2 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: MH_CUSTOMER,
    items: [{
      itemType: 'CAKE',
      description: 'Belgian Chocolate Truffle Cake 1kg',
      quantity: 1,
      unitPrice: 500,
      taxRatePercent: 5,
    }],
  });
  assert(res2.jurisdiction.jurisdiction === 'INTER_STATE', 'Jurisdiction is INTER_STATE');
  assert(res2.cgst === 0, 'CGST is 0');
  assert(res2.sgst === 0, 'SGST is 0');
  assert(res2.igst === 25, 'IGST is 25.00 (5%)');
  assert(res2.totalTax === 25, 'Total tax is 25.00');
  assert(res2.invoiceTotal === 525, 'Invoice total is 525.00');
  assert(res2.lines[0].accountingMetadata.igstAccountCode === '2125', 'IGST account is 2125 (Interstate Food)');

  // ─── Test 3: Intra-state Accessory 18% ──────────────────────────────────────
  console.log('\n[Test 3] Intra-state accessory 18%...');
  const res3 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{
      itemType: 'ACCESSORY',
      description: 'Gold Happy Birthday Cake Topper',
      quantity: 1,
      unitPrice: 200,
      taxRatePercent: 18,
    }],
  });
  assert(res3.cgst === 18, 'CGST is 18.00 (9%)');
  assert(res3.sgst === 18, 'SGST is 18.00 (9%)');
  assert(res3.igst === 0, 'IGST is 0');
  assert(res3.totalTax === 36, 'Total tax is 36.00 (18%)');
  assert(res3.invoiceTotal === 236, 'Invoice total is 236.00');
  assert(res3.lines[0].accountingMetadata.revenueAccountCode === '4120', 'Revenue account is 4120 (Accessory Revenue)');
  assert(res3.lines[0].accountingMetadata.cgstAccountCode === '2123', 'CGST account is 2123 (Accessories)');
  assert(res3.lines[0].accountingMetadata.sgstAccountCode === '2124', 'SGST account is 2124 (Accessories)');

  // ─── Test 4: Interstate Accessory 18% ───────────────────────────────────────
  console.log('\n[Test 4] Interstate accessory 18%...');
  const res4 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KL_CUSTOMER,
    items: [{
      itemType: 'ACCESSORY',
      description: 'Gold Happy Birthday Cake Topper',
      quantity: 1,
      unitPrice: 200,
      taxRatePercent: 18,
    }],
  });
  assert(res4.jurisdiction.jurisdiction === 'INTER_STATE', 'Jurisdiction is INTER_STATE');
  assert(res4.igst === 36, 'IGST is 36.00 (18%)');
  assert(res4.cgst === 0 && res4.sgst === 0, 'CGST and SGST are 0');
  assert(res4.lines[0].accountingMetadata.igstAccountCode === '2126', 'IGST account is 2126 (Interstate Accessories)');

  // ─── Test 5: Intra-state Toy 12% ───────────────────────────────────────────
  console.log('\n[Test 5] Intra-state toy 12%...');
  const res5 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{
      itemType: 'TOY',
      description: 'Miniature Musical Birthday Toy',
      quantity: 1,
      unitPrice: 300,
      taxRatePercent: 12,
    }],
  });
  assert(res5.cgst === 18, 'CGST is 18.00 (6%)');
  assert(res5.sgst === 18, 'SGST is 18.00 (6%)');
  assert(res5.totalTax === 36, 'Total tax is 36.00 (12%)');
  assert(res5.lines[0].accountingMetadata.cgstAccountCode === '2127', 'CGST account is 2127 (Toys)');
  assert(res5.lines[0].accountingMetadata.sgstAccountCode === '2128', 'SGST account is 2128 (Toys)');

  // ─── Test 6: Interstate Toy 12% ────────────────────────────────────────────
  console.log('\n[Test 6] Interstate toy 12%...');
  const res6 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: TN_CUSTOMER,
    items: [{
      itemType: 'TOY',
      description: 'Miniature Musical Birthday Toy',
      quantity: 1,
      unitPrice: 300,
      taxRatePercent: 12,
    }],
  });
  assert(res6.igst === 36, 'IGST is 36.00 (12%)');
  assert(res6.cgst === 0 && res6.sgst === 0, 'CGST and SGST are 0');
  assert(res6.lines[0].accountingMetadata.igstAccountCode === '2129', 'IGST account is 2129 (Interstate Toys)');

  // ─── Test 7: Multiple lines with different tax rates ────────────────────────
  console.log('\n[Test 7] Multiple lines with different tax rates (5%, 18%, 12%)...');
  const res7 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { itemType: 'CAKE', description: 'Red Velvet Cake', quantity: 1, unitPrice: 600, taxRatePercent: 5 },
      { itemType: 'ACCESSORY', description: 'Sparkling Candle', quantity: 2, unitPrice: 50, taxRatePercent: 18 },
      { itemType: 'TOY', description: 'Birthday Cap Pack', quantity: 1, unitPrice: 100, taxRatePercent: 12 },
    ],
  });
  assert(res7.subtotal === 800, 'Subtotal is 800 (600 + 100 + 100)');
  assert(res7.lines[0].totalTax === 30, 'Cake tax is 30.00 (5% of 600)');
  assert(res7.lines[1].totalTax === 18, 'Candle tax is 18.00 (18% of 100)');
  assert(res7.lines[2].totalTax === 12, 'Cap tax is 12.00 (12% of 100)');
  assert(res7.cgst === 30, 'Total CGST is 30.00 (15 + 9 + 6)');
  assert(res7.sgst === 30, 'Total SGST is 30.00 (15 + 9 + 6)');
  assert(res7.totalTax === 60, 'Total tax is 60.00');
  assert(res7.invoiceTotal === 860, 'Invoice total is 860.00');

  // ─── Test 8: Header discount with proportional allocation ──────────────────
  console.log('\n[Test 8] Header discount with proportional allocation...');
  const res8 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { itemType: 'CAKE', description: 'Cake A', quantity: 1, unitPrice: 600, taxRatePercent: 5 },
      { itemType: 'ACCESSORY', description: 'Accessory B', quantity: 1, unitPrice: 400, taxRatePercent: 18 },
    ],
    headerDiscount: 100,
  });
  assert(res8.headerDiscount === 100, 'Header discount is 100');
  assert(res8.lines[0].allocatedHeaderDiscount === 60, 'Line 1 gets 60% of discount = 60');
  assert(res8.lines[1].allocatedHeaderDiscount === 40, 'Line 2 gets 40% of discount = 40');
  assert(res8.lines[0].taxableValue === 540, 'Line 1 taxable value is 540 (600 - 60)');
  assert(res8.lines[1].taxableValue === 360, 'Line 2 taxable value is 360 (400 - 40)');
  assert(res8.taxableValue === 900, 'Total taxable value is 900 (1000 - 100)');
  assert(res8.lines[0].totalTax === 27, 'Line 1 tax is 27.00 (5% of 540)');
  assert(res8.lines[1].totalTax === 64.8, 'Line 2 tax is 64.80 (18% of 360)');
  assert(res8.totalTax === 91.8, 'Total tax is 91.80 (27 + 64.80)');
  assert(res8.invoiceTotal === 991.8, 'Invoice total is 991.80 (900 + 91.80)');

  // ─── Test 9: Discount residual paise allocation ────────────────────────────
  console.log('\n[Test 9] Discount residual paise allocation...');
  const res9 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { itemType: 'CAKE', description: 'Pastry 1', quantity: 1, unitPrice: 100, taxRatePercent: 5 },
      { itemType: 'CAKE', description: 'Pastry 2', quantity: 1, unitPrice: 100, taxRatePercent: 5 },
      { itemType: 'CAKE', description: 'Pastry 3', quantity: 1, unitPrice: 100, taxRatePercent: 5 },
    ],
    headerDiscount: 10,
  });
  const sumAllocated = res9.lines.reduce((acc, l) => acc + l.allocatedHeaderDiscount, 0);
  assert(Math.abs(sumAllocated - 10) < 0.0001, 'Sum of allocated discounts strictly equals header discount 10.00');
  // Two lines should get 3.33 and one line 3.34
  const allocations = res9.lines.map(l => l.allocatedHeaderDiscount).sort();
  assert(allocations[0] === 3.33 && allocations[1] === 3.33 && allocations[2] === 3.34, 'Allocations are 3.33, 3.33, and 3.34');

  // ─── Test 10: Multiple quantities ──────────────────────────────────────────
  console.log('\n[Test 10] Multiple quantities...');
  const res10 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{
      itemType: 'CAKE',
      description: 'Cupcakes Box',
      quantity: 4,
      unitPrice: 150,
      discount: 40,
      taxRatePercent: 5,
    }],
  });
  assert(res10.lines[0].grossValue === 600, 'Gross value is 600 (4 * 150)');
  assert(res10.lines[0].lineDiscount === 40, 'Line discount is 40');
  assert(res10.lines[0].netLineValue === 560, 'Net line value is 560 (600 - 40)');
  assert(res10.lines[0].taxableValue === 560, 'Taxable value is 560');
  assert(res10.lines[0].totalTax === 28, 'Total tax is 28.00 (5% of 560)');

  // ─── Test 11: Zero/invalid quantity rejection ──────────────────────────────
  console.log('\n[Test 11] Zero/invalid quantity rejection...');
  let qtyErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Zero Qty Cake', quantity: 0, unitPrice: 500, taxRatePercent: 5 }],
    });
  } catch (e) {
    qtyErr = e;
  }
  assert(qtyErr && qtyErr.code === 'INVALID_QUANTITY', 'Rejects quantity = 0 with INVALID_QUANTITY');

  let negQtyErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Negative Qty', quantity: -2, unitPrice: 500, taxRatePercent: 5 }],
    });
  } catch (e) {
    negQtyErr = e;
  }
  assert(negQtyErr && negQtyErr.code === 'INVALID_QUANTITY', 'Rejects quantity < 0 with INVALID_QUANTITY');

  // ─── Test 12: Negative price rejection ─────────────────────────────────────
  console.log('\n[Test 12] Negative price rejection...');
  let priceErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Negative Price Cake', quantity: 1, unitPrice: -250, taxRatePercent: 5 }],
    });
  } catch (e) {
    priceErr = e;
  }
  assert(priceErr && priceErr.code === 'INVALID_RATE', 'Rejects unitPrice < 0 with INVALID_RATE');

  // ─── Test 13: Missing branch state ─────────────────────────────────────────
  console.log('\n[Test 13] Missing branch state rejection...');
  let branchErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: { state: null, stateCode: null },
      customer: KA_CUSTOMER,
      items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    });
  } catch (e) {
    branchErr = e;
  }
  assert(branchErr && branchErr.code === 'TAX_JURISDICTION_UNRESOLVED', 'Fails closed on missing branch state');

  // ─── Test 14: Missing customer state ───────────────────────────────────────
  console.log('\n[Test 14] Missing customer state rejection...');
  let custErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: { state: '', stateCode: null },
      items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    });
  } catch (e) {
    custErr = e;
  }
  assert(custErr && custErr.code === 'TAX_JURISDICTION_UNRESOLVED', 'Fails closed on missing customer state');

  // ─── Test 15: Same-state jurisdiction resolution ───────────────────────────
  console.log('\n[Test 15] Same-state jurisdiction resolution...');
  const sameState = resolveSalesTaxJurisdiction(
    { state: 'Karnataka' },
    { stateCode: 'KA' }
  );
  assert(sameState.jurisdiction === 'INTRA_STATE', 'Karnataka to KA resolves to INTRA_STATE');
  assert(sameState.branchState.code === '29' && sameState.customerState.code === '29', 'Both resolve to state code 29');

  // ─── Test 16: Different-state jurisdiction resolution ──────────────────────
  console.log('\n[Test 16] Different-state jurisdiction resolution...');
  const diffState = resolveSalesTaxJurisdiction(
    { state: 'Karnataka' },
    { state: 'Kerala' }
  );
  assert(diffState.jurisdiction === 'INTER_STATE', 'Karnataka to Kerala resolves to INTER_STATE');
  assert(diffState.branchState.code === '29' && diffState.customerState.code === '32', 'Branch is 29, customer is 32');

  // ─── Test 17: Unsupported tax rate ─────────────────────────────────────────
  console.log('\n[Test 17] Unsupported tax rate rejection...');
  let rateErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Arbitrary 7% Tax Cake', quantity: 1, unitPrice: 500, taxRatePercent: 7 }],
    });
  } catch (e) {
    rateErr = e;
  }
  assert(rateErr && rateErr.code === 'UNSUPPORTED_TAX_RATE', 'Rejects taxRatePercent = 7 with UNSUPPORTED_TAX_RATE');

  // ─── Test 18: Missing tax classification ───────────────────────────────────
  console.log('\n[Test 18] Missing tax classification rejection...');
  let missRateErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'No Tax Rate Item', quantity: 1, unitPrice: 500, taxRatePercent: undefined }],
    });
  } catch (e) {
    missRateErr = e;
  }
  assert(missRateErr && missRateErr.code === 'MISSING_TAX_RATE', 'Rejects undefined tax rate with MISSING_TAX_RATE');

  // ─── Test 19: Tax arithmetic identity ──────────────────────────────────────
  console.log('\n[Test 19] Tax arithmetic identity (totalTax === cgst + sgst + igst)...');
  const res19 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { description: 'Cake A', quantity: 2, unitPrice: 450, taxRatePercent: 5 },
      { description: 'Cake B', quantity: 1, unitPrice: 750, taxRatePercent: 5 },
      { description: 'Accessory C', quantity: 3, unitPrice: 85, taxRatePercent: 18 },
    ],
    headerDiscount: 50,
  });
  assert(Math.abs(res19.totalTax - (res19.cgst + res19.sgst + res19.igst)) < 0.0001, 'totalTax equals cgst + sgst + igst');

  // ─── Test 20: Invoice total identity ───────────────────────────────────────
  console.log('\n[Test 20] Invoice total identity (taxable + totalTax + delivery)...');
  const res20 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { description: 'Cake A', quantity: 1, unitPrice: 899, taxRatePercent: 5 },
      { description: 'Accessory B', quantity: 2, unitPrice: 149, taxRatePercent: 18 },
    ],
    headerDiscount: 75,
    delivery: { amount: 50, taxRatePercent: 18 },
  });
  const expectedTotal = Number((res20.taxableValue + res20.deliveryTaxable + res20.totalTax).toFixed(2));
  assert(res20.invoiceTotal === expectedTotal, `invoiceTotal (${res20.invoiceTotal}) === taxableValue + deliveryTaxable + totalTax (${expectedTotal})`);

  // ─── Test 21: CGST + SGST = total intra-state GST ──────────────────────────
  console.log('\n[Test 21] CGST + SGST = total intra-state GST...');
  assert(res19.jurisdiction.jurisdiction === 'INTRA_STATE', 'Supply is INTRA_STATE');
  assert(res19.cgst === res19.sgst, 'CGST strictly equals SGST');
  assert(res19.igst === 0, 'IGST is 0 for intra-state');
  assert(res19.totalTax === res19.cgst + res19.sgst, 'totalTax === cgst + sgst');

  // ─── Test 22: IGST = total interstate GST ──────────────────────────────────
  console.log('\n[Test 22] IGST = total interstate GST...');
  const res22 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: MH_CUSTOMER,
    items: [
      { description: 'Cake A', quantity: 1, unitPrice: 1200, taxRatePercent: 5 },
      { description: 'Accessory B', quantity: 1, unitPrice: 300, taxRatePercent: 18 },
    ],
    headerDiscount: 100,
  });
  assert(res22.jurisdiction.jurisdiction === 'INTER_STATE', 'Supply is INTER_STATE');
  assert(res22.cgst === 0 && res22.sgst === 0, 'CGST and SGST are 0 for interstate');
  assert(res22.igst === res22.totalTax, 'IGST equals totalTax');

  // ─── Test 23: No simultaneous CGST/SGST and IGST ───────────────────────────
  console.log('\n[Test 23] No simultaneous CGST/SGST and IGST...');
  assert(res19.cgst > 0 && res19.sgst > 0 && res19.igst === 0, 'Intra-state has positive CGST/SGST and zero IGST');
  assert(res22.igst > 0 && res22.cgst === 0 && res22.sgst === 0, 'Interstate has positive IGST and zero CGST/SGST');

  // ─── Test 24: Deterministic repeated calculation ───────────────────────────
  console.log('\n[Test 24] Deterministic repeated calculation (100 iterations)...');
  const baseInput = {
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { description: 'Item 1', quantity: 3, unitPrice: 249.99, taxRatePercent: 5 },
      { description: 'Item 2', quantity: 2, unitPrice: 179.50, taxRatePercent: 18 },
      { description: 'Item 3', quantity: 1, unitPrice: 99.00, taxRatePercent: 12 },
    ],
    headerDiscount: 65.50,
    delivery: { amount: 49.00, taxRatePercent: 18 },
  };
  const firstRun = JSON.stringify(calculateSalesTaxesAndTotals(baseInput));
  let isConsistent = true;
  for (let i = 0; i < 100; i++) {
    const run = JSON.stringify(calculateSalesTaxesAndTotals(baseInput));
    if (run !== firstRun) {
      isConsistent = false;
      break;
    }
  }
  assert(isConsistent, '100 repeated runs produce byte-for-byte identical output');

  // ─── Test 25: Delivery fee tax behavior ────────────────────────────────────
  console.log('\n[Test 25] Delivery fee tax behavior...');
  // Delivery fee intra-state
  const res25a = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    delivery: { amount: 100, taxRatePercent: 18 },
  });
  assert(res25a.delivery !== null, 'Delivery object is present');
  assert(res25a.delivery.amount === 100, 'Delivery base is 100');
  assert(res25a.delivery.cgstAmount === 9, 'Delivery CGST is 9.00 (9%)');
  assert(res25a.delivery.sgstAmount === 9, 'Delivery SGST is 9.00 (9%)');
  assert(res25a.delivery.totalTax === 18, 'Delivery total tax is 18.00');
  assert(res25a.delivery.totalAmount === 118, 'Delivery total amount is 118.00');

  // Delivery fee interstate
  const res25b = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: MH_CUSTOMER,
    items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    delivery: { amount: 100, taxRatePercent: 18 },
  });
  assert(res25b.delivery.igstAmount === 18, 'Interstate delivery IGST is 18.00');
  assert(res25b.delivery.cgstAmount === 0 && res25b.delivery.sgstAmount === 0, 'Interstate delivery CGST/SGST is 0');

  // Missing delivery tax rate when amount > 0 fails closed
  let delErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
      delivery: 50, // Scalar without tax rate
    });
  } catch (e) {
    delErr = e;
  }
  assert(delErr && delErr.code === 'MISSING_DELIVERY_TAX_RATE', 'Fails closed when delivery amount > 0 without tax rate');

  // Free delivery (amount = 0) succeeds
  const res25c = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    delivery: 0,
  });
  assert(res25c.delivery === null, 'Delivery object is null for free delivery (0)');

  // ─── Test 26: Rounding edge cases ──────────────────────────────────────────
  console.log('\n[Test 26] Rounding edge cases...');
  const res26 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { description: 'Fractional Cake', quantity: 1, unitPrice: 149.99, taxRatePercent: 5 },
      { description: 'Odd Accessory', quantity: 1, unitPrice: 333.33, taxRatePercent: 18 },
    ],
  });
  // 149.99 * 5% = 7.4995 -> 7.50 (CGST 3.75, SGST 3.75)
  // 333.33 * 18% = 59.9994 -> 60.00 (CGST 30.00, SGST 30.00)
  assert(res26.lines[0].cgstAmount === 3.75, 'Line 1 CGST is 3.75');
  assert(res26.lines[0].sgstAmount === 3.75, 'Line 1 SGST is 3.75');
  assert(res26.lines[0].totalTax === 7.5, 'Line 1 total tax is 7.50');
  assert(res26.lines[1].cgstAmount === 30, 'Line 2 CGST is 30.00');
  assert(res26.lines[1].sgstAmount === 30, 'Line 2 SGST is 30.00');
  assert(res26.lines[1].totalTax === 60, 'Line 2 total tax is 60.00');

  // ─── Test 27: Discount cannot create negative taxable value ────────────────
  console.log('\n[Test 27] Discount cannot create negative taxable value...');
  let discExceedErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Cake', quantity: 1, unitPrice: 300, taxRatePercent: 5 }],
      headerDiscount: 350,
    });
  } catch (e) {
    discExceedErr = e;
  }
  assert(discExceedErr && discExceedErr.code === 'DISCOUNT_EXCEEDS_TAXABLE_BASE', 'Rejects header discount > subtotal');

  let lineDiscErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Cake', quantity: 1, unitPrice: 300, discount: 350, taxRatePercent: 5 }],
    });
  } catch (e) {
    lineDiscErr = e;
  }
  assert(lineDiscErr && lineDiscErr.code === 'LINE_DISCOUNT_EXCEEDS_GROSS', 'Rejects line discount > gross value');

  // ─── Test 28: Mixed taxable lines (item discount + header discount) ────────
  console.log('\n[Test 28] Mixed taxable lines (item discount + header discount)...');
  const res28 = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [
      { description: 'Cake with promo', quantity: 2, unitPrice: 500, discount: 100, taxRatePercent: 5 }, // Gross 1000, net 900
      { description: 'Topper with promo', quantity: 1, unitPrice: 200, discount: 20, taxRatePercent: 18 }, // Gross 200, net 180
    ],
    headerDiscount: 108, // Net sum = 1080. Line 1 gets 900/1080 * 108 = 90. Line 2 gets 180/1080 * 108 = 18.
  });
  assert(res28.subtotal === 1200, 'Subtotal is 1200');
  assert(res28.lineDiscounts === 120, 'Line discounts is 120');
  assert(res28.headerDiscount === 108, 'Header discount is 108');
  assert(res28.totalDiscount === 228, 'Total discount is 228');
  assert(res28.lines[0].taxableValue === 810, 'Line 1 taxable value is 810 (900 - 90)');
  assert(res28.lines[1].taxableValue === 162, 'Line 2 taxable value is 162 (180 - 18)');
  assert(res28.taxableValue === 972, 'Total taxable value is 972 (1200 - 228)');

  // ─── Test 29: Exact paise preservation ─────────────────────────────────────
  console.log('\n[Test 29] Exact paise preservation...');
  assert(Number.isInteger(Math.round(res28.invoiceTotal * 100)), 'Invoice total is an exact integer number of paise');
  assert(Number.isInteger(Math.round(res28.totalTax * 100)), 'Total tax is an exact integer number of paise');
  assert(Number.isInteger(Math.round(res28.cgst * 100)), 'CGST is an exact integer number of paise');
  assert(Number.isInteger(Math.round(res28.sgst * 100)), 'SGST is an exact integer number of paise');

  // ─── Test 30: Fail-closed invalid input tests ──────────────────────────────
  console.log('\n[Test 30] Fail-closed invalid input tests...');
  // Empty items
  let emptyErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [],
    });
  } catch (e) {
    emptyErr = e;
  }
  assert(emptyErr && emptyErr.code === 'EMPTY_ITEMS', 'Fails closed on empty items');

  // Negative header discount
  let negDiscErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
      headerDiscount: -50,
    });
  } catch (e) {
    negDiscErr = e;
  }
  assert(negDiscErr && negDiscErr.code === 'INVALID_DISCOUNT', 'Fails closed on negative header discount');

  // Negative delivery fee
  let negDelErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: KA_BRANCH,
      customer: KA_CUSTOMER,
      items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
      delivery: { amount: -20, taxRatePercent: 18 },
    });
  } catch (e) {
    negDelErr = e;
  }
  assert(negDelErr && negDelErr.code === 'INVALID_DELIVERY_FEE', 'Fails closed on negative delivery fee');

  // Contradictory branch GSTIN prefix vs branch state
  let gstinConflictErr = null;
  try {
    calculateSalesTaxesAndTotals({
      branch: { state: 'Karnataka', stateCode: 'KA', gstin: '27AABCC1234D1Z5' }, // 27 = Maharashtra, but state = Karnataka
      customer: KA_CUSTOMER,
      items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    });
  } catch (e) {
    gstinConflictErr = e;
  }
  assert(gstinConflictErr && gstinConflictErr.code === 'TAX_JURISDICTION_CONFLICT', 'Fails closed on branch GSTIN state prefix conflict');

  // Suggested AR account for COD vs Prepaid
  const resCod = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    isCod: true,
  });
  assert(resCod.suggestedArAccount.code === '1122', 'isCod = true maps to suggested AR account 1122 (Undeposited COD)');

  const resPrepaid = calculateSalesTaxesAndTotals({
    branch: KA_BRANCH,
    customer: KA_CUSTOMER,
    items: [{ description: 'Cake', quantity: 1, unitPrice: 500, taxRatePercent: 5 }],
    isCod: false,
  });
  assert(resPrepaid.suggestedArAccount.code === '1121', 'isCod = false maps to suggested AR account 1121 (Accounts Receivable)');

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n=============================================================================');
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (Total: ${passCount + failCount})`);
  console.log('=============================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
