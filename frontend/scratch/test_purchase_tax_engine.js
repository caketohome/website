/**
 * CakeToHome ERP — Phase 4F Step 3D.1 Tax & Calculation Engine Test Suite
 *
 * Verifies all locked invariants:
 * 1. Deterministic GST jurisdiction resolution (Intra, Inter, Unregistered, Conflict, Missing)
 * 2. Deterministic header discount pro-rata with penny residual reconciliation
 * 3. Freight policy handling (INVENTORY_CAPITALIZED vs OPERATING_EXPENSE)
 * 4. Recoverable GST exclusion from inventory lot cost
 * 5. Inventory eligibility (product_id + variant_id requirement)
 * 6. Mathematical integrity: Subtotal - Discount === Taxable Value
 */

const fs = require('fs');
const path = require('path');

async function runTestSuite() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3D.1 Purchase Tax Engine Test Suite');
  console.log('=============================================================================\n');

  // Register native typescript compiler hook for .ts imports
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
    resolveTaxJurisdiction,
    calculatePurchaseTaxesAndTotals,
    lookupGstState,
    TaxEngineError
  } = require('../src/lib/services/purchase-tax-engine');

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

  // ─── 1. GST State Directory & Lookup ─────────────────────────────────────────
  console.log('[Test Group 1] GST State Directory & Lookup...');
  const ka = lookupGstState('29');
  assert(ka && ka.code === '29' && ka.alphaCode === 'KA' && ka.name === 'Karnataka', 'Lookup by 2-digit code 29 -> Karnataka');

  const mh = lookupGstState('MH');
  assert(mh && mh.code === '27' && mh.name === 'Maharashtra', 'Lookup by alpha code MH -> Maharashtra');

  const kl = lookupGstState('Kerala');
  assert(kl && kl.code === '32' && kl.alphaCode === 'KL', 'Lookup by state name Kerala -> code 32');

  const invalidLookup = lookupGstState('XX_NON_EXISTENT');
  assert(invalidLookup === null, 'Lookup of non-existent state returns null');

  // ─── 2. Deterministic Jurisdiction Resolution ────────────────────────────────
  console.log('\n[Test Group 2] GST Jurisdiction Resolution...');

  // Intra-State: Karnataka supplier (29...) to Karnataka branch
  const intra = resolveTaxJurisdiction(
    { gstin: '29AABCC1234D1Z5', state: 'Karnataka' },
    { state: 'Karnataka', stateCode: 'KA' }
  );
  assert(intra.jurisdiction === 'INTRA_STATE', 'Same state -> INTRA_STATE');
  assert(intra.supplierState.code === '29', 'Supplier state resolved to code 29');
  assert(intra.branchState.code === '29', 'Branch state resolved to code 29');

  // Inter-State: Maharashtra supplier (27...) to Karnataka branch
  const inter = resolveTaxJurisdiction(
    { gstin: '27AABCC1234D1Z5', state: 'Maharashtra' },
    { state: 'Karnataka', stateCode: 'KA' }
  );
  assert(inter.jurisdiction === 'INTER_STATE', 'Different states (MH -> KA) -> INTER_STATE');

  // Unregistered Supplier
  const unreg = resolveTaxJurisdiction(
    { gstin: null, state: 'Karnataka' },
    { state: 'Karnataka', stateCode: 'KA' }
  );
  assert(unreg.jurisdiction === 'UNREGISTERED', 'Supplier without GSTIN -> UNREGISTERED');

  // Conflicting Supplier State (GSTIN prefix 29 vs state declared as Maharashtra)
  let conflictErr = null;
  try {
    resolveTaxJurisdiction(
      { gstin: '29AABCC1234D1Z5', state: 'Maharashtra' },
      { state: 'Karnataka', stateCode: 'KA' }
    );
  } catch (e) {
    conflictErr = e;
  }
  assert(conflictErr && conflictErr.code === 'TAX_JURISDICTION_CONFLICT', 'Conflicting supplier GSTIN vs declared state FAILS CLOSED');

  // Missing Branch State
  let missingBranchErr = null;
  try {
    resolveTaxJurisdiction(
      { gstin: '29AABCC1234D1Z5', state: 'Karnataka' },
      { state: null, stateCode: null, cityState: null }
    );
  } catch (e) {
    missingBranchErr = e;
  }
  assert(missingBranchErr && missingBranchErr.code === 'TAX_JURISDICTION_UNRESOLVED', 'Missing branch jurisdiction FAILS CLOSED');

  // ─── 3. Intra-State Purchase Tax Calculation (CGST + SGST) ───────────────────
  console.log('\n[Test Group 3] Intra-State Purchase Tax Calculation...');
  const intraCalc = calculatePurchaseTaxesAndTotals({
    supplier: { gstin: '29AABCC1234D1Z5', state: 'Karnataka' },
    branch: { state: 'Karnataka', stateCode: 'KA' },
    items: [
      {
        itemType: 'CAKE',
        productId: 'prod_cake_01',
        variantId: 'var_cake_01',
        description: 'Chocolate Truffle Cake',
        quantity: 10,
        rate: 500, // gross: 5,000
        discount: 200, // net: 4,800
        taxRatePercent: 18,
      },
      {
        itemType: 'ACCESSORY',
        productId: 'prod_acc_01',
        variantId: 'var_acc_01',
        description: 'Sparkler Candles',
        quantity: 50,
        rate: 20, // gross: 1,000
        discount: 0, // net: 1,000
        taxRatePercent: 12,
      },
    ],
  });

  assert(intraCalc.jurisdiction.jurisdiction === 'INTRA_STATE', 'Jurisdiction is INTRA_STATE');
  assert(intraCalc.subtotal === 6000, `Subtotal is 6,000 (got ${intraCalc.subtotal})`);
  assert(intraCalc.lineDiscounts === 200, `Line discounts = 200 (got ${intraCalc.lineDiscounts})`);
  assert(intraCalc.taxableValue === 5800, `Taxable value = 5,800 (got ${intraCalc.taxableValue})`);

  // Line 1: 4,800 @ 18% -> 9% CGST (432) + 9% SGST (432)
  const line1 = intraCalc.lines[0];
  assert(line1.cgstRate === 9 && line1.sgstRate === 9 && line1.igstRate === 0, 'Line 1 tax rates: 9% CGST + 9% SGST, 0% IGST');
  assert(line1.cgstAmount === 432 && line1.sgstAmount === 432 && line1.igstAmount === 0, 'Line 1 tax amounts: 432 CGST + 432 SGST');
  assert(line1.lineTotal === 5664, `Line 1 total = 5,664 (got ${line1.lineTotal})`);
  assert(line1.inventoryLotTotalCost === 4800, `Line 1 inventory lot total cost excludes tax: 4,800 (got ${line1.inventoryLotTotalCost})`);
  assert(line1.inventoryLotUnitCost === 480, `Line 1 unit cost = 480 (got ${line1.inventoryLotUnitCost})`);

  // Line 2: 1,000 @ 12% -> 6% CGST (60) + 6% SGST (60)
  const line2 = intraCalc.lines[1];
  assert(line2.cgstRate === 6 && line2.sgstRate === 6 && line2.igstRate === 0, 'Line 2 tax rates: 6% CGST + 6% SGST');
  assert(line2.cgstAmount === 60 && line2.sgstAmount === 60, 'Line 2 tax amounts: 60 CGST + 60 SGST');

  assert(intraCalc.cgst === 492, `Total CGST = 492 (got ${intraCalc.cgst})`);
  assert(intraCalc.sgst === 492, `Total SGST = 492 (got ${intraCalc.sgst})`);
  assert(intraCalc.igst === 0, `Total IGST = 0 (got ${intraCalc.igst})`);
  assert(intraCalc.invoiceTotal === 6784, `Invoice total = 6,784 (got ${intraCalc.invoiceTotal})`);

  // ─── 4. Inter-State Purchase Tax Calculation (IGST) ──────────────────────────
  console.log('\n[Test Group 4] Inter-State Purchase Tax Calculation (IGST)...');
  const interCalc = calculatePurchaseTaxesAndTotals({
    supplier: { gstin: '27AABCC1234D1Z5', state: 'Maharashtra' },
    branch: { state: 'Karnataka', stateCode: 'KA' },
    items: [
      {
        itemType: 'PACKAGING',
        productId: 'prod_pkg_01',
        variantId: 'var_pkg_01',
        description: 'Eco Cake Boxes',
        quantity: 100,
        rate: 25, // gross: 2,500
        discount: 0,
        taxRatePercent: 18,
      },
    ],
  });

  assert(interCalc.jurisdiction.jurisdiction === 'INTER_STATE', 'Jurisdiction is INTER_STATE');
  assert(interCalc.lines[0].cgstRate === 0 && interCalc.lines[0].sgstRate === 0 && interCalc.lines[0].igstRate === 18, 'Tax rates: 0% CGST/SGST, 18% IGST');
  assert(interCalc.lines[0].cgstAmount === 0 && interCalc.lines[0].igstAmount === 450, 'Tax amounts: 450 IGST');
  assert(interCalc.cgst === 0 && interCalc.sgst === 0 && interCalc.igst === 450, 'Header taxes: 450 IGST, 0 CGST/SGST');
  assert(interCalc.invoiceTotal === 2950, `Invoice total = 2,950 (got ${interCalc.invoiceTotal})`);

  // ─── 5. Unregistered Supplier (0 Tax) ────────────────────────────────────────
  console.log('\n[Test Group 5] Unregistered Supplier (URD)...');
  const urdCalc = calculatePurchaseTaxesAndTotals({
    supplier: { gstin: null, state: 'Karnataka' },
    branch: { state: 'Karnataka', stateCode: 'KA' },
    items: [
      {
        itemType: 'CAKE',
        productId: 'prod_cake_02',
        variantId: 'var_cake_02',
        description: 'Local Artisan Cake',
        quantity: 5,
        rate: 600,
        taxRatePercent: 18,
      },
    ],
  });
  assert(urdCalc.jurisdiction.jurisdiction === 'UNREGISTERED', 'Jurisdiction is UNREGISTERED');
  assert(urdCalc.totalTax === 0 && urdCalc.invoiceTotal === 3000, '0 tax computed for unregistered supplier');

  // ─── 6. Deterministic Header Discount Allocation & Cent Residual ─────────────
  console.log('\n[Test Group 6] Deterministic Header Discount Allocation & Cent Residual...');
  const discountCalc = calculatePurchaseTaxesAndTotals({
    supplier: { gstin: '29AABCC1234D1Z5' },
    branch: { stateCode: 'KA' },
    headerDiscount: 100.00,
    items: [
      {
        itemType: 'CAKE',
        productId: 'prod_01',
        variantId: 'var_01',
        description: 'Item 1',
        quantity: 10,
        rate: 100, // net: 1,000 (1/6 = 16.666...%)
        taxRatePercent: 18,
      },
      {
        itemType: 'CAKE',
        productId: 'prod_02',
        variantId: 'var_02',
        description: 'Item 2',
        quantity: 20,
        rate: 100, // net: 2,000 (2/6 = 33.333...%)
        taxRatePercent: 18,
      },
      {
        itemType: 'CAKE',
        productId: 'prod_03',
        variantId: 'var_03',
        description: 'Item 3',
        quantity: 30,
        rate: 100, // net: 3,000 (3/6 = 50.000...%)
        taxRatePercent: 18,
      },
    ],
  });

  const d1 = discountCalc.lines[0].allocatedHeaderDiscount;
  const d2 = discountCalc.lines[1].allocatedHeaderDiscount;
  const d3 = discountCalc.lines[2].allocatedHeaderDiscount;

  assert(d1 === 16.67, `Line 1 allocated header discount = 16.67 (got ${d1})`);
  assert(d2 === 33.33, `Line 2 allocated header discount = 33.33 (got ${d2})`);
  assert(d3 === 50.00, `Line 3 allocated header discount with residual = 50.00 (got ${d3})`);
  assert(d1 + d2 + d3 === 100.00, `Sum of allocated header discounts exactly equals 100.00 (${d1 + d2 + d3})`);

  assert(discountCalc.subtotal === 6000, 'Subtotal is 6,000');
  assert(discountCalc.totalDiscount === 100, 'Total discount is 100');
  assert(discountCalc.taxableValue === 5900, 'Taxable value is 5,900');
  assert(discountCalc.subtotal - discountCalc.totalDiscount === discountCalc.taxableValue, 'Reconciled: subtotal - discount === taxableValue');

  // ─── 7. Freight Treatment Policies ───────────────────────────────────────────
  console.log('\n[Test Group 7] Freight Treatment Policies...');

  // Policy 1: INVENTORY_CAPITALIZED
  const capFreightCalc = calculatePurchaseTaxesAndTotals({
    supplier: { gstin: '29AABCC1234D1Z5' },
    branch: { stateCode: 'KA' },
    freightAmount: 300.00,
    freightPolicy: 'INVENTORY_CAPITALIZED',
    isFreightBilledOnInvoice: true,
    items: [
      {
        itemType: 'CAKE',
        productId: 'prod_cake_01',
        variantId: 'var_cake_01',
        description: 'Catalog Cake Line',
        quantity: 10,
        rate: 200, // taxable: 2,000 (2/3 of eligible)
        taxRatePercent: 18,
      },
      {
        itemType: 'ACCESSORY',
        productId: 'prod_acc_01',
        variantId: 'var_acc_01',
        description: 'Catalog Accessory Line',
        quantity: 20,
        rate: 50, // taxable: 1,000 (1/3 of eligible)
        taxRatePercent: 18,
      },
      {
        itemType: 'CAKE',
        productId: null, // Service / non-catalog line
        variantId: null,
        description: 'Kitchen Delivery Surcharge Service',
        quantity: 1,
        rate: 500, // taxable: 500
        taxRatePercent: 18,
      },
    ],
  });

  const fLine1 = capFreightCalc.lines[0];
  const fLine2 = capFreightCalc.lines[1];
  const fLine3 = capFreightCalc.lines[2];

  assert(fLine1.isInventoryEligible === true, 'Line 1 is inventory eligible');
  assert(fLine2.isInventoryEligible === true, 'Line 2 is inventory eligible');
  assert(fLine3.isInventoryEligible === false, 'Line 3 is NOT inventory eligible (product_id = null)');

  assert(fLine1.allocatedFreight === 200.00, `Line 1 allocated freight = 200.00 (got ${fLine1.allocatedFreight})`);
  assert(fLine2.allocatedFreight === 100.00, `Line 2 allocated freight = 100.00 (got ${fLine2.allocatedFreight})`);
  assert(fLine3.allocatedFreight === 0, `Line 3 service allocated freight = 0 (got ${fLine3.allocatedFreight})`);

  // Check inventory lot valuation includes freight but excludes GST
  assert(fLine1.inventoryLotTotalCost === 2200.00, `Line 1 inventory lot cost = 2,200 (taxable 2000 + freight 200) (got ${fLine1.inventoryLotTotalCost})`);
  assert(fLine1.inventoryLotUnitCost === 220.00, `Line 1 unit cost = 220.00 (got ${fLine1.inventoryLotUnitCost})`);
  assert(fLine3.inventoryLotTotalCost === null, 'Line 3 has null inventory lot cost (non-catalog)');

  assert(capFreightCalc.allocatedFreightToInventory === 300.00, '300.00 freight capitalized into inventory');
  assert(capFreightCalc.freightExpenseAmount === 0, '0 freight to operating expense');

  // Policy 2: OPERATING_EXPENSE
  const expFreightCalc = calculatePurchaseTaxesAndTotals({
    supplier: { gstin: '29AABCC1234D1Z5' },
    branch: { stateCode: 'KA' },
    freightAmount: 300.00,
    freightPolicy: 'OPERATING_EXPENSE',
    isFreightBilledOnInvoice: true,
    items: [
      {
        itemType: 'CAKE',
        productId: 'prod_cake_01',
        variantId: 'var_cake_01',
        description: 'Catalog Cake Line',
        quantity: 10,
        rate: 200,
        taxRatePercent: 18,
      },
    ],
  });

  assert(expFreightCalc.lines[0].allocatedFreight === 0, 'Operating expense freight NOT allocated to inventory');
  assert(expFreightCalc.lines[0].inventoryLotTotalCost === 2000.00, 'Lot cost equals pure taxable value: 2,000');
  assert(expFreightCalc.freightExpenseAmount === 300.00, '300.00 freight directed to Account 5240 Operating Expense');

  // ─── 8. Validation Rejections ────────────────────────────────────────────────
  console.log('\n[Test Group 8] Validation & Edge Case Rejections...');

  // Discount exceeds net value
  let discExceedErr = null;
  try {
    calculatePurchaseTaxesAndTotals({
      supplier: { gstin: '29AABCC1234D1Z5' },
      branch: { stateCode: 'KA' },
      headerDiscount: 5000,
      items: [{ itemType: 'CAKE', description: 'Box', quantity: 1, rate: 100, taxRatePercent: 18 }],
    });
  } catch (e) {
    discExceedErr = e;
  }
  assert(discExceedErr && discExceedErr.code === 'DISCOUNT_EXCEEDS_TAXABLE_BASE', 'Header discount exceeding taxable base is rejected');

  // Negative rate
  let negRateErr = null;
  try {
    calculatePurchaseTaxesAndTotals({
      supplier: { gstin: '29AABCC1234D1Z5' },
      branch: { stateCode: 'KA' },
      items: [{ itemType: 'CAKE', description: 'Box', quantity: 1, rate: -50, taxRatePercent: 18 }],
    });
  } catch (e) {
    negRateErr = e;
  }
  assert(negRateErr && negRateErr.code === 'INVALID_RATE', 'Negative rate rejected');

  // Empty items
  let emptyErr = null;
  try {
    calculatePurchaseTaxesAndTotals({
      supplier: { gstin: '29AABCC1234D1Z5' },
      branch: { stateCode: 'KA' },
      items: [],
    });
  } catch (e) {
    emptyErr = e;
  }
  assert(emptyErr && emptyErr.code === 'EMPTY_ITEMS', 'Empty items list rejected');

  console.log('\n=============================================================================');
  console.log(`TEST SUITE SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite();
