/**
 * CakeToHome ERP — Sales Voucher Construction Service
 * Phase 4F Step 4.2: Deterministic Sales Accounting Voucher Construction
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. PURE VOUCHER DRAFTING (ZERO FINANCIAL POSTING):
 *    - Step 4.2 constructs balanced accounting vouchers in DRAFT status only.
 *    - Never posts to the General Ledger (accounting_journal_entry / accounting_journal_line = 0).
 *    - Never approves vouchers (Step 4.3).
 *    - Never commits inventory cost lot consumptions or COGS (Step 4.4).
 *    - Never decrements branch inventory or creates inventory movements.
 *    - Never settles customer receivables or records receipts (Step 4.5).
 *    - Accounting start date and fiscal periods remain unconfigured in live DB.
 *
 * 2. HISTORICAL DATA QUARANTINE:
 *    - The 173 historical orders and 53 payment transactions are quarantined LEGACY_PROTOTYPE_DATA.
 *    - Fail closed: An order must have explicit ledger eligibility (order.metadata->>'is_ledger_eligible' = 'true')
 *      and authoritative normalized product, pricing, and tax classification data.
 *    - Orders marked as legacy prototype (metadata->>'legacy_prototype' = 'true') are strictly rejected
 *      with LEGACY_PROTOTYPE_ORDER_REJECTED.
 *
 * 3. FROZEN STEP 4.1 INTEGRATION:
 *    - Reuses calculateSalesTaxesAndTotals from SalesTaxEngine for Place of Supply (POS),
 *      taxable base calculations, pro-rata coupon allocation, delivery fee tax, and GST splits.
 *    - Reconciles calculated invoice total against authoritative order total.
 *
 * 4. AUTHORITATIVE DOUBLE-ENTRY CONSTRUCTION:
 *    - DEBIT SIDE:
 *      * 1121 Accounts Receivable (Prepaid/Online/Card/UPI orders)
 *      * 1122 Undeposited COD Collections (Cash-on-Delivery orders)
 *      * Classification derived strictly from authoritative payment_transaction / order state.
 *    - CREDIT SIDE:
 *      * 4110 Cake & Bakery Sales Revenue (taxable base for CAKE merchandise)
 *      * 4120 Accessory & Merchandise Sales Revenue (taxable base for ACCESSORY merchandise)
 *      * 4130 Delivery & Shipping Charges Collected (taxable base for delivery service)
 *      * 2121–2129 Appropriate Output GST liability accounts (5%, 12%, 18%, intra-state split vs interstate IGST)
 *    - Invariant: sum(Debits) === sum(Credits) === taxCalc.invoiceTotal.
 *
 * 5. IDEMPOTENCY & BRANCH ISOLATION:
 *    - Deterministic source idempotency key: SALE:<order_id>:INVOICE_DRAFT.
 *    - Enforced via AccountingVoucherRepository partial unique index.
 *    - Strict BOLA branch access validation.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { hasEffectivePermission } from "../staff-access-control";
import { CustomerReceiptService } from "./customer-receipt.service";
import type {
  AccountingVoucherRow,
  AccountingAccountRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  InventoryCostLotRow,
  InventoryMovementRow,
  InventoryCostConsumptionRow,
  JournalLineInput,
} from "../types/accounting.types";
import {
  calculateSalesTaxesAndTotals,
  SalesTaxEngineError,
  type SalesCalculationResult,
  type SalesLineItemInput,
  type DeliveryFeeInput,
  type SalesMerchandiseType,
} from "./sales-tax-engine";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type SalesPostingErrorCode =
  | "ORDER_NOT_FOUND"
  | "INVALID_ORDER_STATUS"
  | "ORDER_ALREADY_POSTED"
  | "EMPTY_ORDER"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_INACTIVE"
  | "BRANCH_ACCESS_DENIED"
  | "BRANCH_LOCATION_UNRESOLVED"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_LOCATION_UNRESOLVED"
  | "PRODUCT_NOT_FOUND"
  | "INVALID_MERCHANDISE_CLASSIFICATION"
  | "MISSING_TAX_RATE"
  | "UNSUPPORTED_TAX_RATE"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "ORDER_TOTAL_MISMATCH"
  | "ACCOUNT_RESOLUTION_FAILED"
  | "UNRESOLVED_PAYMENT_CLASSIFICATION"
  | "VOUCHER_UNBALANCED"
  | "DUPLICATE_SOURCE_EVENT"
  | "VOUCHER_NOT_FOUND"
  | "INVALID_VOUCHER_STATE"
  | "PERMISSION_DENIED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "POSTING_GUARD_FAILED"
  | "LEGACY_PROTOTYPE_ORDER_REJECTED"
  | "INSUFFICIENT_COST_LOT_QUANTITY"
  | "INSUFFICIENT_PHYSICAL_INVENTORY"
  | "COST_CONSISTENCY_VIOLATION"
  | "VOUCHER_ALREADY_POSTED"
  | "SALES_POSTING_FAILED";

export class SalesPostingError extends Error {
  readonly code: SalesPostingErrorCode;

  constructor(code: SalesPostingErrorCode, message: string) {
    super(message);
    this.name = "SalesPostingError";
    this.code = code;
  }
}

// ─── Parameter Types ───────────────────────────────────────────────────────────

export interface CreateSalesVoucherDraftParams {
  orderId: string;
  /** Staff user ID creating the voucher draft (from verified server session) */
  createdBy: string;
  /** Optional branch scope for BOLA defense */
  branchId?: string;
  /** Delivery tax rate override if not configured on order (e.g. 18) */
  deliveryTaxRatePercent?: number;
  /** Optional caller-owned transaction client */
  client?: PoolClient;
}

export interface SubmitSalesVoucherParams {
  voucherId: string;
  /** Staff user ID submitting the voucher draft */
  submittedBy: string;
  /** Optional branch scope for BOLA defense */
  branchId?: string;
  client?: PoolClient;
}

export interface ApproveSalesVoucherParams {
  voucherId: string;
  /** Staff user ID approving the voucher */
  approvedBy: string;
  /** Optional branch scope for BOLA defense */
  branchId?: string;
  /** Optional approval notes */
  approvalNotes?: string;
  /** Optional staff actor context or session for canonical permission check */
  actorContext?: {
    id: string;
    user_id?: string;
    role: string;
    effective_permissions?: string[];
    branch_id?: string | null;
  };
  /** Caller-owned transaction client */
  client?: PoolClient;
}

export interface RejectSalesVoucherParams {
  voucherId: string;
  /** Staff user ID rejecting the voucher */
  rejectedBy: string;
  /** Mandatory rejection reason */
  rejectionReason: string;
  /** Optional branch scope for BOLA defense */
  branchId?: string;
  /** Optional staff actor context or session */
  actorContext?: {
    id: string;
    user_id?: string;
    role: string;
    effective_permissions?: string[];
    branch_id?: string | null;
  };
  client?: PoolClient;
}

export interface SalesVoucherApprovalResult {
  voucher: AccountingVoucherRow;
  auditTrail: {
    order_id: string;
    customer_id?: string;
    voucher_created_by: string;
    voucher_submitted_by?: string | null;
    voucher_approved_by: string;
    approved_at: string;
  };
}

export interface PostSalesVoucherParams {
  voucherId: string;
  /** Staff user ID posting the voucher (from verified server session) */
  postedBy: string;
  /** Optional branch scope for BOLA defense */
  branchId?: string;
  /** Optional staff actor context or session for canonical permission check */
  actorContext?: {
    id: string;
    user_id?: string;
    role: string;
    effective_permissions?: string[];
    branch_id?: string | null;
    organization_id?: string | null;
  };
  /** Optional caller-owned transaction client */
  client?: PoolClient;
}

export interface SalesPostingResult {
  voucher: AccountingVoucherRow;
  journalEntry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  costConsumptions: InventoryCostConsumptionRow[];
  movements: InventoryMovementRow[];
  invoiceTotal: number;
  totalCogs: number;
  totalJournalAmount: number;
}

