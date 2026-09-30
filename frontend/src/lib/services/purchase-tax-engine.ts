/**
 * CakeToHome ERP — Purchase Tax & Calculation Engine
 * Phase 4F Step 3D.1: Deterministic Tax, Discount, Freight & Total Calculation
 *
 * LOCKED INVARIANTS:
 * 1. Deterministic GST jurisdiction resolution:
 *    - Valid GSTIN 2-digit state code > normalized supplier state fallback.
 *    - Destination branch state derived from city/state metadata.
 *    - Intra-state (same state) -> CGST (50%) + SGST (50%).
 *    - Inter-state (different state) -> IGST (100%).
 *    - Unregistered supplier -> 0 tax (no ITC).
 *    - Missing or conflicting jurisdiction FAILS CLOSED (TaxEngineError).
 * 2. Deterministic header discount allocation:
 *    - Apportioned pro-rata based on net line value (gross - line discount).
 *    - Residual rounding adjustments applied to final line item to reconcile to the cent.
 *    - Reconciles: sum(taxable_value) === subtotal - total_discount.
 * 3. Explicit freight treatment policy:
 *    - 'INVENTORY_CAPITALIZED': Allocated pro-rata across catalog merchandise lines only.
 *    - 'OPERATING_EXPENSE': Tracked for GL Account 5240, excluded from inventory valuation.
 *    - 'NONE': Zero freight.
 * 4. Recoverable GST is strictly excluded from inventory cost.
 * 5. Inventory eligibility:
 *    - Line items with product_id AND variant_id -> is_inventory_eligible = true.
 *    - Lines with product_id = null -> is_inventory_eligible = false (service/expense).
 * 6. Pure, deterministic, zero-mutation, zero-floating-point-drift engine.
 */

// ─── 1. Canonical Indian GST State Code Directory ─────────────────────────────

export interface GstStateDefinition {
  code: string;       // 2-digit GST state code (e.g. "29")
  alphaCode: string;  // 2-letter alpha code (e.g. "KA")
  name: string;       // Standard state name (e.g. "Karnataka")
}

