/**
 * CakeToHome ERP — Sales Tax & Calculation Engine
 * Phase 4F Step 4.1: Deterministic Sales Tax, Discount, Delivery & Total Calculation
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Pure, deterministic, side-effect-free calculation engine.
 *    - Zero PostgreSQL mutations.
 *    - Zero accounting vouchers, journals, movements, AR, or receipts.
 * 2. Deterministic Place-of-Supply (POS) jurisdiction resolution:
 *    - Selling branch state vs Customer delivery destination state.
 *    - Intra-state (same state) -> CGST (50%) + SGST (50%).
 *    - Inter-state (different state) -> IGST (100%).
 *    - Fails closed on missing, invalid, or contradictory state data.
 * 3. Authoritative product tax classifications & rates:
 *    - Bakery / Cakes: 5.0%
 *    - Accessories: 18.0%
 *    - Toys / Novelties: 12.0%
 *    - Delivery Fee: 18.0% (or caller-specified authoritative rate)
 *    - Fails closed on missing or unsupported tax rate. Never defaults or guesses.
 * 4. Pro-rata header/coupon discount allocation:
 *    - Apportioned across eligible taxable lines based on net line value.
 *    - Exact paise residual preservation on the largest line item.
 *    - Sum of allocated discounts strictly equals total header discount.
 *    - Cannot cause any line to become negative.
 * 5. Full accounting metadata resolution:
 *    - Resolves Output GST liability accounts (2121-2129) and Revenue accounts (4110-4140).
 * 6. Exact integer paise precision and mathematical identity preservation:
 *    - sum(taxableValues) + sum(taxes) + delivery === invoiceTotal.
 */

import {
  GST_STATE_DIRECTORY,
  lookupGstState,
  round2,
  round4,
  type GstStateDefinition,
} from "./purchase-tax-engine";

// ─── 1. Types & Interfaces ───────────────────────────────────────────────────

export type SalesJurisdictionType = "INTRA_STATE" | "INTER_STATE";

export type SalesMerchandiseType = "CAKE" | "ACCESSORY" | "PACKAGING" | "TOY" | "CUSTOM";

export interface SalesBranchLocationInput {
  state?: string | null;
  stateCode?: string | null;
  cityName?: string | null;
  cityState?: string | null;
  gstin?: string | null;
}

export interface CustomerLocationInput {
  state?: string | null;
  stateCode?: string | null;
  pincode?: string | null;
  cityName?: string | null;
}

export interface SalesJurisdictionResult {
  jurisdiction: SalesJurisdictionType;
  branchState: GstStateDefinition;
  customerState: GstStateDefinition;
}

export interface SalesLineItemInput {
  id?: string;
  itemType?: SalesMerchandiseType;
  productId?: string | null;
  variantId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;         // Item-level line discount
  taxRatePercent: number;    // Authorized statutory GST rate (e.g. 5, 12, 18)
  hsnCode?: string | null;
}

export interface DeliveryFeeInput {
  amount: number;
  taxRatePercent?: number;   // Required if amount > 0, or must be explicitly 0 for exempt
  hsnCode?: string | null;   // e.g. "996813" for courier/transport
}

export interface SalesCalculationInput {
  branch: SalesBranchLocationInput;
  customer: CustomerLocationInput;
  items: SalesLineItemInput[];
  headerDiscount?: number;   // Cart-level / coupon discount
  delivery?: DeliveryFeeInput | number; // Delivery fee either object or scalar
  isCod?: boolean;           // True if payment method is Cash On Delivery (for AR mapping)
}

export interface SalesAccountingMetadata {
  revenueAccountCode: string;
  revenueAccountName: string;
  cgstAccountCode?: string;
  cgstAccountName?: string;
  sgstAccountCode?: string;
  sgstAccountName?: string;
  igstAccountCode?: string;
  igstAccountName?: string;
}

export interface CalculatedSalesLineItem {
  id?: string;
  itemType?: SalesMerchandiseType;
  productId: string | null;
  variantId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
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
  hsnCode: string | null;
  accountingMetadata: SalesAccountingMetadata;
}

export interface CalculatedDeliveryFee {
  amount: number;
  taxRatePercent: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
  hsnCode: string | null;
  accountingMetadata: SalesAccountingMetadata;
}