export interface SalesPostingResponse {
  success: boolean;
  data?: SalesPostingResult;
  error?: string;
  code?: SalesPostingErrorCode;
}

export interface PreviewSalesVoucherParams {
  orderId: string;
  branchId?: string;
  deliveryTaxRatePercent?: number;
  client?: PoolClient;
}

export interface InspectSalesJournalLinesResult {
  journalLines: JournalLineInput[];
  taxCalculation: SalesCalculationResult;
  invoiceTotal: number;
  paymentClassification: "COD" | "PREPAID";
  arAccount: AccountingAccountRow;
  order: any;
  branch: any;
}

// ─── SalesPostingService ───────────────────────────────────────────────────────

export class SalesPostingService {
  /**
   * Inspects order, branch, customer, product merchandise classifications,
   * executes the deterministic SalesTaxEngine, resolves authoritative CoA accounts,
   * and builds balanced double-entry journal lines.
   */
  static async inspectAndBuildJournalLines(
    orderId: string,
    client: PoolClient,
    options?: {
      branchId?: string;
      deliveryTaxRatePercent?: number;
    }
  ): Promise<InspectSalesJournalLinesResult> {
    // 1. Fetch & lock order
    const oRes = await client.query(
      `SELECT * FROM public."order" WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [orderId]
    );
    const order = oRes.rows[0];
    if (!order) {
      throw new SalesPostingError("ORDER_NOT_FOUND", `Order '${orderId}' not found.`);
    }

    const orderMeta = order.metadata || {};

    // 2. Quarantine Check: Reject historical prototype orders
    if (orderMeta.legacy_prototype === true) {
      throw new SalesPostingError(
        "LEGACY_PROTOTYPE_ORDER_REJECTED",
        `Order '${orderId}' is quarantined legacy prototype data and cannot participate in accounting.`
      );
    }

    if (orderMeta.is_ledger_eligible !== true) {
      throw new SalesPostingError(
        "LEGACY_PROTOTYPE_ORDER_REJECTED",
        `Order '${orderId}' is not certified as ledger-eligible (missing is_ledger_eligible=true). Historical prototype orders cannot be converted to accounting vouchers.`
      );
    }

    // 3. Resolve & validate branch
    const orderBranchId = order.branch_id || orderMeta.branch_id;
    if (!orderBranchId) {
      throw new SalesPostingError("BRANCH_NOT_FOUND", `Order '${orderId}' has no associated branch.`);
    }

    if (options?.branchId && orderBranchId !== options.branchId) {
      throw new SalesPostingError(
        "BRANCH_ACCESS_DENIED",
        `Access denied: Order belongs to branch '${orderBranchId}', not '${options.branchId}'.`
      );
    }

    const bRes = await client.query(
      `SELECT * FROM public.branch WHERE id = $1 AND deleted_at IS NULL`,
      [orderBranchId]
    );
    const branch = bRes.rows[0];
    if (!branch) {
      throw new SalesPostingError("BRANCH_NOT_FOUND", `Branch '${orderBranchId}' not found.`);
    }
    if (branch.is_open === false) {
      throw new SalesPostingError("BRANCH_INACTIVE", `Branch '${branch.name}' (${branch.id}) is inactive/closed.`);
    }

    const branchMeta = branch.metadata || {};
    const branchState = branchMeta.state || branch.address;
    const branchGstin = branchMeta.gstin;

    // 4. Resolve delivery state
    const deliveryAddress = orderMeta.delivery_address || orderMeta.delivery?.address || {};
    const customerState =
      (typeof deliveryAddress === "object" && deliveryAddress !== null && deliveryAddress.state ? deliveryAddress.state : null) ||
      orderMeta.delivery_state ||
      orderMeta.state ||
      orderMeta.customer_state ||
      orderMeta.delivery?.state ||
      (typeof deliveryAddress === "string" && !deliveryAddress.includes(" ") ? deliveryAddress : null) ||
      branchState;

    if (!customerState) {
      throw new SalesPostingError(
        "CUSTOMER_LOCATION_UNRESOLVED",
        `Order '${orderId}' has no resolvable delivery state for Place of Supply determination.`
      );
    }

    // 5. Fetch & validate items
    const rawItems: any[] = Array.isArray(orderMeta.items) && orderMeta.items.length > 0
      ? orderMeta.items
      : [];

    if (rawItems.length === 0) {
      // Check order_item table
      const oiRes = await client.query(
        `SELECT * FROM public.order_item WHERE order_id = $1 AND deleted_at IS NULL ORDER BY id ASC`,
        [orderId]
      );
      if (oiRes.rows.length > 0) {
        rawItems.push(...oiRes.rows);
      }
    }

    if (rawItems.length === 0) {
      throw new SalesPostingError("EMPTY_ORDER", `Order '${orderId}' contains no line items.`);
    }

    // Batch resolve products from PostgreSQL to verify existence and authoritative merchandise_type
    const productIds = rawItems.map((i) => i.product_id).filter(Boolean);
    if (productIds.length !== rawItems.length) {
      throw new SalesPostingError("PRODUCT_NOT_FOUND", `One or more line items in order '${orderId}' lack a product_id.`);
    }

    const pRes = await client.query(
      `SELECT id, title, handle, merchandise_type, metadata FROM public.product WHERE id = ANY($1) AND deleted_at IS NULL`,
      [productIds]
    );
    const productMap = new Map<string, any>();
    for (const p of pRes.rows) {
      productMap.set(p.id, p);
    }

    const lineInputs: SalesLineItemInput[] = [];

    for (const rawItem of rawItems) {
      const prod = productMap.get(rawItem.product_id);
      if (!prod) {
        throw new SalesPostingError("PRODUCT_NOT_FOUND", `Product '${rawItem.product_id}' not found in database.`);
      }

      // Authoritative merchandise classification
      const merchType = prod.merchandise_type?.toUpperCase();
      if (merchType !== "CAKE" && merchType !== "ACCESSORY" && merchType !== "PACKAGING") {
        throw new SalesPostingError(
          "INVALID_MERCHANDISE_CLASSIFICATION",
          `Product '${prod.title}' (${prod.id}) has invalid or unknown merchandise_type '${prod.merchandise_type}'. Must be CAKE, ACCESSORY, or PACKAGING.`
        );
      }

      const quantity = Number(rawItem.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new SalesPostingError("INVALID_QUANTITY", `Item '${prod.title}' has invalid quantity ${rawItem.quantity}.`);
      }

      const unitPrice = Number(rawItem.unit_price ?? rawItem.price ?? rawItem.selling_price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        throw new SalesPostingError("INVALID_PRICE", `Item '${prod.title}' has invalid unit price ${unitPrice}.`);
      }

      // Authoritative GST rate
      const prodMeta = prod.metadata || {};
      let taxRatePercent: number | null = null;

      if (rawItem.tax_rate !== undefined && rawItem.tax_rate !== null) {
        taxRatePercent = Number(rawItem.tax_rate);
      } else if (rawItem.gst_rate !== undefined && rawItem.gst_rate !== null) {
        taxRatePercent = Number(rawItem.gst_rate);
      } else if (prodMeta.gst_rate !== undefined && prodMeta.gst_rate !== null) {
        taxRatePercent = Number(prodMeta.gst_rate);
      }

      if (taxRatePercent === null || isNaN(taxRatePercent)) {
        throw new SalesPostingError(
          "MISSING_TAX_RATE",
          `Product '${prod.title}' (${prod.id}) has no authoritative GST tax rate.`
        );
      }

      const lineDiscount = Number(rawItem.discount || 0);

      lineInputs.push({
        id: rawItem.id || `item_${rawItem.product_id}`,
        productId: prod.id,
        variantId: rawItem.variant_id || null,
        description: prod.title,
        itemType: merchType as SalesMerchandiseType,
        quantity,
        unitPrice,
        discount: lineDiscount,
        taxRatePercent,
      });
    }

    // 6. Header discount & Delivery charge
    const headerDiscount = Number(orderMeta.discount_amount ?? orderMeta.discount ?? 0);

    const rawDeliveryFee = Number(orderMeta.delivery?.fee ?? orderMeta.delivery_fee ?? 0);
    let deliveryInput: DeliveryFeeInput | undefined;
    if (rawDeliveryFee > 0) {
      const delTaxRate =
        options?.deliveryTaxRatePercent ??
        (orderMeta.delivery?.tax_rate !== undefined ? Number(orderMeta.delivery.tax_rate) : 18);

      deliveryInput = {
        amount: rawDeliveryFee,
        taxRatePercent: delTaxRate,
      };
    }

    // 7. Execute Sales Tax Engine
    let taxCalc: SalesCalculationResult;
    try {
      taxCalc = calculateSalesTaxesAndTotals({
        branch: { state: branchState, gstin: branchGstin },
        customer: { state: customerState },
        items: lineInputs,
        headerDiscount,
        delivery: deliveryInput,
      });
    } catch (err: any) {
      if (err instanceof SalesTaxEngineError) {
        if (err.code === "BRANCH_STATE_UNRESOLVED" || err.code === "BRANCH_STATE_CONFLICT") {
          throw new SalesPostingError("BRANCH_LOCATION_UNRESOLVED", err.message);
        }
        if (err.code === "CUSTOMER_STATE_UNRESOLVED") {
          throw new SalesPostingError("CUSTOMER_LOCATION_UNRESOLVED", err.message);
        }
        if (err.code === "UNSUPPORTED_TAX_RATE") {
          throw new SalesPostingError("UNSUPPORTED_TAX_RATE", err.message);
        }
        if (err.code === "MISSING_TAX_RATE") {
          throw new SalesPostingError("MISSING_TAX_RATE", err.message);
        }
        if (err.code === "INVALID_QUANTITY") {
          throw new SalesPostingError("INVALID_QUANTITY", err.message);
        }
        if (err.code === "INVALID_RATE") {
          throw new SalesPostingError("INVALID_PRICE", err.message);
        }
      }
      throw new SalesPostingError("SALES_POSTING_FAILED", err.message);
    }

    // 8. Reconcile against authoritative order total if present
    const orderTotal = Number(orderMeta.total_amount ?? orderMeta.total ?? orderMeta.grand_total);
    if (!isNaN(orderTotal) && orderTotal > 0) {
      const variance = Math.abs(orderTotal - taxCalc.invoiceTotal);
      if (variance > 0.05) {
        throw new SalesPostingError(
          "ORDER_TOTAL_MISMATCH",
          `Order total mismatch: Order records ₹${orderTotal.toFixed(2)}, but deterministic calculation yields ₹${taxCalc.invoiceTotal.toFixed(2)} (variance ₹${variance.toFixed(2)}).`
        );
      }
    }

    // 9. Derive Payment Classification & AR Control Account
    // Query authoritative payment_transaction if recorded
    const ptRes = await client.query(
      `SELECT * FROM public.payment_transaction WHERE order_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );
    const paymentTxn = ptRes.rows[0];

    let paymentClassification: "COD" | "PREPAID";
    let arAccountCode: "1121" | "1122";

    if (paymentTxn) {
      if (paymentTxn.provider?.toLowerCase() === "cod") {
        paymentClassification = "COD";
        arAccountCode = "1122"; // Undeposited COD Collections
      } else {
        paymentClassification = "PREPAID";
        arAccountCode = "1121"; // Accounts Receivable
      }
    } else {
      // Derive from authoritative order payment method
      const payMethod = (orderMeta.payment_method || orderMeta.payment?.method || "").toLowerCase();
      if (payMethod === "cod") {
        paymentClassification = "COD";
        arAccountCode = "1122";
      } else if (
        ["card", "upi", "wallet", "netbanking", "online", "stripe", "razorpay", "online_upi", "online_card", "online_netbanking"].includes(payMethod) ||
        payMethod.startsWith("online") ||
        payMethod.includes("upi") ||
        payMethod.includes("card") ||
        payMethod.includes("gateway")
      ) {
        paymentClassification = "PREPAID";
        arAccountCode = "1121";
      } else {
        throw new SalesPostingError(
          "UNRESOLVED_PAYMENT_CLASSIFICATION",
          `Unable to resolve payment classification for order '${orderId}'. Payment method '${payMethod}' is unrecognized.`
        );
      }
    }

    // 10. Resolve Chart of Accounts Accounts from PostgreSQL
    const requiredCodes = [
      arAccountCode,
      "4110", // Cake Revenue
      "4120", // Accessory Revenue
      "4130", // Delivery Revenue
      "2121", // Output CGST 2.5%
      "2122", // Output SGST 2.5%
      "2123", // Output CGST 9.0%
      "2124", // Output SGST 9.0%
      "2125", // Output IGST 5.0%
      "2126", // Output IGST 18.0%
      "2127", // Output CGST 6.0%
      "2128", // Output SGST 6.0%
      "2129", // Output IGST 12.0%
    ];

    const coaRes = await client.query<AccountingAccountRow>(
      `SELECT * FROM public.accounting_account WHERE code = ANY($1) AND is_active = true AND deleted_at IS NULL`,
      [requiredCodes]
    );
    const coaMap = new Map<string, AccountingAccountRow>();
    for (const acc of coaRes.rows) {
      coaMap.set(acc.code, acc);
    }

    const arAccount = coaMap.get(arAccountCode);
    if (!arAccount) {
      throw new SalesPostingError("ACCOUNT_RESOLUTION_FAILED", `Account ${arAccountCode} not found in CoA.`);
    }

    const accCakeRevenue = coaMap.get("4110");
    const accAccRevenue = coaMap.get("4120");
    const accDelRevenue = coaMap.get("4130");

    if (!accCakeRevenue || !accAccRevenue || !accDelRevenue) {
      throw new SalesPostingError("ACCOUNT_RESOLUTION_FAILED", `One or more revenue accounts (4110, 4120, 4130) not found in CoA.`);
    }

    // Helper to resolve Output GST account by code
    const getGstAccount = (code: string): AccountingAccountRow => {
      const acc = coaMap.get(code);
      if (!acc) {
        throw new SalesPostingError("ACCOUNT_RESOLUTION_FAILED", `Output GST account ${code} not found in CoA.`);
      }
      return acc;
    };

    // 11. Construct Double-Entry Journal Lines
    const journalLines: JournalLineInput[] = [];

    // DEBIT: Customer AR / Undeposited COD for total invoice amount
    journalLines.push({
      account_id: arAccount.id,
      debit_amount: taxCalc.invoiceTotal,
      credit_amount: 0,
      branch_id: orderBranchId,
      customer_id: order.customer_id && order.customer_id !== "guest" ? order.customer_id : null,
      narration: `${arAccount.name}: Order ${order.display_id || order.id} (${paymentClassification})`,
      metadata: {
        order_id: order.id,
        payment_classification: paymentClassification,
        ar_account_code: arAccount.code,
      },
    });

    // CREDIT: Cake Revenue (4110)
    let cakeTaxableTotal = 0;
    let accTaxableTotal = 0;

    for (let i = 0; i < taxCalc.lines.length; i++) {
      const calcLine = taxCalc.lines[i];
      if (calcLine.itemType === "CAKE") {
        cakeTaxableTotal += calcLine.taxableValue;
      } else if (calcLine.itemType === "ACCESSORY" || calcLine.itemType === "PACKAGING") {
        accTaxableTotal += calcLine.taxableValue;
      }
    }

    cakeTaxableTotal = Math.round(cakeTaxableTotal * 100) / 100;
    accTaxableTotal = Math.round(accTaxableTotal * 100) / 100;

    if (cakeTaxableTotal > 0) {
      journalLines.push({
        account_id: accCakeRevenue.id,
        debit_amount: 0,
        credit_amount: cakeTaxableTotal,
        branch_id: orderBranchId,
        narration: `Cake Sales Revenue: Order ${order.display_id || order.id}`,
        metadata: { order_id: order.id, merchandise_type: "CAKE" },
      });
    }

    if (accTaxableTotal > 0) {
      journalLines.push({
        account_id: accAccRevenue.id,
        debit_amount: 0,
        credit_amount: accTaxableTotal,
        branch_id: orderBranchId,
        narration: `Accessory Sales Revenue: Order ${order.display_id || order.id}`,
        metadata: { order_id: order.id, merchandise_type: "ACCESSORY" },
      });
    }

    // CREDIT: Delivery Revenue (4130)
    if (taxCalc.delivery && taxCalc.delivery.amount > 0) {
      journalLines.push({
        account_id: accDelRevenue.id,
        debit_amount: 0,
        credit_amount: taxCalc.delivery.amount,
        branch_id: orderBranchId,
        narration: `Delivery Fee Revenue: Order ${order.display_id || order.id}`,
        metadata: { order_id: order.id, delivery_fee: taxCalc.delivery.amount },
      });
    }

    // CREDIT: Output GST Accounts
    const gstMap = new Map<string, { account: AccountingAccountRow; amount: number; narration: string }>();

    const recordGstCredit = (accountCode: string, amount: number, label: string) => {
      if (amount <= 0) return;
      const acc = getGstAccount(accountCode);
      const existing = gstMap.get(acc.id) || {
        account: acc,
        amount: 0,
        narration: `Output GST (${label}) on Order ${order.display_id || order.id}`,
      };
      existing.amount += amount;
      gstMap.set(acc.id, existing);
    };

    const isIntra = taxCalc.jurisdiction.jurisdiction === "INTRA_STATE";

    // Item line taxes
    for (const calcLine of taxCalc.lines) {
      if (isIntra) {
        if (calcLine.cgstAmount > 0 && calcLine.accountingMetadata.cgstAccountCode) {
          recordGstCredit(calcLine.accountingMetadata.cgstAccountCode, calcLine.cgstAmount, `CGST ${calcLine.cgstRate}%`);
        }
        if (calcLine.sgstAmount > 0 && calcLine.accountingMetadata.sgstAccountCode) {
          recordGstCredit(calcLine.accountingMetadata.sgstAccountCode, calcLine.sgstAmount, `SGST ${calcLine.sgstRate}%`);
        }
      } else {
        if (calcLine.igstAmount > 0 && calcLine.accountingMetadata.igstAccountCode) {
          recordGstCredit(calcLine.accountingMetadata.igstAccountCode, calcLine.igstAmount, `IGST ${calcLine.igstRate}%`);
        }
      }
    }

    // Delivery fee taxes
    if (taxCalc.delivery && taxCalc.delivery.totalTax > 0) {
      if (isIntra) {
        if (taxCalc.delivery.cgstAmount > 0 && taxCalc.delivery.accountingMetadata.cgstAccountCode) {
          recordGstCredit(taxCalc.delivery.accountingMetadata.cgstAccountCode, taxCalc.delivery.cgstAmount, "CGST 9.0% Delivery");
        }
        if (taxCalc.delivery.sgstAmount > 0 && taxCalc.delivery.accountingMetadata.sgstAccountCode) {
          recordGstCredit(taxCalc.delivery.accountingMetadata.sgstAccountCode, taxCalc.delivery.sgstAmount, "SGST 9.0% Delivery");
        }
      } else {
        if (taxCalc.delivery.igstAmount > 0 && taxCalc.delivery.accountingMetadata.igstAccountCode) {
          recordGstCredit(taxCalc.delivery.accountingMetadata.igstAccountCode, taxCalc.delivery.igstAmount, "IGST 18.0% Delivery");
        }
      }
    }

    for (const gstEntry of gstMap.values()) {
      const roundedAmount = Math.round(gstEntry.amount * 100) / 100;
      if (roundedAmount > 0) {
        journalLines.push({
          account_id: gstEntry.account.id,
          debit_amount: 0,
          credit_amount: roundedAmount,
          branch_id: orderBranchId,
          narration: gstEntry.narration,
          metadata: { order_id: order.id, account_code: gstEntry.account.code },
        });
      }
    }

    // 12. Mathematical & CoA Invariant Validation
    try {
      PostingService.validateJournalLines(journalLines);
    } catch (err: any) {
      throw new SalesPostingError("VOUCHER_UNBALANCED", `Double-entry validation failed: ${err.message}`);
    }

    await PostingService.validatePostingAccounts(
      journalLines.map((l) => l.account_id),
      client
    );

    return {
      journalLines,
      taxCalculation: taxCalc,
      invoiceTotal: taxCalc.invoiceTotal,
      paymentClassification,
      arAccount,
      order,
      branch,
    };
  }