export const GST_STATE_DIRECTORY: GstStateDefinition[] = [
  { code: "01", alphaCode: "JK", name: "Jammu and Kashmir" },
  { code: "02", alphaCode: "HP", name: "Himachal Pradesh" },
  { code: "03", alphaCode: "PB", name: "Punjab" },
  { code: "04", alphaCode: "CH", name: "Chandigarh" },
  { code: "05", alphaCode: "UK", name: "Uttarakhand" },
  { code: "06", alphaCode: "HR", name: "Haryana" },
  { code: "07", alphaCode: "DL", name: "Delhi" },
  { code: "08", alphaCode: "RJ", name: "Rajasthan" },
  { code: "09", alphaCode: "UP", name: "Uttar Pradesh" },
  { code: "10", alphaCode: "BR", name: "Bihar" },
  { code: "11", alphaCode: "SK", name: "Sikkim" },
  { code: "12", alphaCode: "AR", name: "Arunachal Pradesh" },
  { code: "13", alphaCode: "NL", name: "Nagaland" },
  { code: "14", alphaCode: "MN", name: "Manipur" },
  { code: "15", alphaCode: "MZ", name: "Mizoram" },
  { code: "16", alphaCode: "TR", name: "Tripura" },
  { code: "17", alphaCode: "ML", name: "Meghalaya" },
  { code: "18", alphaCode: "AS", name: "Assam" },
  { code: "19", alphaCode: "WB", name: "West Bengal" },
  { code: "20", alphaCode: "JH", name: "Jharkhand" },
  { code: "21", alphaCode: "OR", name: "Odisha" },
  { code: "22", alphaCode: "CT", name: "Chhattisgarh" },
  { code: "23", alphaCode: "MP", name: "Madhya Pradesh" },
  { code: "24", alphaCode: "GJ", name: "Gujarat" },
  { code: "26", alphaCode: "DD", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", alphaCode: "MH", name: "Maharashtra" },
  { code: "28", alphaCode: "AP", name: "Andhra Pradesh (Old)" },
  { code: "29", alphaCode: "KA", name: "Karnataka" },
  { code: "30", alphaCode: "GA", name: "Goa" },
  { code: "31", alphaCode: "LD", name: "Lakshadweep" },
  { code: "32", alphaCode: "KL", name: "Kerala" },
  { code: "33", alphaCode: "TN", name: "Tamil Nadu" },
  { code: "34", alphaCode: "PY", name: "Puducherry" },
  { code: "35", alphaCode: "AN", name: "Andaman and Nicobar Islands" },
  { code: "36", alphaCode: "TS", name: "Telangana" },
  { code: "37", alphaCode: "AD", name: "Andhra Pradesh" },
  { code: "38", alphaCode: "LA", name: "Ladakh" },
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function normalizeStateName(state: string | null | undefined): string {
  if (!state) return "";
  return state.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolves a state definition from either a 2-digit code, alpha code, or state name.
 */
export function lookupGstState(query: string | null | undefined): GstStateDefinition | null {
  if (!query) return null;
  const q = query.trim().toUpperCase();
  const qNorm = normalizeStateName(query);

  // Exact 2-digit code lookup
  const byCode = GST_STATE_DIRECTORY.find((s) => s.code === q);
  if (byCode) return byCode;

  // Exact 2-letter alpha code lookup
  const byAlpha = GST_STATE_DIRECTORY.find((s) => s.alphaCode === q);
  if (byAlpha) return byAlpha;

  // Normalized name lookup
  const byName = GST_STATE_DIRECTORY.find((s) => normalizeStateName(s.name) === qNorm);
  if (byName) return byName;

  return null;
}

// ─── 2. Types & Error Models ──────────────────────────────────────────────────

export type TaxJurisdictionType = "INTRA_STATE" | "INTER_STATE" | "UNREGISTERED";

export type FreightPolicy = "INVENTORY_CAPITALIZED" | "OPERATING_EXPENSE" | "NONE";

export interface SupplierLocationInput {
  gstin?: string | null;
  state?: string | null;
}

export interface BranchLocationInput {
  state?: string | null;
  stateCode?: string | null;
  cityName?: string | null;
  cityState?: string | null;
}

export interface JurisdictionResolutionResult {
  jurisdiction: TaxJurisdictionType;
  supplierState: GstStateDefinition | null;
  branchState: GstStateDefinition;
  isRegisteredSupplier: boolean;
}

export interface PurchaseLineItemInput {
  id?: string;
  itemType: "CAKE" | "ACCESSORY" | "PACKAGING";
  productId?: string | null;
  variantId?: string | null;
  description: string;
  quantity: number;
  rate: number;
  discount?: number;     // Item-level trade discount
  taxRatePercent: number; // e.g. 18 for 18%
  hsnCode?: string | null;
}

export interface PurchaseCalculationInput {
  supplier: SupplierLocationInput;
  branch: BranchLocationInput;
  items: PurchaseLineItemInput[];
  headerDiscount?: number;  // Invoice-level discount (trade discount)
  freightAmount?: number;   // Freight/cartage amount
  freightPolicy?: FreightPolicy;
  isFreightBilledOnInvoice?: boolean; // True if vendor bills freight on this invoice
}

export interface CalculatedLineItem {
  id?: string;
  itemType: "CAKE" | "ACCESSORY" | "PACKAGING";
  productId: string | null;
  variantId: string | null;
  description: string;
  quantity: number;
  rate: number;
  grossValue: number;
  lineDiscount: number;
  netLineValue: number;
  allocatedHeaderDiscount: number;
  taxableValue: number;
  taxRatePercent: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  lineTotal: number;
  isInventoryEligible: boolean;
  allocatedFreight: number;
  inventoryLotUnitCost: number | null;  // Cost basis for inventory lot (ex-tax)
  inventoryLotTotalCost: number | null; // Total lot cost (taxable + allocated freight)
  hsnCode: string | null;
}

export interface PurchaseCalculationResult {
  jurisdiction: JurisdictionResolutionResult;
  freightPolicy: FreightPolicy;
  lines: CalculatedLineItem[];
  subtotal: number;         // Sum of gross lines
  lineDiscounts: number;    // Sum of item discounts
  headerDiscount: number;   // Invoice header discount
  totalDiscount: number;    // lineDiscounts + headerDiscount
  taxableValue: number;     // Total net base for GST
  cgst: number;             // Total Central GST
  sgst: number;             // Total State GST
  igst: number;             // Total Integrated GST
  totalTax: number;         // cgst + sgst + igst
  freightAmount: number;    // Freight amount
  allocatedFreightToInventory: number; // Amount capitalized into inventory
  freightExpenseAmount: number;        // Amount to 5240 Operating Expense
  invoiceTotal: number;     // Net payable to vendor
  eligibleInventoryTotalCost: number;  // Total value debited to 113x
}

export class TaxEngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TaxEngineError";
    this.code = code;
  }
}

// ─── 3. Deterministic Jurisdiction Resolution ────────────────────────────────

/**
 * Resolves the GST jurisdiction deterministically between supplier and receiving branch.
 * Fails closed if jurisdiction cannot be determined or if there is conflicting state data.
 */
export function resolveTaxJurisdiction(
  supplier: SupplierLocationInput,
  branch: BranchLocationInput
): JurisdictionResolutionResult {
  // 1. Resolve Branch State (Mandatory)
  let branchState: GstStateDefinition | null = null;
  if (branch.stateCode) {
    branchState = lookupGstState(branch.stateCode);
  }
  if (!branchState && branch.state) {
    branchState = lookupGstState(branch.state);
  }
  if (!branchState && branch.cityState) {
    branchState = lookupGstState(branch.cityState);
  }

  if (!branchState) {
    throw new TaxEngineError(
      "TAX_JURISDICTION_UNRESOLVED",
      `Cannot resolve receiving branch tax jurisdiction: branch state data is missing or invalid (state: '${branch.state}', stateCode: '${branch.stateCode}', cityState: '${branch.cityState}').`
    );
  }

  // 2. Check Supplier Registration
  const rawGstin = supplier.gstin ? supplier.gstin.trim().toUpperCase() : null;
  const isRegisteredSupplier = Boolean(rawGstin && GSTIN_REGEX.test(rawGstin));

  let supplierState: GstStateDefinition | null = null;

  if (isRegisteredSupplier && rawGstin) {
    const gstinPrefix = rawGstin.substring(0, 2);
    supplierState = lookupGstState(gstinPrefix);
    if (!supplierState) {
      throw new TaxEngineError(
        "TAX_JURISDICTION_UNRESOLVED",
        `Supplier GSTIN '${rawGstin}' has an invalid or unrecognized 2-digit state prefix '${gstinPrefix}'.`
      );
    }

    // Verify consistency if supplier.state was also provided
    if (supplier.state) {
      const explicitState = lookupGstState(supplier.state);
      if (explicitState && explicitState.code !== supplierState.code) {
        throw new TaxEngineError(
          "TAX_JURISDICTION_CONFLICT",
          `Supplier location conflict: GSTIN prefix indicates '${supplierState.name}' (${supplierState.code}), but supplier state field indicates '${explicitState.name}' (${explicitState.code}).`
        );
      }
    }
  } else if (supplier.state) {
    // Unregistered supplier with declared state fallback
    supplierState = lookupGstState(supplier.state);
  }

  // 3. Determine Jurisdiction Type
  let jurisdiction: TaxJurisdictionType;
  if (!isRegisteredSupplier) {
    jurisdiction = "UNREGISTERED";
  } else if (supplierState && supplierState.code === branchState.code) {
    jurisdiction = "INTRA_STATE";
  } else {
    jurisdiction = "INTER_STATE";
  }

  return {
    jurisdiction,
    supplierState,
    branchState,
    isRegisteredSupplier,
  };
}

// ─── 4. Rounding & Utility Helpers ────────────────────────────────────────────

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function round4(num: number): number {
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
}

// ─── 5. Core Purchase Calculation Engine ──────────────────────────────────────

/**
 * Pure calculation engine for purchase invoices.
 * Produces 100% reconciled line items, exact header discount distribution,
 * deterministic freight allocation, and verified accounting totals.
 */
export function calculatePurchaseTaxesAndTotals(
  input: PurchaseCalculationInput
): PurchaseCalculationResult {
  if (!input.items || input.items.length === 0) {
    throw new TaxEngineError("EMPTY_ITEMS", "Purchase calculation requires at least one line item.");
  }

  const jurisdictionResult = resolveTaxJurisdiction(input.supplier, input.branch);
  const freightPolicy: FreightPolicy = input.freightPolicy || "NONE";
  const rawFreight = Number(input.freightAmount || 0);
  if (rawFreight < 0) {
    throw new TaxEngineError("INVALID_FREIGHT", "Freight amount cannot be negative.");
  }
  const freightAmount = round2(rawFreight);

  const rawHeaderDiscount = Number(input.headerDiscount || 0);
  if (rawHeaderDiscount < 0) {
    throw new TaxEngineError("INVALID_DISCOUNT", "Header discount cannot be negative.");
  }
  const headerDiscount = round2(rawHeaderDiscount);

  // Step A: Calculate Gross and Item-Level Net Values
  let totalGross = 0;
  let totalLineDiscount = 0;

  interface PreLine {
    item: PurchaseLineItemInput;
    grossValue: number;
    lineDiscount: number;
    netLineValue: number;
    isInventoryEligible: boolean;
  }

  const preLines: PreLine[] = input.items.map((item, idx) => {
    if (item.quantity <= 0) {
      throw new TaxEngineError("INVALID_QUANTITY", `Line ${idx + 1}: Quantity must be greater than 0 (got ${item.quantity}).`);
    }
    if (item.rate < 0) {
      throw new TaxEngineError("INVALID_RATE", `Line ${idx + 1}: Rate cannot be negative (got ${item.rate}).`);
    }
    const itemDiscount = round2(Number(item.discount || 0));
    if (itemDiscount < 0) {
      throw new TaxEngineError("INVALID_LINE_DISCOUNT", `Line ${idx + 1}: Item discount cannot be negative.`);
    }

    const grossValue = round2(item.quantity * item.rate);
    if (itemDiscount > grossValue) {
      throw new TaxEngineError(
        "LINE_DISCOUNT_EXCEEDS_GROSS",
        `Line ${idx + 1}: Item discount (${itemDiscount}) exceeds gross line value (${grossValue}).`
      );
    }
    const netLineValue = round2(grossValue - itemDiscount);

    totalGross = round2(totalGross + grossValue);
    totalLineDiscount = round2(totalLineDiscount + itemDiscount);

    // Inventory eligibility: catalog merchandise requires both product_id and variant_id
    const isInventoryEligible = Boolean(
      (item.itemType === "CAKE" || item.itemType === "ACCESSORY" || item.itemType === "PACKAGING") &&
      item.productId &&
      item.productId.trim() &&
      item.variantId &&
      item.variantId.trim()
    );

    return {
      item,
      grossValue,
      lineDiscount: itemDiscount,
      netLineValue,
      isInventoryEligible,
    };
  });

  const sumNetLineValues = round2(preLines.reduce((acc, p) => acc + p.netLineValue, 0));

  // Step B: Header Discount Allocation (Pro-rata with final-line residual adjustment)
  if (headerDiscount > sumNetLineValues) {
    throw new TaxEngineError(
      "DISCOUNT_EXCEEDS_TAXABLE_BASE",
      `Header discount (${headerDiscount}) exceeds total net taxable line value (${sumNetLineValues}).`
    );
  }

  const allocatedHeaderDiscounts: number[] = new Array(preLines.length).fill(0);

  if (headerDiscount > 0) {
    if (sumNetLineValues === 0) {
      throw new TaxEngineError(
        "ZERO_VALUE_LINES_CANNOT_ALLOCATE_DISCOUNT",
        "Cannot allocate header discount across line items with zero net value."
      );
    }

    let runningAllocated = 0;
    for (let i = 0; i < preLines.length - 1; i++) {
      const share = round2(headerDiscount * (preLines[i].netLineValue / sumNetLineValues));
      allocatedHeaderDiscounts[i] = share;
      runningAllocated = round2(runningAllocated + share);
    }
    // Final line residual adjustment to guarantee exact penny reconciliation
    const finalIndex = preLines.length - 1;
    allocatedHeaderDiscounts[finalIndex] = round2(headerDiscount - runningAllocated);
  }

  // Calculate final line-level taxable values
  const taxableValues: number[] = preLines.map((p, i) => {
    return round2(p.netLineValue - allocatedHeaderDiscounts[i]);
  });

  const totalTaxableValue = round2(taxableValues.reduce((acc, val) => acc + val, 0));

  // Step C: Freight Allocation (If INVENTORY_CAPITALIZED)
  const allocatedFreights: number[] = new Array(preLines.length).fill(0);
  let allocatedFreightToInventory = 0;
  let freightExpenseAmount = 0;

  if (freightAmount > 0) {
    if (freightPolicy === "INVENTORY_CAPITALIZED") {
      const eligibleIndices = preLines
        .map((p, idx) => (p.isInventoryEligible ? idx : -1))
        .filter((idx) => idx !== -1);

      if (eligibleIndices.length === 0) {
        throw new TaxEngineError(
          "FREIGHT_CAPITALIZATION_NO_ELIGIBLE_LINES",
          "Freight policy is set to 'INVENTORY_CAPITALIZED', but invoice has 0 eligible catalog merchandise lines."
        );
      }

      const eligibleTaxableSum = round2(
        eligibleIndices.reduce((acc, idx) => acc + taxableValues[idx], 0)
      );

      if (eligibleTaxableSum === 0) {
        throw new TaxEngineError(
          "ZERO_TAXABLE_VALUE_FREIGHT_ALLOCATION",
          "Cannot allocate freight across eligible inventory items with zero taxable value."
        );
      }

      let runningFreight = 0;
      for (let j = 0; j < eligibleIndices.length - 1; j++) {
        const lineIdx = eligibleIndices[j];
        const share = round2(freightAmount * (taxableValues[lineIdx] / eligibleTaxableSum));
        allocatedFreights[lineIdx] = share;
        runningFreight = round2(runningFreight + share);
      }
      // Final eligible line absorbs residual cent variance
      const lastEligibleIdx = eligibleIndices[eligibleIndices.length - 1];
      allocatedFreights[lastEligibleIdx] = round2(freightAmount - runningFreight);

      allocatedFreightToInventory = freightAmount;
    } else if (freightPolicy === "OPERATING_EXPENSE") {
      freightExpenseAmount = freightAmount;
    }
  }

  // Step D: Calculate GST Taxes and Line Totals
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalEligibleInventoryCost = 0;

  const finalLines: CalculatedLineItem[] = preLines.map((p, i) => {
    const taxRate = p.item.taxRatePercent || 0;
    const taxableValue = taxableValues[i];

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (jurisdictionResult.jurisdiction === "INTRA_STATE") {
      cgstRate = round2(taxRate / 2);
      sgstRate = round2(taxRate / 2);
      cgstAmount = round2(taxableValue * (cgstRate / 100));
      sgstAmount = round2(taxableValue * (sgstRate / 100));
    } else if (jurisdictionResult.jurisdiction === "INTER_STATE") {
      igstRate = round2(taxRate);
      igstAmount = round2(taxableValue * (igstRate / 100));
    }
    // UNREGISTERED -> 0 tax

    const totalTax = round2(cgstAmount + sgstAmount + igstAmount);
    const lineTotal = round2(taxableValue + totalTax);

    totalCgst = round2(totalCgst + cgstAmount);
    totalSgst = round2(totalSgst + sgstAmount);
    totalIgst = round2(totalIgst + igstAmount);

    // Inventory lot valuation (ex-tax: taxable_value + allocated freight)
    let inventoryLotUnitCost: number | null = null;
    let inventoryLotTotalCost: number | null = null;

    if (p.isInventoryEligible) {
      const lineAllocatedFreight = allocatedFreights[i];
      inventoryLotTotalCost = round2(taxableValue + lineAllocatedFreight);
      inventoryLotUnitCost = round4(inventoryLotTotalCost / p.item.quantity);
      totalEligibleInventoryCost = round2(totalEligibleInventoryCost + inventoryLotTotalCost);
    }

    return {
      id: p.item.id,
      itemType: p.item.itemType,
      productId: p.item.productId || null,
      variantId: p.item.variantId || null,
      description: p.item.description,
      quantity: p.item.quantity,
      rate: p.item.rate,
      grossValue: p.grossValue,
      lineDiscount: p.lineDiscount,
      netLineValue: p.netLineValue,
      allocatedHeaderDiscount: allocatedHeaderDiscounts[i],
      taxableValue,
      taxRatePercent: taxRate,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      lineTotal,
      isInventoryEligible: p.isInventoryEligible,
      allocatedFreight: allocatedFreights[i],
      inventoryLotUnitCost,
      inventoryLotTotalCost,
      hsnCode: p.item.hsnCode || null,
    };
  });

  const totalTax = round2(totalCgst + totalSgst + totalIgst);
  const totalDiscount = round2(totalLineDiscount + headerDiscount);

  // If vendor bills freight on the invoice, it is included in the invoice payable total
  const isFreightOnInvoice = Boolean(input.isFreightBilledOnInvoice && freightAmount > 0);
  const invoiceTotal = round2(totalTaxableValue + totalTax + (isFreightOnInvoice ? freightAmount : 0));

  // Step E: Mandatory Integrity Reconciliations
  const checkSubtotalMinusDiscount = round2(totalGross - totalDiscount);
  if (checkSubtotalMinusDiscount !== totalTaxableValue) {
    throw new TaxEngineError(
      "DISCOUNT_RECONCILIATION_MISMATCH",
      `Internal math error: Gross (${totalGross}) - Discount (${totalDiscount}) = ${checkSubtotalMinusDiscount}, but Taxable Value = ${totalTaxableValue}.`
    );
  }

  const sumAllocatedHeader = round2(
    finalLines.reduce((acc, l) => acc + l.allocatedHeaderDiscount, 0)
  );
  if (sumAllocatedHeader !== headerDiscount) {
    throw new TaxEngineError(
      "HEADER_DISCOUNT_RESIDUAL_MISMATCH",
      `Internal math error: Sum of allocated header discounts (${sumAllocatedHeader}) does not equal header discount (${headerDiscount}).`
    );
  }

  if (freightPolicy === "INVENTORY_CAPITALIZED" && freightAmount > 0) {
    const sumAllocatedFreight = round2(
      finalLines.reduce((acc, l) => acc + l.allocatedFreight, 0)
    );
    if (sumAllocatedFreight !== freightAmount) {
      throw new TaxEngineError(
        "FREIGHT_RESIDUAL_MISMATCH",
        `Internal math error: Sum of allocated freight (${sumAllocatedFreight}) does not equal freight amount (${freightAmount}).`
      );
    }
  }

  return {
    jurisdiction: jurisdictionResult,
    freightPolicy,
    lines: finalLines,
    subtotal: totalGross,
    lineDiscounts: totalLineDiscount,
    headerDiscount,
    totalDiscount,
    taxableValue: totalTaxableValue,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    totalTax,
    freightAmount,
    allocatedFreightToInventory,
    freightExpenseAmount,
    invoiceTotal,
    eligibleInventoryTotalCost: totalEligibleInventoryCost,
  };
}