export interface SalesCalculationResult {
  jurisdiction: SalesJurisdictionResult;
  lines: CalculatedSalesLineItem[];
  delivery: CalculatedDeliveryFee | null;
  subtotal: number;                // Sum of gross lines
  lineDiscounts: number;           // Sum of item discounts
  headerDiscount: number;          // Order header discount
  totalDiscount: number;           // lineDiscounts + headerDiscount
  taxableValue: number;            // Total net merchandise base for GST
  deliveryTaxable: number;         // Net delivery base for GST
  totalTaxable: number;            // taxableValue + deliveryTaxable
  merchandiseCgst: number;
  merchandiseSgst: number;
  merchandiseIgst: number;
  merchandiseTax: number;
  deliveryCgst: number;
  deliverySgst: number;
  deliveryIgst: number;
  deliveryTax: number;
  cgst: number;                    // Total Central GST
  sgst: number;                    // Total State GST
  igst: number;                    // Total Integrated GST
  totalTax: number;                // cgst + sgst + igst
  deliveryTotal: number;           // Base delivery + delivery tax
  invoiceTotal: number;            // Total payable by customer
  suggestedArAccount: {
    code: string;                  // "1121" (AR) or "1122" (Undeposited COD)
    name: string;
  };
}

// ─── 2. Error Model ──────────────────────────────────────────────────────────

export class SalesTaxEngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SalesTaxEngineError";
    this.code = code;
  }
}

// ─── 3. Authorized Statutory Tax Rates & Accounts ─────────────────────────────

const VALID_GST_RATES = new Set<number>([0, 5, 12, 18, 28]);

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Resolves canonical CoA Output GST and Revenue accounts from merchandise type and GST rate.
 */
export function resolveSalesAccountingMetadata(
  itemType: SalesMerchandiseType | undefined,
  taxRatePercent: number,
  jurisdiction: SalesJurisdictionType
): SalesAccountingMetadata {
  let revenueAccountCode = "4110";
  let revenueAccountName = "Cake & Bakery Sales Revenue (5% GST)";

  // Determine Revenue Account
  if (itemType === "ACCESSORY" || itemType === "TOY") {
    revenueAccountCode = "4120";
    revenueAccountName = "Accessory & Merchandise Sales Revenue (18% GST)";
  } else if (itemType === "CAKE" || itemType === "PACKAGING" || !itemType) {
    if (taxRatePercent === 18) {
      revenueAccountCode = "4120";
      revenueAccountName = "Accessory & Merchandise Sales Revenue (18% GST)";
    } else {
      revenueAccountCode = "4110";
      revenueAccountName = "Cake & Bakery Sales Revenue (5% GST)";
    }
  }

  let cgstAccountCode: string | undefined;
  let cgstAccountName: string | undefined;
  let sgstAccountCode: string | undefined;
  let sgstAccountName: string | undefined;
  let igstAccountCode: string | undefined;
  let igstAccountName: string | undefined;

  if (taxRatePercent > 0) {
    if (taxRatePercent === 5) {
      if (jurisdiction === "INTRA_STATE") {
        cgstAccountCode = "2121";
        cgstAccountName = "Output CGST 2.5% (Food/Bakery)";
        sgstAccountCode = "2122";
        sgstAccountName = "Output SGST 2.5% (Food/Bakery)";
      } else {
        igstAccountCode = "2125";
        igstAccountName = "Output IGST 5.0% (Interstate Food)";
      }
    } else if (taxRatePercent === 18) {
      if (jurisdiction === "INTRA_STATE") {
        cgstAccountCode = "2123";
        cgstAccountName = "Output CGST 9.0% (Accessories)";
        sgstAccountCode = "2124";
        sgstAccountName = "Output SGST 9.0% (Accessories)";
      } else {
        igstAccountCode = "2126";
        igstAccountName = "Output IGST 18.0% (Interstate Accessories)";
      }
    } else if (taxRatePercent === 12) {
      if (jurisdiction === "INTRA_STATE") {
        cgstAccountCode = "2127";
        cgstAccountName = "Output CGST 6.0% (Toys)";
        sgstAccountCode = "2128";
        sgstAccountName = "Output SGST 6.0% (Toys)";
      } else {
        igstAccountCode = "2129";
        igstAccountName = "Output IGST 12.0% (Interstate Toys)";
      }
    } else {
      // General fallbacks for 28% or other authorized rates
      if (jurisdiction === "INTRA_STATE") {
        cgstAccountCode = "2123";
        cgstAccountName = `Output CGST ${(taxRatePercent / 2).toFixed(1)}%`;
        sgstAccountCode = "2124";
        sgstAccountName = `Output SGST ${(taxRatePercent / 2).toFixed(1)}%`;
      } else {
        igstAccountCode = "2126";
        igstAccountName = `Output IGST ${taxRatePercent.toFixed(1)}%`;
      }
    }
  }

  return {
    revenueAccountCode,
    revenueAccountName,
    cgstAccountCode,
    cgstAccountName,
    sgstAccountCode,
    sgstAccountName,
    igstAccountCode,
    igstAccountName,
  };
}