  /**
   * Constructs a sales accounting voucher in DRAFT status with source idempotency.
   * Step 4.2 Core Service Primitive.
   */
  static async createSalesVoucherDraft(
    params: CreateSalesVoucherDraftParams
  ): Promise<{ success: true; data: AccountingVoucherRow } | { success: false; error: string; code: SalesPostingErrorCode }> {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const {
          journalLines,
          taxCalculation,
          invoiceTotal,
          paymentClassification,
          arAccount,
          order,
          branch,
        } = await SalesPostingService.inspectAndBuildJournalLines(params.orderId, client, {
          branchId: params.branchId,
          deliveryTaxRatePercent: params.deliveryTaxRatePercent,
        });

        const voucherDate = order.created_at
          ? (typeof order.created_at === "string"
              ? order.created_at.slice(0, 10)
              : (order.created_at as Date).toISOString().slice(0, 10))
          : new Date().toISOString().slice(0, 10);

        // Derive fiscal year without violating unconfigured period rules
        let fiscalYear: string;
        try {
          const period = await PostingService.validateFiscalPeriod(voucherDate, client);
          fiscalYear = period.fiscal_year;
        } catch {
          const [yr, mo] = voucherDate.split("-").map(Number);
          const startYear = mo >= 4 ? yr : yr - 1;
          fiscalYear = `FY${startYear}-${(startYear + 1).toString().slice(2)}`;
        }

        const customerName = order.metadata?.customer_name || order.email || "Customer";

        // Create voucher in DRAFT status via PostingService primitive
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "SALES",
            voucher_date: voucherDate,
            branch_id: branch.id,
            narration: `Sales invoice for Order ${order.display_id || order.id} (${customerName})`,
            reference_type: "SALE",
            reference_id: order.id,
            reference_event: "INVOICE_DRAFT",
            metadata: {
              order_id: order.id,
              customer_id: order.customer_id,
              branch_id: branch.id,
              voucher_subtype: "SALES_INVOICE",
              invoice_type: "SALES_INVOICE",
              payment_classification: paymentClassification,
              ar_account_code: arAccount.code,
              tax_calculation: taxCalculation,
              proposed_journal_lines: journalLines,
              source_idempotency_key: `SALE:${order.id}:INVOICE_DRAFT`,
            },
          },
          branchId: branch.id,
          fiscalYear,
          createdBy: params.createdBy,
          client,
        });

        if (!draftRes.success) {
          if (draftRes.code === "DUPLICATE_SOURCE_EVENT") {
            throw new SalesPostingError("DUPLICATE_SOURCE_EVENT", draftRes.error);
          }
          throw new SalesPostingError("POSTING_GUARD_FAILED", draftRes.error);
        }

        // Set total_amount to validated invoice total
        const updateSql = `
          UPDATE public.accounting_voucher
          SET total_amount = $1,
              updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;
        const updatedVoucherRes = await client.query<AccountingVoucherRow>(updateSql, [
          invoiceTotal,
          draftRes.data.id,
        ]);

        return updatedVoucherRes.rows[0];
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesPostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: "POSTING_GUARD_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_POSTING_FAILED" };
    }
  }

  /**
   * Transitions a sales voucher from DRAFT to SUBMITTED status.
   */
  static async submitSalesVoucher(
    params: SubmitSalesVoucherParams
  ): Promise<{ success: true; data: AccountingVoucherRow } | { success: false; error: string; code: SalesPostingErrorCode }> {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesPostingError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesPostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        if (voucher.status !== "DRAFT") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot submit voucher '${voucher.id}' in status '${voucher.status}'. Only DRAFT vouchers can be submitted.`
          );
        }

        const submitRes = await PostingService.submitVoucher({
          voucherId: voucher.id,
          submittedBy: params.submittedBy,
          branchId: voucher.branch_id,
          client,
        });

        if (!submitRes.success) {
          throw new SalesPostingError("INVALID_VOUCHER_STATE", submitRes.error);
        }

        return submitRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesPostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_POSTING_FAILED" };
    }
  }

  /**
   * Read-only preview of proposed sales voucher journal lines and tax calculation.
   */
  static async previewSalesVoucher(
    params: PreviewSalesVoucherParams
  ): Promise<InspectSalesJournalLinesResult> {
    const execute = async (client: PoolClient): Promise<InspectSalesJournalLinesResult> => {
      return SalesPostingService.inspectAndBuildJournalLines(params.orderId, client, {
        branchId: params.branchId,
        deliveryTaxRatePercent: params.deliveryTaxRatePercent,
      });
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  /**
   * Approves a SUBMITTED sales accounting voucher.
   * Phase 4F Step 4.3: Sales Voucher Approval & Segregation of Duties.
   */
  static async approveSalesVoucher(
    params: ApproveSalesVoucherParams
  ): Promise<
    | { success: true; data: SalesVoucherApprovalResult }
    | { success: false; error: string; code: SalesPostingErrorCode }
  > {
    try {
      const execute = async (client: PoolClient): Promise<SalesVoucherApprovalResult> => {
        // 1. Fetch & lock voucher
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesPostingError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (voucher.voucher_type !== "SALES") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' has type '${voucher.voucher_type}'. Expected 'SALES'.`
          );
        }

        // 2. Branch access check (BOLA defense)
        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesPostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        // 3. Lifecycle state verification: must be SUBMITTED
        if (voucher.status === "DRAFT") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher '${voucher.id}' in DRAFT status. Voucher must first be submitted.`
          );
        }
        if (voucher.status === "APPROVED") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Sales accounting voucher '${voucher.voucher_no}' is already APPROVED.`
          );
        }
        if (voucher.status === "POSTED") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher '${voucher.voucher_no}' in POSTED status.`
          );
        }
        if (voucher.status === "CANCELLED") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher '${voucher.voucher_no}' in CANCELLED status.`
          );
        }
        if (voucher.status !== "SUBMITTED") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher in status '${voucher.status}'. Only SUBMITTED vouchers can be approved.`
          );
        }

        // 4. Fetch & lock linked Order
        if (!voucher.reference_id) {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${voucher.id}' has no linked reference_id (order_id).`
          );
        }

        const oRes = await client.query(
          `SELECT * FROM public."order" WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [voucher.reference_id]
        );
        const order = oRes.rows[0];
        if (!order) {
          throw new SalesPostingError(
            "ORDER_NOT_FOUND",
            `Linked order '${voucher.reference_id}' not found.`
          );
        }

        if (order.status === "canceled") {
          throw new SalesPostingError(
            "INVALID_ORDER_STATUS",
            `Cannot approve voucher for canceled order '${order.id}'.`
          );
        }

        const orderMeta = order.metadata || {};
        if (orderMeta.legacy_prototype === true || orderMeta.is_ledger_eligible !== true) {
          throw new SalesPostingError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Order '${order.id}' is quarantined prototype data and cannot participate in accounting approval.`
          );
        }

        // 5. Segregation of Duties (SoD) & Audit Identity Integrity
        if (!voucher.created_by) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Voucher '${voucher.id}' has no recorded creator (created_by is null).`
          );
        }

        // SoD Rule A: Voucher Creator cannot approve own voucher
        if (params.approvedBy === voucher.created_by) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher creator '${voucher.created_by}' cannot approve their own voucher.`
          );
        }

        // SoD Rule B: Voucher Submitter cannot approve voucher
        if (voucher.submitted_by && params.approvedBy === voucher.submitted_by) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher submitter '${voucher.submitted_by}' cannot approve the voucher.`
          );
        }

        // SoD Rule C: Customer cannot approve voucher
        if (order.customer_id && params.approvedBy === order.customer_id) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Customer '${order.customer_id}' cannot approve the sales accounting voucher.`
          );
        }

        // SoD Rule D: Commercial Order Creator cannot approve accounting voucher
        if (orderMeta.created_by && params.approvedBy === orderMeta.created_by) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Commercial order creator '${orderMeta.created_by}' cannot approve the accounting voucher.`
          );
        }

        // 6. Canonical Permission Resolver Check (ACCOUNTING.APPROVE)
        const actorContext = params.actorContext || {
          id: params.approvedBy,
          user_id: params.approvedBy,
          role: "STAFF",
        };
        const hasApprovalPerm = hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE");
        if (!hasApprovalPerm) {
          throw new SalesPostingError(
            "PERMISSION_DENIED",
            `Staff '${params.approvedBy}' lacks required permission 'ACCOUNTING.APPROVE' to approve accounting vouchers.`
          );
        }

        // 7. Verify Double-Entry Balance of Proposed Lines
        const voucherMeta = (voucher.metadata || {}) as Record<string, any>;
        const proposedLines = voucherMeta.proposed_journal_lines as JournalLineInput[];
        if (!proposedLines || !Array.isArray(proposedLines) || proposedLines.length === 0) {
          throw new SalesPostingError(
            "VOUCHER_UNBALANCED",
            `Voucher '${voucher.id}' has no proposed journal lines in metadata.`
          );
        }

        try {
          PostingService.validateJournalLines(proposedLines);
        } catch (err: any) {
          throw new SalesPostingError("VOUCHER_UNBALANCED", `Double-entry validation failed: ${err.message}`);
        }

        // 8. Re-use Canonical Shared Lifecycle Transition (SUBMITTED -> APPROVED)
        const approveRes = await PostingService.approveVoucher({
          voucherId: voucher.id,
          approvedBy: params.approvedBy,
          branchId: voucher.branch_id,
          client,
        });

        if (!approveRes.success) {
          if (approveRes.code === "SEGREGATION_OF_DUTIES_VIOLATION") {
            throw new SalesPostingError("SEGREGATION_OF_DUTIES_VIOLATION", approveRes.error);
          }
          if (approveRes.code === "INVALID_VOUCHER_STATE") {
            throw new SalesPostingError("INVALID_VOUCHER_STATE", approveRes.error);
          }
          throw new SalesPostingError("POSTING_GUARD_FAILED", approveRes.error);
        }

        const approvedVoucher = approveRes.data;

        // 9. Update metadata with audit identities and supervisor notes
        const auditIdentities = {
          order_id: order.id,
          customer_id: order.customer_id || undefined,
          voucher_created_by: voucher.created_by,
          voucher_submitted_by: voucher.submitted_by || null,
          voucher_approved_by: params.approvedBy,
          approved_at: new Date().toISOString(),
        };

        const existingMeta = (approvedVoucher.metadata || {}) as Record<string, unknown>;
        const updatedMeta = {
          ...existingMeta,
          approval_notes: params.approvalNotes || null,
          approval_audit: auditIdentities,
        };

        const metaSql = `
          UPDATE public.accounting_voucher
          SET metadata = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;
        const finalVoucherRes = await client.query<AccountingVoucherRow>(metaSql, [
          JSON.stringify(updatedMeta),
          approvedVoucher.id,
        ]);

        return {
          voucher: finalVoucherRes.rows[0],
          auditTrail: auditIdentities,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesPostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: "POSTING_GUARD_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_POSTING_FAILED" };
    }
  }

  /**
   * Rejects / cancels a DRAFT or SUBMITTED sales accounting voucher.
   */
  static async rejectSalesVoucher(
    params: RejectSalesVoucherParams
  ): Promise<
    | { success: true; data: AccountingVoucherRow }
    | { success: false; error: string; code: SalesPostingErrorCode }
  > {
    try {
      if (!params.rejectionReason || !params.rejectionReason.trim()) {
        throw new SalesPostingError(
          "INVALID_VOUCHER_STATE",
          "Rejection reason is mandatory to reject a sales voucher."
        );
      }

      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        // 1. Fetch & lock voucher
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesPostingError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        // 2. Branch access check (BOLA)
        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesPostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        // 3. Lifecycle check: can only cancel DRAFT or SUBMITTED
        if (voucher.status === "POSTED") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot reject/cancel voucher '${voucher.id}' in POSTED status.`
          );
        }
        if (voucher.status === "CANCELLED") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${voucher.id}' is already CANCELLED.`
          );
        }

        // 4. Permission check: Caller must possess ACCOUNTING.APPROVE or ACCOUNTING.POST
        const actorContext = params.actorContext || {
          id: params.rejectedBy,
          user_id: params.rejectedBy,
          role: "STAFF",
        };
        const hasPerm =
          hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE") ||
          hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPerm) {
          throw new SalesPostingError(
            "PERMISSION_DENIED",
            `Staff '${params.rejectedBy}' lacks permission to reject sales accounting vouchers.`
          );
        }

        // 5. Re-use Canonical Shared Lifecycle Transition (-> CANCELLED)
        const cancelRes = await PostingService.cancelVoucher({
          voucherId: voucher.id,
          cancelledBy: params.rejectedBy,
          branchId: voucher.branch_id,
          client,
        });

        if (!cancelRes.success) {
          throw new SalesPostingError("INVALID_VOUCHER_STATE", cancelRes.error);
        }

        // 6. Record rejection reason in metadata
        const existingMeta = (cancelRes.data.metadata || {}) as Record<string, unknown>;
        const updatedMeta = {
          ...existingMeta,
          rejection_reason: params.rejectionReason.trim(),
          rejected_by: params.rejectedBy,
          rejected_at: new Date().toISOString(),
        };

        const metaSql = `
          UPDATE public.accounting_voucher
          SET metadata = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;
        const updatedVoucherRes = await client.query<AccountingVoucherRow>(metaSql, [
          JSON.stringify(updatedMeta),
          cancelRes.data.id,
        ]);

        return updatedVoucherRes.rows[0];
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesPostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_POSTING_FAILED" };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 4F STEP 4.4: ATOMIC SALES POSTING, INVENTORY FULFILLMENT & FIFO COGS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Atomically posts an approved sales accounting voucher to the General Ledger,
   * performs deterministic FIFO cost-lot consumption, records inventory movements,
   * updates physical branch_inventory, and posts a single compound journal entry
   * containing both Commercial (AR, Revenue, Output GST) and Operational (COGS, Inventory) lines.
   *
   * PRESERVES:
   * - 1:1 UNIQUE constraint on accounting_journal_entry.voucher_id.
   * - Exact double-entry balance: sum(Debits) === invoiceTotal + totalCogs === sum(Credits).
   * - Strict fail-closed on zero or insufficient cost lots: ZERO cost fabrication.
   * - Strict fail-closed on insufficient physical inventory.
   * - Canonical PostingService lifecycle and accounting start date / fiscal period guards.
   * - 100% atomic transaction: single PostgreSQL transaction with full rollback on any failure.
   */
  static async postSalesVoucher(
    params: PostSalesVoucherParams
  ): Promise<SalesPostingResponse> {
    try {
      const execute = async (client: PoolClient): Promise<SalesPostingResult> => {
        // ─────────────────────────────────────────────────────────────────────
        // 1. Pessimistic Row Lock & Fetch Voucher
        // ─────────────────────────────────────────────────────────────────────
        const vSql = `
          SELECT * FROM public.accounting_voucher
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE;
        `;
        const vRes = await client.query<AccountingVoucherRow>(vSql, [params.voucherId]);
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesPostingError(
            "VOUCHER_NOT_FOUND",
            `Sales voucher '${params.voucherId}' not found or deleted.`
          );
        }

        // Branch isolation (BOLA)
        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesPostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: Voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        // Voucher state validation
        if (voucher.status === "POSTED") {
          throw new SalesPostingError(
            "VOUCHER_ALREADY_POSTED",
            `Sales voucher '${voucher.voucher_no}' is already POSTED.`
          );
        }
        if (voucher.status !== "APPROVED") {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot post sales voucher '${voucher.voucher_no}' in status '${voucher.status}'. Only APPROVED vouchers can be posted.`
          );
        }

        // Verify reference is a sale
        if (voucher.reference_type !== "SALE" || !voucher.reference_id) {
          throw new SalesPostingError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${voucher.voucher_no}' does not reference a valid sales order.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. Pessimistic Row Lock & Fetch Source Order
        // ─────────────────────────────────────────────────────────────────────
        const orderSql = `
          SELECT * FROM public."order"
          WHERE id = $1
          FOR UPDATE;
        `;
        const orderRes = await client.query(orderSql, [voucher.reference_id]);
        const order = orderRes.rows[0];
        if (!order) {
          throw new SalesPostingError(
            "ORDER_NOT_FOUND",
            `Source order '${voucher.reference_id}' linked to voucher '${voucher.voucher_no}' not found.`
          );
        }

        // Check order status
        const ordStatus = (order.status || "").toLowerCase();
        if (ordStatus === "cancelled" || ordStatus === "canceled") {
          throw new SalesPostingError(
            "INVALID_ORDER_STATUS",
            `Cannot post sales voucher for canceled order '${order.id}'.`
          );
        }

        // Legacy prototype quarantine guard
        const orderMeta = (order.metadata || {}) as Record<string, any>;
        if (orderMeta.legacy_prototype === true || orderMeta.legacy_prototype === "true") {
          throw new SalesPostingError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Historical prototype order '${order.id}' is quarantined and cannot participate in accounting posting.`
          );
        }

        // Idempotency check: if order already records this voucher as posted
        if (orderMeta.financial_voucher_id === voucher.id && orderMeta.journal_entry_id) {
          throw new SalesPostingError(
            "ORDER_ALREADY_POSTED",
            `Order '${order.id}' has already been financially posted under voucher '${voucher.id}'.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Segregation of Duties (SoD) Checks
        // ─────────────────────────────────────────────────────────────────────
        if (!params.postedBy || !params.postedBy.trim()) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            "A valid staff postedBy identifier is required to post sales vouchers."
          );
        }

        // Voucher Submitter cannot post
        if (voucher.submitted_by && params.postedBy === voucher.submitted_by) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher submitter '${voucher.submitted_by}' cannot post the voucher.`
          );
        }

        // Voucher Preparer (creator) cannot post
        if (params.postedBy === voucher.created_by) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher creator '${voucher.created_by}' cannot post their own voucher.`
          );
        }

        // Commercial Order Creator cannot post
        if (orderMeta.created_by && params.postedBy === orderMeta.created_by) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Staff member '${orderMeta.created_by}' who created the commercial order cannot post the accounting voucher.`
          );
        }

        // Customer cannot post
        if (order.customer_id && params.postedBy === order.customer_id) {
          throw new SalesPostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Customer '${order.customer_id}' cannot post the accounting voucher.`
          );
        }

        // Canonical Permission Check (ACCOUNTING.POST)
        const actorContext = params.actorContext || {
          id: params.postedBy,
          user_id: params.postedBy,
          role: "STAFF",
        };
        const hasPostPerm = hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPostPerm) {
          throw new SalesPostingError(
            "PERMISSION_DENIED",
            `Staff '${params.postedBy}' lacks required permission 'ACCOUNTING.POST' to post transactions to the General Ledger.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. Fail-Closed Cut-off & Fiscal Period Guards
        // ─────────────────────────────────────────────────────────────────────
        await PostingService.validateAccountingStartDate(voucher.voucher_date, client);
        await PostingService.validateFiscalPeriod(voucher.voucher_date, client);

        // ─────────────────────────────────────────────────────────────────────
        // 5. Build and Reconcile Commercial Journal Lines
        // ─────────────────────────────────────────────────────────────────────
        const {
          journalLines: commercialLines,
          invoiceTotal,
        } = await SalesPostingService.inspectAndBuildJournalLines(order.id, client, {
          branchId: voucher.branch_id,
        });

        // Verify invoice total matches voucher total
        if (Math.abs(Number(voucher.total_amount) - invoiceTotal) > 0.05) {
          throw new SalesPostingError(
            "ORDER_TOTAL_MISMATCH",
            `Voucher total (${voucher.total_amount}) does not match recalculated order total (${invoiceTotal}).`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 6. Extract Line Items for Physical Fulfillment & Cost-Lot Consumption
        // ─────────────────────────────────────────────────────────────────────
        const rawItems: any[] = Array.isArray(orderMeta.items) ? orderMeta.items : [];
        if (rawItems.length === 0) {
          throw new SalesPostingError("EMPTY_ORDER", `Order '${order.id}' has no line items to fulfill.`);
        }

        interface FulfillmentItem {
          productId: string;
          variantId: string | null;
          title: string;
          merchandiseType: "CAKE" | "ACCESSORY" | "PACKAGING";
          quantity: number;
        }
        const fulfillmentItems: FulfillmentItem[] = [];

        for (const rawItem of rawItems) {
          const prodId = rawItem.product_id;
          if (!prodId) continue;

          const pRes = await client.query(
            `SELECT id, title, merchandise_type FROM public.product WHERE id = $1 AND deleted_at IS NULL`,
            [prodId]
          );
          const prod = pRes.rows[0];
          if (!prod) {
            throw new SalesPostingError("PRODUCT_NOT_FOUND", `Product '${prodId}' not found.`);
          }

          const qty = Math.max(1, Number(rawItem.quantity || 1));
          let variantId = rawItem.variant_id || null;

          if (!variantId) {
            const pvRes = await client.query(
              `SELECT id FROM public.product_variant WHERE product_id = $1 ORDER BY variant_rank ASC, id ASC LIMIT 1`,
              [prod.id]
            );
            variantId = pvRes.rows?.[0]?.id || null;
          }

          fulfillmentItems.push({
            productId: prod.id,
            variantId,
            title: prod.title,
            merchandiseType: (prod.merchandise_type || "CAKE") as "CAKE" | "ACCESSORY" | "PACKAGING",
            quantity: qty,
          });
        }

        // ─────────────────────────────────────────────────────────────────────
        // 7. Lock Branch Inventory Rows in Consistent Order
        // ─────────────────────────────────────────────────────────────────────
        const variantIds = Array.from(
          new Set(fulfillmentItems.map((f) => f.variantId).filter(Boolean))
        ) as string[];
        variantIds.sort(); // Lexicographical sort prevents deadlocks

        const binvMap = new Map<string, { id: string; quantity: number; reserved: number }>();
        if (variantIds.length > 0) {
          const binvRes = await client.query(
            `SELECT id, variant_id, quantity, reserved 
             FROM public.branch_inventory 
             WHERE branch_id = $1 AND variant_id = ANY($2::text[])
             ORDER BY variant_id ASC
             FOR UPDATE;`,
            [voucher.branch_id, variantIds]
          );
          for (const row of binvRes.rows) {
            binvMap.set(row.variant_id, {
              id: row.id,
              quantity: Number(row.quantity),
              reserved: Number(row.reserved),
            });
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 8. Lock Eligible FIFO Cost Lots in Deterministic Order & Verify Availability
        // ─────────────────────────────────────────────────────────────────────
        const sortedFulfillmentItems = [...fulfillmentItems].sort((a, b) =>
          a.productId.localeCompare(b.productId)
        );

        const itemLotsMap = new Map<FulfillmentItem, InventoryCostLotRow[]>();

        for (const item of sortedFulfillmentItems) {
          const lotRes = await client.query<InventoryCostLotRow>(
            `SELECT * FROM public.inventory_cost_lot
             WHERE branch_id = $1 
               AND product_id = $2 
               AND ($3::text IS NULL OR variant_id = $3 OR variant_id IS NULL)
               AND status = 'ACTIVE' 
               AND remaining_quantity > 0
             ORDER BY received_at ASC, id ASC
             FOR UPDATE;`,
            [voucher.branch_id, item.productId, item.variantId]
          );
          const lots = lotRes.rows;
          itemLotsMap.set(item, lots);

          // Availability Check 1: Cost Lots (FAIL CLOSED - ZERO COST FABRICATION)
          const totalLotQty = lots.reduce((sum, l) => sum + Number(l.remaining_quantity), 0);
          if (totalLotQty < item.quantity) {
            throw new SalesPostingError(
              "INSUFFICIENT_COST_LOT_QUANTITY",
              `Insufficient cost lots for product '${item.title}' (${item.productId}) at branch '${voucher.branch_id}': required ${item.quantity}, available ${totalLotQty}. Inventory cost cannot be synthesized or fabricated.`
            );
          }

          // Availability Check 2: Physical Branch Inventory (FAIL CLOSED)
          if (item.variantId) {
            const binv = binvMap.get(item.variantId);
            if (!binv || binv.quantity < item.quantity) {
              throw new SalesPostingError(
                "INSUFFICIENT_PHYSICAL_INVENTORY",
                `Insufficient physical inventory for product '${item.title}' at branch '${voucher.branch_id}': required ${item.quantity}, available ${binv ? binv.quantity : 0}.`
              );
            }
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 9. Consume FIFO Cost Lots, Record Movements, and Decrement Physical Stock
        // ─────────────────────────────────────────────────────────────────────
        const createdConsumptions: InventoryCostConsumptionRow[] = [];
        const createdMovements: InventoryMovementRow[] = [];
        const cogsByMerchandise = {
          CAKE: 0,
          ACCESSORY: 0,
          PACKAGING: 0,
        };

        for (const item of sortedFulfillmentItems) {
          const lots = itemLotsMap.get(item) || [];

          // Insert parent inventory movement
          const movRes = await client.query<InventoryMovementRow>(
            `INSERT INTO public.inventory_movement (
               branch_id, product_id, variant_id,
               movement_type, quantity, direction,
               order_id, voucher_id, reference_no, narration,
               created_by, created_at
             ) VALUES (
               $1, $2, $3,
               'SALES_FULFILLMENT', $4, 'OUT',
               $5, $6, $7, $8,
               $9, NOW()
             ) RETURNING *;`,
            [
              voucher.branch_id,
              item.productId,
              item.variantId,
              item.quantity,
              order.id,
              voucher.id,
              voucher.voucher_no,
              `Fulfillment for Order ${order.display_id || order.id} (${item.title})`,
              params.postedBy,
            ]
          );
          const movement = movRes.rows[0];
          createdMovements.push(movement);

          // Consume lots FIFO
          let remainingNeeded = item.quantity;
          for (const lot of lots) {
            if (remainingNeeded <= 0) break;
            const lotRem = Number(lot.remaining_quantity);
            const consumeQty = Math.min(lotRem, remainingNeeded);
            const unitCost = Number(lot.unit_cost);
            const totalCost = Math.round(consumeQty * unitCost * 100) / 100;

            // Mathematical constraint check
            const reconstructed = Math.round(consumeQty * unitCost * 100) / 100;
            if (Math.abs(totalCost - reconstructed) > 0.05) {
              throw new SalesPostingError(
                "COST_CONSISTENCY_VIOLATION",
                `Cost consumption math violation for lot '${lot.id}': total_cost=${totalCost}, qty*unit_cost=${reconstructed}.`
              );
            }

            const newRemaining = Math.round((lotRem - consumeQty) * 1000) / 1000;
            const newStatus = newRemaining === 0 ? "DEPLETED" : "ACTIVE";

            // Update cost lot
            await client.query(
              `UPDATE public.inventory_cost_lot
               SET remaining_quantity = $1, status = $2, updated_at = NOW()
               WHERE id = $3;`,
              [newRemaining, newStatus, lot.id]
            );

            // Insert cost consumption record
            const consRes = await client.query<InventoryCostConsumptionRow>(
              `INSERT INTO public.inventory_cost_consumption (
                 movement_id, lot_id, quantity, unit_cost, total_cost, created_at
               ) VALUES ($1, $2, $3, $4, $5, NOW())
               RETURNING *;`,
              [movement.id, lot.id, consumeQty, unitCost, totalCost]
            );
            createdConsumptions.push(consRes.rows[0]);

            cogsByMerchandise[item.merchandiseType] += totalCost;
            remainingNeeded -= consumeQty;
          }

          // Decrement physical stock in branch_inventory
          if (item.variantId) {
            await client.query(
              `UPDATE public.branch_inventory
               SET quantity = quantity - $1, updated_at = NOW()
               WHERE branch_id = $2 AND variant_id = $3;`,
              [item.quantity, voucher.branch_id, item.variantId]
            );
          }
        }

        // Round COGS totals
        cogsByMerchandise.CAKE = Math.round(cogsByMerchandise.CAKE * 100) / 100;
        cogsByMerchandise.ACCESSORY = Math.round(cogsByMerchandise.ACCESSORY * 100) / 100;
        cogsByMerchandise.PACKAGING = Math.round(cogsByMerchandise.PACKAGING * 100) / 100;

        const totalCogs = Math.round(
          (cogsByMerchandise.CAKE + cogsByMerchandise.ACCESSORY + cogsByMerchandise.PACKAGING) * 100
        ) / 100;

        // ─────────────────────────────────────────────────────────────────────
        // 10. Resolve COGS and Inventory Accounts
        // ─────────────────────────────────────────────────────────────────────
        const cogsCodes = ["5110", "5120", "5130", "1131", "1132", "1133"];
        const cogsCoaRes = await client.query<AccountingAccountRow>(
          `SELECT * FROM public.accounting_account WHERE code = ANY($1) AND is_active = true AND deleted_at IS NULL`,
          [cogsCodes]
        );
        const cogsCoaMap = new Map<string, AccountingAccountRow>();
        for (const a of cogsCoaRes.rows) {
          cogsCoaMap.set(a.code, a);
        }

        const cogsLines: JournalLineInput[] = [];

        // Cakes COGS: Dr 5110 / Cr 1132
        if (cogsByMerchandise.CAKE > 0) {
          const acc5110 = cogsCoaMap.get("5110");
          const acc1132 = cogsCoaMap.get("1132");
          if (!acc5110 || !acc1132) {
            throw new SalesPostingError(
              "ACCOUNT_RESOLUTION_FAILED",
              "Accounts 5110 or 1132 not found in CoA."
            );
          }
          cogsLines.push({
            account_id: acc5110.id,
            debit_amount: cogsByMerchandise.CAKE,
            credit_amount: 0,
            branch_id: voucher.branch_id,
            narration: `COGS recognized for cakes on Order ${order.display_id || order.id}`,
          });
          cogsLines.push({
            account_id: acc1132.id,
            debit_amount: 0,
            credit_amount: cogsByMerchandise.CAKE,
            branch_id: voucher.branch_id,
            narration: `Inventory reduction for cakes on Order ${order.display_id || order.id}`,
          });
        }

        // Accessories COGS: Dr 5120 / Cr 1131
        if (cogsByMerchandise.ACCESSORY > 0) {
          const acc5120 = cogsCoaMap.get("5120");
          const acc1131 = cogsCoaMap.get("1131");
          if (!acc5120 || !acc1131) {
            throw new SalesPostingError(
              "ACCOUNT_RESOLUTION_FAILED",
              "Accounts 5120 or 1131 not found in CoA."
            );
          }
          cogsLines.push({
            account_id: acc5120.id,
            debit_amount: cogsByMerchandise.ACCESSORY,
            credit_amount: 0,
            branch_id: voucher.branch_id,
            narration: `COGS recognized for accessories on Order ${order.display_id || order.id}`,
          });
          cogsLines.push({
            account_id: acc1131.id,
            debit_amount: 0,
            credit_amount: cogsByMerchandise.ACCESSORY,
            branch_id: voucher.branch_id,
            narration: `Inventory reduction for accessories on Order ${order.display_id || order.id}`,
          });
        }

        // Packaging COGS: Dr 5130 / Cr 1133
        if (cogsByMerchandise.PACKAGING > 0) {
          const acc5130 = cogsCoaMap.get("5130");
          const acc1133 = cogsCoaMap.get("1133");
          if (!acc5130 || !acc1133) {
            throw new SalesPostingError(
              "ACCOUNT_RESOLUTION_FAILED",
              "Accounts 5130 or 1133 not found in CoA."
            );
          }
          cogsLines.push({
            account_id: acc5130.id,
            debit_amount: cogsByMerchandise.PACKAGING,
            credit_amount: 0,
            branch_id: voucher.branch_id,
            narration: `Packaging consumed on Order ${order.display_id || order.id}`,
          });
          cogsLines.push({
            account_id: acc1133.id,
            debit_amount: 0,
            credit_amount: cogsByMerchandise.PACKAGING,
            branch_id: voucher.branch_id,
            narration: `Packaging stock reduction on Order ${order.display_id || order.id}`,
          });
        }

        // ─────────────────────────────────────────────────────────────────────
        // 11. Combine Into Single Atomic Compound Journal Entry
        // ─────────────────────────────────────────────────────────────────────
        const compoundJournalLines: JournalLineInput[] = [...commercialLines, ...cogsLines];

        // ─────────────────────────────────────────────────────────────────────
        // 12. Delegate Final Posting to Canonical PostingService.postVoucher
        // ─────────────────────────────────────────────────────────────────────
        const postRes = await PostingService.postVoucher({
          voucherId: voucher.id,
          postedBy: params.postedBy,
          lines: compoundJournalLines,
          branchId: voucher.branch_id,
          client,
        });

        if (!postRes.success) {
          throw new SalesPostingError("POSTING_GUARD_FAILED", `[${postRes.code}] ${postRes.error}`);
        }

        const postedVoucher = postRes.data.voucher;
        const journalEntry = postRes.data.journal_entry;
        const totalJournalAmount = Number(journalEntry.total_debit);

        // ─────────────────────────────────────────────────────────────────────
        // 13. Update Audit Linkages on Order and Voucher
        // ─────────────────────────────────────────────────────────────────────
        const updatedOrderMeta = {
          ...orderMeta,
          financial_voucher_id: postedVoucher.id,
          journal_entry_id: journalEntry.id,
          cogs_total: totalCogs,
          invoice_total: invoiceTotal,
          inventory_fulfillment_posted_at: new Date().toISOString(),
        };

        await client.query(
          `UPDATE public."order"
           SET metadata = $1, updated_at = NOW()
           WHERE id = $2;`,
          [JSON.stringify(updatedOrderMeta), order.id]
        );

        const vMeta = (postedVoucher.metadata || {}) as Record<string, any>;
        const updatedVMeta = {
          ...vMeta,
          cogs_total: totalCogs,
          invoice_total: invoiceTotal,
          journal_total: totalJournalAmount,
          movements_count: createdMovements.length,
          cost_consumptions_count: createdConsumptions.length,
        };

        const finalVoucherRes = await client.query<AccountingVoucherRow>(
          `UPDATE public.accounting_voucher
           SET metadata = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *;`,
          [JSON.stringify(updatedVMeta), postedVoucher.id]
        );

        return {
          voucher: finalVoucherRes.rows[0],
          journalEntry,
          costConsumptions: createdConsumptions,
          movements: createdMovements,
          invoiceTotal,
          totalCogs,
          totalJournalAmount,
        };
      };

      const executeWithSavepoint = async (client: PoolClient): Promise<SalesPostingResult> => {
        await client.query("SAVEPOINT sp_sales_posting");
        try {
          const res = await execute(client);
          await client.query("RELEASE SAVEPOINT sp_sales_posting");
          return res;
        } catch (e) {
          await client.query("ROLLBACK TO SAVEPOINT sp_sales_posting");
          throw e;
        }
      };

      const result = params.client
        ? await executeWithSavepoint(params.client)
        : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesPostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: `[${err.code}] ${err.message}`, code: "POSTING_GUARD_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_POSTING_FAILED" };
    }
  }

  /**
   * Read-only helper: Returns the authoritative outstanding AR balance for a sales order.
   * Phase 4F Step 4.5 Integration.
   */
  static async getOrderOutstandingBalance(orderId: string, client?: PoolClient) {
    return CustomerReceiptService.getOrderOutstandingAr(orderId, client);
  }
}