// ─── 4. Deterministic Jurisdiction Resolution ────────────────────────────────

/**
 * Resolves the GST jurisdiction between the selling branch and customer delivery location.
 * Fails closed if state information is missing or unrecognized.
 */
export function resolveSalesTaxJurisdiction(
  branch: SalesBranchLocationInput,
  customer: CustomerLocationInput
): SalesJurisdictionResult {
  // 1. Resolve Selling Branch State (Mandatory)
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

  // Branch GSTIN verification if provided
  if (branch.gstin) {
    const rawGstin = branch.gstin.trim().toUpperCase();
    if (GSTIN_REGEX.test(rawGstin)) {
      const gstinState = lookupGstState(rawGstin.substring(0, 2));
      if (!gstinState) {
        throw new SalesTaxEngineError(
          "TAX_JURISDICTION_UNRESOLVED",
          `Branch GSTIN '${rawGstin}' has an invalid or unrecognized 2-digit state prefix.`
        );
      }
      if (branchState && branchState.code !== gstinState.code) {
        throw new SalesTaxEngineError(
          "TAX_JURISDICTION_CONFLICT",
          `Branch location conflict: GSTIN prefix indicates '${gstinState.name}' (${gstinState.code}), but branch state field indicates '${branchState.name}' (${branchState.code}).`
        );
      }
      if (!branchState) {
        branchState = gstinState;
      }
    }
  }

  if (!branchState) {
    throw new SalesTaxEngineError(
      "TAX_JURISDICTION_UNRESOLVED",
      `Cannot resolve selling branch tax jurisdiction: branch state is missing or invalid (state: '${branch.state}', stateCode: '${branch.stateCode}').`
    );
  }

  // 2. Resolve Customer Delivery State (Mandatory)
  let customerState: GstStateDefinition | null = null;
  if (customer.stateCode) {
    customerState = lookupGstState(customer.stateCode);
  }
  if (!customerState && customer.state) {
    customerState = lookupGstState(customer.state);
  }

  if (!customerState) {
    throw new SalesTaxEngineError(
      "TAX_JURISDICTION_UNRESOLVED",
      `Cannot resolve customer tax jurisdiction: customer delivery state is missing or invalid (state: '${customer.state}', stateCode: '${customer.stateCode}').`
    );
  }

  // 3. Determine Jurisdiction Type
  const jurisdiction: SalesJurisdictionType =
    branchState.code === customerState.code ? "INTRA_STATE" : "INTER_STATE";

  return {
    jurisdiction,
    branchState,
    customerState,
  };
}

// ─── 5. Core Sales Tax Calculation Engine ────────────────────────────────────

/**
 * Pure calculation engine for customer sales orders and invoices.
 * Produces deterministic, reconciled line items, exact header discount allocation,
 * delivery fee taxation, and general ledger metadata.
 */
export function calculateSalesTaxesAndTotals(
  input: SalesCalculationInput
): SalesCalculationResult {
  if (!input.items || input.items.length === 0) {
    throw new SalesTaxEngineError("EMPTY_ITEMS", "Sales calculation requires at least one line item.");
  }

  // 1. Resolve Jurisdiction
  const jurisdictionResult = resolveSalesTaxJurisdiction(input.branch, input.customer);
  const jurisdiction = jurisdictionResult.jurisdiction;

  // 2. Validate Header Discount
  const rawHeaderDiscount = Number(input.headerDiscount || 0);
  if (rawHeaderDiscount < 0) {
    throw new SalesTaxEngineError("INVALID_DISCOUNT", "Header discount cannot be negative.");
  }
  const headerDiscount = round2(rawHeaderDiscount);

  // 3. Validate and Calculate Gross and Item-Level Net Values
  let totalGross = 0;
  let totalLineDiscount = 0;

  interface PreLine {
    item: SalesLineItemInput;
    grossValue: number;
    lineDiscount: number;
    netLineValue: number;
  }

  const preLines: PreLine[] = input.items.map((item, idx) => {
    if (typeof item.quantity !== "number" || item.quantity <= 0 || !Number.isFinite(item.quantity)) {
      throw new SalesTaxEngineError("INVALID_QUANTITY", `Line ${idx + 1}: Quantity must be greater than 0 (got ${item.quantity}).`);
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0 || !Number.isFinite(item.unitPrice)) {
      throw new SalesTaxEngineError("INVALID_RATE", `Line ${idx + 1}: Unit price cannot be negative (got ${item.unitPrice}).`);
    }
    if (item.taxRatePercent === null || item.taxRatePercent === undefined || typeof item.taxRatePercent !== "number" || Number.isNaN(item.taxRatePercent)) {
      throw new SalesTaxEngineError("MISSING_TAX_RATE", `Line ${idx + 1}: Tax rate is required and cannot be empty.`);
    }
    if (!VALID_GST_RATES.has(item.taxRatePercent)) {
      throw new SalesTaxEngineError(
        "UNSUPPORTED_TAX_RATE",
        `Line ${idx + 1}: Tax rate ${item.taxRatePercent}% is not a valid statutory GST rate (supported: 0, 5, 12, 18, 28).`
      );
    }

    const itemDiscount = round2(Number(item.discount || 0));
    if (itemDiscount < 0) {
      throw new SalesTaxEngineError("INVALID_LINE_DISCOUNT", `Line ${idx + 1}: Line discount cannot be negative.`);
    }

    const grossValue = round2(item.quantity * item.unitPrice);
    if (itemDiscount > grossValue) {
      throw new SalesTaxEngineError(
        "LINE_DISCOUNT_EXCEEDS_GROSS",
        `Line ${idx + 1}: Line discount (${itemDiscount}) exceeds gross line value (${grossValue}).`
      );
    }

    const netLineValue = round2(grossValue - itemDiscount);

    totalGross = round2(totalGross + grossValue);
    totalLineDiscount = round2(totalLineDiscount + itemDiscount);

    return {
      item,
      grossValue,
      lineDiscount: itemDiscount,
      netLineValue,
    };
  });

  const sumNetLineValues = round2(preLines.reduce((acc, p) => acc + p.netLineValue, 0));

  // 4. Header Discount Allocation (Pro-rata with deterministic residual allocation)
  if (headerDiscount > sumNetLineValues) {
    throw new SalesTaxEngineError(
      "DISCOUNT_EXCEEDS_TAXABLE_BASE",
      `Header discount (${headerDiscount}) exceeds total net merchandise taxable value (${sumNetLineValues}).`
    );
  }

  const allocatedHeaderDiscounts: number[] = new Array(preLines.length).fill(0);

  if (headerDiscount > 0) {
    if (sumNetLineValues === 0) {
      throw new SalesTaxEngineError(
        "ZERO_VALUE_LINES_CANNOT_ALLOCATE_DISCOUNT",
        "Cannot allocate header discount across line items with zero net value."
      );
    }

    let runningAllocated = 0;
    // Find index of the line item with the largest net value to absorb residual variance safely
    let maxNetIdx = 0;
    let maxNetVal = preLines[0].netLineValue;

    for (let i = 0; i < preLines.length; i++) {
      if (preLines[i].netLineValue > maxNetVal) {
        maxNetVal = preLines[i].netLineValue;
        maxNetIdx = i;
      }
    }

    for (let i = 0; i < preLines.length; i++) {
      if (i !== maxNetIdx) {
        const share = round2(headerDiscount * (preLines[i].netLineValue / sumNetLineValues));
        allocatedHeaderDiscounts[i] = share;
        runningAllocated = round2(runningAllocated + share);
      }
    }

    // Residual allocated to the largest line item to guarantee zero negative taxable values
    allocatedHeaderDiscounts[maxNetIdx] = round2(headerDiscount - runningAllocated);
  }

  // 5. Line-Level Taxable Values & Taxes
  const taxableValues = preLines.map((p, i) => round2(p.netLineValue - allocatedHeaderDiscounts[i]));
  const totalTaxableValue = round2(taxableValues.reduce((acc, v) => acc + v, 0));

  let merchandiseCgst = 0;
  let merchandiseSgst = 0;
  let merchandiseIgst = 0;

  const finalLines: CalculatedSalesLineItem[] = preLines.map((p, i) => {
    const taxRate = p.item.taxRatePercent;
    const taxableValue = taxableValues[i];

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (jurisdiction === "INTRA_STATE") {
      cgstRate = round2(taxRate / 2);
      sgstRate = round2(taxRate / 2);
      cgstAmount = round2(taxableValue * (cgstRate / 100));
      sgstAmount = round2(taxableValue * (sgstRate / 100));
    } else {
      igstRate = round2(taxRate);
      igstAmount = round2(taxableValue * (igstRate / 100));
    }

    const totalTax = round2(cgstAmount + sgstAmount + igstAmount);
    const lineTotal = round2(taxableValue + totalTax);

    merchandiseCgst = round2(merchandiseCgst + cgstAmount);
    merchandiseSgst = round2(merchandiseSgst + sgstAmount);
    merchandiseIgst = round2(merchandiseIgst + igstAmount);

    const accountingMetadata = resolveSalesAccountingMetadata(
      p.item.itemType,
      taxRate,
      jurisdiction
    );

    return {
      id: p.item.id,
      itemType: p.item.itemType,
      productId: p.item.productId || null,
      variantId: p.item.variantId || null,
      description: p.item.description,
      quantity: p.item.quantity,
      unitPrice: p.item.unitPrice,
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
      hsnCode: p.item.hsnCode || null,
      accountingMetadata,
    };
  });

  const merchandiseTax = round2(merchandiseCgst + merchandiseSgst + merchandiseIgst);

  // 6. Delivery Fee Calculation (Fail-Closed on Missing Tax Rate)
  let calculatedDelivery: CalculatedDeliveryFee | null = null;
  let deliveryTaxable = 0;
  let deliveryCgst = 0;
  let deliverySgst = 0;
  let deliveryIgst = 0;
  let deliveryTax = 0;
  let deliveryTotal = 0;

  if (input.delivery !== undefined && input.delivery !== null) {
    let rawAmount = 0;
    let delTaxRate: number | undefined;
    let delHsn: string | null = "996813";

    if (typeof input.delivery === "number") {
      rawAmount = input.delivery;
      if (rawAmount > 0) {
        // Must fail closed if tax rate is missing when delivery charge > 0
        throw new SalesTaxEngineError(
          "MISSING_DELIVERY_TAX_RATE",
          "Delivery fee amount was provided without authoritative tax rate specification. Fail-closed."
        );
      }
      delTaxRate = 0;
    } else if (typeof input.delivery === "object") {
      rawAmount = Number(input.delivery.amount || 0);
      if (rawAmount > 0) {
        if (input.delivery.taxRatePercent === undefined || input.delivery.taxRatePercent === null) {
          throw new SalesTaxEngineError(
            "MISSING_DELIVERY_TAX_RATE",
            "Delivery fee is greater than zero but delivery taxRatePercent was not provided. Fail-closed."
          );
        }
        delTaxRate = Number(input.delivery.taxRatePercent);
      } else {
        delTaxRate = input.delivery.taxRatePercent !== undefined ? Number(input.delivery.taxRatePercent) : 0;
      }
      delHsn = input.delivery.hsnCode || "996813";
    }

    if (rawAmount < 0) {
      throw new SalesTaxEngineError("INVALID_DELIVERY_FEE", "Delivery fee amount cannot be negative.");
    }

    if (delTaxRate !== undefined && !VALID_GST_RATES.has(delTaxRate)) {
      throw new SalesTaxEngineError(
        "UNSUPPORTED_TAX_RATE",
        `Delivery tax rate ${delTaxRate}% is not a valid statutory GST rate.`
      );
    }

    deliveryTaxable = round2(rawAmount);

    if (deliveryTaxable > 0 && delTaxRate && delTaxRate > 0) {
      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;

      if (jurisdiction === "INTRA_STATE") {
        cgstRate = round2(delTaxRate / 2);
        sgstRate = round2(delTaxRate / 2);
        deliveryCgst = round2(deliveryTaxable * (cgstRate / 100));
        deliverySgst = round2(deliveryTaxable * (sgstRate / 100));
      } else {
        igstRate = round2(delTaxRate);
        deliveryIgst = round2(deliveryTaxable * (igstRate / 100));
      }

      deliveryTax = round2(deliveryCgst + deliverySgst + deliveryIgst);
      deliveryTotal = round2(deliveryTaxable + deliveryTax);

      const delAccountingMetadata: SalesAccountingMetadata = {
        revenueAccountCode: "4130",
        revenueAccountName: "Delivery & Shipping Charges Collected",
        cgstAccountCode: jurisdiction === "INTRA_STATE" ? "2123" : undefined,
        cgstAccountName: jurisdiction === "INTRA_STATE" ? "Output CGST 9.0% (Accessories/Services)" : undefined,
        sgstAccountCode: jurisdiction === "INTRA_STATE" ? "2124" : undefined,
        sgstAccountName: jurisdiction === "INTRA_STATE" ? "Output SGST 9.0% (Accessories/Services)" : undefined,
        igstAccountCode: jurisdiction === "INTER_STATE" ? "2126" : undefined,
        igstAccountName: jurisdiction === "INTER_STATE" ? "Output IGST 18.0% (Interstate Services)" : undefined,
      };

      calculatedDelivery = {
        amount: deliveryTaxable,
        taxRatePercent: delTaxRate,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount: deliveryCgst,
        sgstAmount: deliverySgst,
        igstAmount: deliveryIgst,
        totalTax: deliveryTax,
        totalAmount: deliveryTotal,
        hsnCode: delHsn,
        accountingMetadata: delAccountingMetadata,
      };
    } else if (deliveryTaxable > 0) {
      // 0% delivery fee
      deliveryTotal = deliveryTaxable;
      calculatedDelivery = {
        amount: deliveryTaxable,
        taxRatePercent: 0,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        totalAmount: deliveryTotal,
        hsnCode: delHsn,
        accountingMetadata: {
          revenueAccountCode: "4130",
          revenueAccountName: "Delivery & Shipping Charges Collected",
        },
      };
    }
  }

  // 7. Aggregate Financial Totals
  const totalCgst = round2(merchandiseCgst + deliveryCgst);
  const totalSgst = round2(merchandiseSgst + deliverySgst);
  const totalIgst = round2(merchandiseIgst + deliveryIgst);
  const totalTax = round2(totalCgst + totalSgst + totalIgst);
  const totalDiscount = round2(totalLineDiscount + headerDiscount);
  const totalTaxable = round2(totalTaxableValue + deliveryTaxable);
  const invoiceTotal = round2(totalTaxable + totalTax);

  // 8. Mandatory Mathematical Invariant Validations
  const checkSubtotalMinusDiscount = round2(totalGross - totalDiscount);
  if (Math.abs(checkSubtotalMinusDiscount - totalTaxableValue) > 0.01) {
    throw new SalesTaxEngineError(
      "DISCOUNT_CALCULATION_DRIFT",
      `Gross (${totalGross}) minus Total Discount (${totalDiscount}) = ${checkSubtotalMinusDiscount}, but taxable base is ${totalTaxableValue}. Variance > 0.01.`
    );
  }

  if (jurisdiction === "INTRA_STATE") {
    if (totalIgst !== 0) {
      throw new SalesTaxEngineError("ILLEGAL_IGST_ON_INTRASTATE", "Intra-state sales cannot have non-zero IGST.");
    }
    if (Math.abs(totalCgst - totalSgst) > 0.01) {
      throw new SalesTaxEngineError("CGST_SGST_ASYMMETRY", `CGST (${totalCgst}) must equal SGST (${totalSgst}) within 0.01.`);
    }
  } else {
    if (totalCgst !== 0 || totalSgst !== 0) {
      throw new SalesTaxEngineError("ILLEGAL_CGST_SGST_ON_INTERSTATE", "Inter-state sales cannot have non-zero CGST or SGST.");
    }
  }

  const suggestedArAccount = input.isCod
    ? { code: "1122", name: "Undeposited COD" }
    : { code: "1121", name: "Accounts Receivable" };

  return {
    jurisdiction: jurisdictionResult,
    lines: finalLines,
    delivery: calculatedDelivery,
    subtotal: totalGross,
    lineDiscounts: totalLineDiscount,
    headerDiscount,
    totalDiscount,
    taxableValue: totalTaxableValue,
    deliveryTaxable,
    totalTaxable,
    merchandiseCgst,
    merchandiseSgst,
    merchandiseIgst,
    merchandiseTax,
    deliveryCgst,
    deliverySgst,
    deliveryIgst,
    deliveryTax,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    totalTax,
    deliveryTotal,
    invoiceTotal,
    suggestedArAccount,
  };
}
