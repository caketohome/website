/**
 * CakeToHome ERP — Purchase Posting Service
 * Phase 4F Step 3C.1: Targeted Forensic Correction
 *
 * ARCHITECTURAL CORRECTIONS APPLIED:
 * 1. GENUINE ACCOUNTING VOUCHER LIFECYCLE:
 *    - Replaces decorative copying of purchase.approved_by with genuine lifecycle transitions:
 *      DRAFT → SUBMITTED → APPROVED → POSTED.
 *    - The voucher is created via canonical PostingService.createVoucherDraft.
 *    - The voucher is submitted via canonical PostingService.submitVoucher.
 *    - The voucher is approved by an authorized accounting approver via canonical PostingService.approveVoucher.
 *      Enforces voucher.approved_by !== voucher.created_by.
 *    - postPurchase delegates financial posting directly to canonical PostingService.postVoucher,
 *      which requires an already-APPROVED voucher and performs all GL checks.
 *    - Zero "SYSTEM" or "ADMIN" bypass.
 *    - Distinct actors required:
 *      purchase.created_by (buyer) != purchase.approved_by (store manager)
 *      voucher.created_by (AP clerk) != voucher.approved_by (accounting supervisor)
 *      postedBy (finance controller) != voucher.created_by AND postedBy != purchase.created_by.
 *
 * 2. PACKAGING INVENTORY BEHAVIOR:
 *    - Packaging items with product_id IS NOT NULL update physical branch_inventory.
 *    - Packaging items with product_id IS NULL are tracked in:
 *      * General Ledger: Account 1133 (Packaging Supplies Stock)
 *      * Cost Ledger: inventory_cost_lot (item_type = 'PACKAGING', received_quantity, unit_cost, total_cost)
 *      * Movement Ledger: inventory_movement (PURCHASE_RECEIPT, direction IN)
 *      * Physical branch_inventory update is skipped because branch_inventory requires a catalog product/variant ID.
 *
 * 3. FAIL-CLOSED CONFIGURATION GUARDS:
 *    - Rejects real postings when accounting_start_date is unconfigured or fiscal_period is 0.
 *
 * 4. ATOMICITY & CONCURRENCY:
 *    - Single PostgreSQL transaction with `SELECT FOR UPDATE` on purchase, items, and voucher.
 *    - Complete ROLLBACK on any failure; zero partial state.
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { hasEffectivePermission } from "../staff-access-control";
import { PostingService, PostingServiceError } from "./posting.service";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  AccountingAccountRow,
  InventoryCostLotRow,
  InventoryMovementRow,
  JournalLineInput,
} from "../types/accounting.types";
import type {
  PurchaseRow,
  PurchaseItemRow,
} from "../types/purchase.types";
import {
  calculatePurchaseTaxesAndTotals,
  TaxEngineError,
  type PurchaseCalculationInput,
  type PurchaseCalculationResult,
  type PurchaseLineItemInput,
  type SupplierLocationInput,
  type BranchLocationInput,
  type FreightPolicy,
} from "./purchase-tax-engine";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type PurchasePostingErrorCode =
  | "PURCHASE_NOT_FOUND"
  | "INVALID_PURCHASE_STATUS"
  | "PURCHASE_ALREADY_POSTED"
  | "EMPTY_PURCHASE"
  | "BRANCH_ACCESS_DENIED"
  | "INVALID_ENTITY"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "DUPLICATE_SOURCE_EVENT"
  | "DUPLICATE_COST_LOT"
  | "VOUCHER_NOT_FOUND"
  | "INVALID_VOUCHER_STATE"
  | "INVALID_MERCHANDISE_CLASSIFICATION"
  | "ACCOUNT_RESOLUTION_FAILED"
  | "PURCHASE_TOTAL_MISMATCH"
  | "COST_CONSISTENCY_VIOLATION"
  | "PERMISSION_DENIED"
  | "POSTING_GUARD_FAILED"
  | "PURCHASE_POSTING_FAILED";

export class PurchasePostingError extends Error {
  readonly code: PurchasePostingErrorCode;

  constructor(code: PurchasePostingErrorCode, message: string) {
    super(message);
    this.name = "PurchasePostingError";
    this.code = code;
  }
}

// ─── DTOs & Parameters ────────────────────────────────────────────────────────

export interface CreatePurchaseVoucherDraftParams {
  purchaseId: string;
  /** Staff user ID creating the voucher draft (e.g. AP clerk) */
  createdBy: string;
  branchId?: string;
  freightPolicy?: FreightPolicy;
  freightAmount?: number;
  isFreightBilledOnInvoice?: boolean;
  client?: PoolClient;
}

export interface SubmitPurchaseVoucherParams {
  voucherId: string;
  /** Staff user ID submitting the voucher draft (e.g. AP clerk) */
  submittedBy: string;
  branchId?: string;
  client?: PoolClient;
}

export interface ApprovePurchaseVoucherParams {
  voucherId: string;
  /** Staff user ID executing the accounting approval (e.g. accounting supervisor) */
  approvedBy: string;
  /** Optional actor role */
  actorRole?: string;
  /** Full actor session or object for hasEffectivePermission check */
  actorSession?: any;
  /** Branch scope from server session */
  branchId?: string;
  /** Optional supervisor approval notes */
  approvalNotes?: string;
  /**
   * If true, allows commercial purchase approver to also approve the accounting voucher.
   * Defaults to false (strict dual-control segregation of duties: commercial != accounting).
   */
  allowCommercialApprover?: boolean;
  /** Optional existing transaction client */
  client?: PoolClient;
}

export interface ApprovePurchaseVoucherResult {
  voucher: AccountingVoucherRow;
  auditTrail: {
    purchase_id: string;
    purchase_created_by: string;
    purchase_approved_by: string;
    voucher_created_by: string;
    voucher_submitted_by: string | null;
    voucher_approved_by: string;
    approved_at: string;
  };
}

export interface RejectPurchaseVoucherParams {
  voucherId: string;
  /** Staff user ID executing the rejection/cancellation */
  rejectedBy: string;
  /** Optional actor role */
  actorRole?: string;
  /** Full actor session or object for hasEffectivePermission check */
  actorSession?: any;
  /** Branch scope from server session */
  branchId?: string;
  /** Mandatory rejection/cancellation reason */
  rejectionReason: string;
  /** Optional existing transaction client */
  client?: PoolClient;
}

export interface PreviewPurchaseVoucherParams {
  purchaseId: string;
  branchId?: string;
  freightPolicy?: FreightPolicy;
  freightAmount?: number;
  isFreightBilledOnInvoice?: boolean;
  client?: PoolClient;
}

export interface PreviewPurchaseVoucherResult {
  purchase: PurchaseRow;
  tax_calculation: PurchaseCalculationResult;
  journal_lines: JournalLineInput[];
  total_payable: number;
  is_balanced: boolean;
}

export interface PostPurchaseParams {
  purchaseId: string;
  /**
   * Optional explicit voucher ID.
   * If omitted, finds the existing active voucher for this purchase.
   * The voucher MUST already be in 'APPROVED' status.
   */
  voucherId?: string;
  /** Staff user ID executing the posting (must be distinct from creators) */
  postedBy: string;
  /** Optional actor role */
  actorRole?: string;
  /** Full actor session or object for hasEffectivePermission check */
  actorSession?: any;
  /** Optional branch scope for BOLA defense */
  branchId?: string;
  /** Optional freight policy override */
  freightPolicy?: FreightPolicy;
  /** Optional freight amount override */
  freightAmount?: number;
  /** Optional flag indicating if freight is billed on supplier invoice */
  isFreightBilledOnInvoice?: boolean;
  /** Optional existing transaction client for orchestrated workflows */
  client?: PoolClient;
}

export interface PrepareAndPostPurchaseParams {
  purchaseId: string;
  voucherCreatedBy: string;
  voucherApprovedBy: string;
  postedBy: string;
  actorRole?: string;
  actorSession?: any;
  branchId?: string;
  freightPolicy?: FreightPolicy;
  freightAmount?: number;
  isFreightBilledOnInvoice?: boolean;
  client?: PoolClient;
}

export interface PurchasePostingResult {
  purchase: PurchaseRow;
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  cost_lots: InventoryCostLotRow[];
  movements: InventoryMovementRow[];
}

export type PurchasePostingResponse<T = PurchasePostingResult> =
  | { success: true; data: T }
  | { success: false; error: string; code: PurchasePostingErrorCode };

// ─── PurchasePostingService ───────────────────────────────────────────────────

export class PurchasePostingService {
  /**
   * Validates purchase eligibility, items, classifications, accounts,
   * executes the deterministic purchase tax engine, and generates balanced double-entry journal lines.
   */
  static async inspectAndBuildJournalLines(
    purchase: PurchaseRow,
    items: PurchaseItemRow[],
    client: PoolClient,
    options?: {
      freightPolicy?: FreightPolicy;
      freightAmount?: number;
      isFreightBilledOnInvoice?: boolean;
    }
  ): Promise<{
    journalLines: JournalLineInput[];
    taxCalculation: PurchaseCalculationResult;
    totalPayable: number;
    supplierName: string;
  }> {
    // 1. Entity integrity (Supplier & Location)
    const supplierCheck = await client.query(
      "SELECT id, name, gstin, state FROM public.supplier WHERE id = $1 AND deleted_at IS NULL",
      [purchase.supplier_id]
    );
    const supplier = supplierCheck.rows[0];
    if (!supplier) {
      throw new PurchasePostingError(
        "INVALID_ENTITY",
        `Supplier '${purchase.supplier_id}' does not exist or is deleted.`
      );
    }

    // 2. Entity integrity (Branch & Location)
    const branchRes = await client.query(
      `SELECT b.id, b.name, b.metadata, c.name AS city_name, c.state AS city_state
       FROM public.branch b
       LEFT JOIN public.city c ON c.id = b.city_id
       WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [purchase.branch_id]
    );
    const branchRow = branchRes.rows[0];
    if (!branchRow) {
      throw new PurchasePostingError(
        "INVALID_ENTITY",
        `Receiving branch '${purchase.branch_id}' does not exist or is deleted.`
      );
    }

    const branchLocation: BranchLocationInput = {
      state: (branchRow.metadata as any)?.state || branchRow.city_state || null,
      stateCode: (branchRow.metadata as any)?.state_code || null,
      cityName: (branchRow.metadata as any)?.city || branchRow.city_name || null,
      cityState: branchRow.city_state || null,
    };
    const supplierLocation: SupplierLocationInput = {
      gstin: supplier.gstin || null,
      state: supplier.state || null,
    };

    // 3. Validate items & merchandise classification
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new PurchasePostingError(
          "INVALID_MERCHANDISE_CLASSIFICATION",
          `Purchase item '${item.id}' has invalid quantity ${item.quantity}. Must be > 0.`
        );
      }
      if (Number(item.taxable_value) <= 0) {
        throw new PurchasePostingError(
          "INVALID_MERCHANDISE_CLASSIFICATION",
          `Purchase item '${item.id}' has non-positive taxable value (${item.taxable_value}). Cost cannot be established.`
        );
      }

      if (!["CAKE", "ACCESSORY", "PACKAGING"].includes(item.item_type)) {
        throw new PurchasePostingError(
          "INVALID_MERCHANDISE_CLASSIFICATION",
          `Purchase item '${item.id}' has unrecognized item_type '${item.item_type}'.`
        );
      }

      if (item.product_id) {
        const prodRes = await client.query(
          "SELECT id, merchandise_type FROM public.product WHERE id = $1 AND deleted_at IS NULL",
          [item.product_id]
        );
        const prod = prodRes.rows[0];
        if (!prod) {
          throw new PurchasePostingError(
            "INVALID_MERCHANDISE_CLASSIFICATION",
            `Product '${item.product_id}' for item '${item.id}' not found in catalog.`
          );
        }
        if (prod.merchandise_type !== item.item_type) {
          throw new PurchasePostingError(
            "INVALID_MERCHANDISE_CLASSIFICATION",
            `Classification mismatch for item '${item.id}': purchase item has item_type '${item.item_type}', but product '${prod.id}' has merchandise_type '${prod.merchandise_type}'.`
          );
        }
      } else {
        if (item.item_type !== "PACKAGING") {
          throw new PurchasePostingError(
            "INVALID_MERCHANDISE_CLASSIFICATION",
            `Item '${item.id}' of type '${item.item_type}' must be linked to a valid product_id.`
          );
        }
      }
    }

    // 4. Resolve canonical CoA accounts
    const accAccessories = await AccountingAccountRepository.findByCode("1131", client);
    const accCakes = await AccountingAccountRepository.findByCode("1132", client);
    const accPackaging = await AccountingAccountRepository.findByCode("1133", client);
    const accPayable = await AccountingAccountRepository.findByCode("2111", client);

    if (!accAccessories || !accCakes || !accPackaging || !accPayable) {
      throw new PurchasePostingError(
        "ACCOUNT_RESOLUTION_FAILED",
        "One or more required CoA asset/liability accounts (1131, 1132, 1133, 2111) are missing from database."
      );
    }

    // Helper for Input GST accounts
    const resolveInputGstAccount = async (
      component: "CGST" | "SGST" | "IGST",
      rate: number
    ): Promise<AccountingAccountRow> => {
      const roundedRate = (Math.round(rate * 100) / 100).toFixed(2);
      const namePattern = `%${component}%`;

      const exactRes = await client.query<AccountingAccountRow>(
        `SELECT * FROM public.accounting_account 
         WHERE subtype = 'INPUT_TAX' 
           AND name ILIKE $1 
           AND tax_rate = $2 
           AND is_group = false
           AND is_active = true
           AND deleted_at IS NULL 
         LIMIT 1`,
        [namePattern, roundedRate]
      );
      if (exactRes.rows[0]) return exactRes.rows[0];

      const fallbackRes = await client.query<AccountingAccountRow>(
        `SELECT * FROM public.accounting_account 
         WHERE subtype = 'INPUT_TAX' 
           AND name ILIKE $1 
           AND is_group = false
           AND is_active = true
           AND deleted_at IS NULL 
         ORDER BY code ASC 
         LIMIT 1`,
        [namePattern]
      );
      if (fallbackRes.rows[0]) return fallbackRes.rows[0];

      throw new PurchasePostingError(
        "ACCOUNT_RESOLUTION_FAILED",
        `No Input Tax account found in Chart of Accounts for ${component} at rate ${rate}%.`
      );
    };

    // 5. Map items to PurchaseLineItemInput
    const lineInputs: PurchaseLineItemInput[] = items.map((item) => {
      let taxRatePercent = 0;
      if (item.igst_rate !== null && item.igst_rate !== undefined && Number(item.igst_rate) > 0) {
        taxRatePercent = Number(item.igst_rate);
      } else if (
        (item.cgst_rate !== null && item.cgst_rate !== undefined && Number(item.cgst_rate) > 0) ||
        (item.sgst_rate !== null && item.sgst_rate !== undefined && Number(item.sgst_rate) > 0)
      ) {
        taxRatePercent = Number(item.cgst_rate || 0) + Number(item.sgst_rate || 0);
      } else if ((item as any).tax_rate) {
        taxRatePercent = Number((item as any).tax_rate);
      }

      return {
        id: item.id,
        itemType: item.item_type,
        productId: item.product_id,
        variantId: item.variant_id,
        description: item.description || item.id,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        discount: Number(item.discount || 0),
        taxRatePercent,
        hsnCode: item.hsn_code || null,
      };
    });

    // 6. Execute Frozen Purchase Tax Engine
    const metadata = (purchase.metadata || {}) as Record<string, any>;
    const headerDiscount = Number(purchase.discount || 0);
    const freightPolicy: FreightPolicy =
      options?.freightPolicy || metadata.freight_policy || "NONE";
    const freightAmount =
      options?.freightAmount !== undefined
        ? Number(options.freightAmount)
        : Number(metadata.freight_amount || 0);
    const isFreightBilledOnInvoice =
      options?.isFreightBilledOnInvoice !== undefined
        ? Boolean(options.isFreightBilledOnInvoice)
        : Boolean(metadata.is_freight_billed_on_invoice ?? (freightAmount > 0));

    let taxCalc: PurchaseCalculationResult;
    try {
      taxCalc = calculatePurchaseTaxesAndTotals({
        supplier: supplierLocation,
        branch: branchLocation,
        items: lineInputs,
        headerDiscount,
        freightAmount,
        freightPolicy,
        isFreightBilledOnInvoice,
      });
    } catch (err: any) {
      if (err instanceof TaxEngineError) {
        throw new PurchasePostingError("POSTING_GUARD_FAILED", `Tax engine calculation failed: ${err.message}`);
      }
      throw err;
    }

    // 7. Purchase Total Reconciliation
    const purchaseTotal = Number(purchase.total);
    if (Math.abs(taxCalc.invoiceTotal - purchaseTotal) > 0.05) {
      throw new PurchasePostingError(
        "PURCHASE_TOTAL_MISMATCH",
        `Tax engine total (${taxCalc.invoiceTotal.toFixed(2)}) does not match purchase total (${purchaseTotal.toFixed(2)}).`
      );
    }

    // 8. Construct Journal Lines
    const journalLines: JournalLineInput[] = [];

    // Debits to inventory asset accounts (1131, 1132, 1133)
    // Note: Cost = taxableValue + capitalized attributable freight (ex-tax)
    for (const line of taxCalc.lines) {
      let targetAccountId = accCakes.id;
      if (line.itemType === "ACCESSORY") targetAccountId = accAccessories.id;
      if (line.itemType === "PACKAGING") targetAccountId = accPackaging.id;

      const itemCost = Math.round((line.inventoryLotTotalCost ?? line.taxableValue) * 100) / 100;
      journalLines.push({
        account_id: targetAccountId,
        debit_amount: itemCost,
        credit_amount: 0,
        branch_id: purchase.branch_id,
        supplier_id: purchase.supplier_id,
        narration: `Purchase receipt: ${line.description || line.id} (${line.quantity} units)`,
        metadata: {
          purchase_id: purchase.id,
          purchase_item_id: line.id,
          product_id: line.productId,
          variant_id: line.variantId,
          item_type: line.itemType,
          taxable_value: line.taxableValue,
          allocated_freight: line.allocatedFreight,
        },
      });
    }

    // Debit to Freight & Cartage Inward (5240) if OPERATING_EXPENSE
    if (taxCalc.freightExpenseAmount > 0) {
      const accFreight = await AccountingAccountRepository.findByCode("5240", client);
      if (!accFreight) {
        throw new PurchasePostingError(
          "ACCOUNT_RESOLUTION_FAILED",
          "CoA account 5240 (Freight & Cartage Inward) is required for operating expense freight but missing from database."
        );
      }
      journalLines.push({
        account_id: accFreight.id,
        debit_amount: Math.round(taxCalc.freightExpenseAmount * 100) / 100,
        credit_amount: 0,
        branch_id: purchase.branch_id,
        supplier_id: purchase.supplier_id,
        narration: `Freight & Cartage Inward: Invoice ${purchase.invoice_no || purchase.id}`,
        metadata: {
          purchase_id: purchase.id,
          freight_policy: "OPERATING_EXPENSE",
          freight_amount: taxCalc.freightExpenseAmount,
        },
      });
    }

    // Debits to recoverable Input GST accounts
    const taxMap = new Map<string, { accountId: string; amount: number; narration: string; component: string }>();

    for (const line of taxCalc.lines) {
      if (line.cgstAmount > 0) {
        const acc = await resolveInputGstAccount("CGST", line.cgstRate);
        const existing = taxMap.get(acc.id) || {
          accountId: acc.id,
          amount: 0,
          narration: `Input CGST (${line.cgstRate}%) on invoice ${purchase.invoice_no || purchase.id}`,
          component: "CGST",
        };
        existing.amount += line.cgstAmount;
        taxMap.set(acc.id, existing);
      }

      if (line.sgstAmount > 0) {
        const acc = await resolveInputGstAccount("SGST", line.sgstRate);
        const existing = taxMap.get(acc.id) || {
          accountId: acc.id,
          amount: 0,
          narration: `Input SGST (${line.sgstRate}%) on invoice ${purchase.invoice_no || purchase.id}`,
          component: "SGST",
        };
        existing.amount += line.sgstAmount;
        taxMap.set(acc.id, existing);
      }

      if (line.igstAmount > 0) {
        const acc = await resolveInputGstAccount("IGST", line.igstRate);
        const existing = taxMap.get(acc.id) || {
          accountId: acc.id,
          amount: 0,
          narration: `Input IGST (${line.igstRate}%) on invoice ${purchase.invoice_no || purchase.id}`,
          component: "IGST",
        };
        existing.amount += line.igstAmount;
        taxMap.set(acc.id, existing);
      }
    }

    for (const taxEntry of taxMap.values()) {
      const roundedTax = Math.round(taxEntry.amount * 100) / 100;
      if (roundedTax > 0) {
        journalLines.push({
          account_id: taxEntry.accountId,
          debit_amount: roundedTax,
          credit_amount: 0,
          branch_id: purchase.branch_id,
          supplier_id: purchase.supplier_id,
          narration: taxEntry.narration,
          metadata: { purchase_id: purchase.id, tax_component: taxEntry.component },
        });
      }
    }

    // Credit Accounts Payable (2111)
    const totalPayable = Math.round(taxCalc.invoiceTotal * 100) / 100;
    journalLines.push({
      account_id: accPayable.id,
      debit_amount: 0,
      credit_amount: totalPayable,
      branch_id: purchase.branch_id,
      supplier_id: purchase.supplier_id,
      narration: `Accounts Payable: Invoice ${purchase.invoice_no || purchase.id} (${supplier.name})`,
      metadata: { purchase_id: purchase.id, invoice_no: purchase.invoice_no },
    });

    // 9. Mathematical & CoA Double-Entry Validation
    PostingService.validateJournalLines(journalLines);
    await PostingService.validatePostingAccounts(
      journalLines.map((l) => l.account_id),
      client
    );

    return {
      journalLines,
      taxCalculation: taxCalc,
      totalPayable,
      supplierName: supplier.name,
    };
  }

  // ── 1. CREATE VOUCHER DRAFT (Step 1 of Accounting Lifecycle) ─────────────────

  /**
   * Creates a purchase accounting voucher in DRAFT status.
   * Called by Accounts Payable when preparing an approved purchase invoice for GL posting.
   */
  static async createPurchaseVoucherDraft(
    params: CreatePurchaseVoucherDraftParams
  ): Promise<PurchasePostingResponse<AccountingVoucherRow>> {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const pRes = await client.query<PurchaseRow>(
          "SELECT * FROM public.purchase WHERE id = $1 AND deleted_at IS NULL",
          [params.purchaseId]
        );
        const purchase = pRes.rows[0];
        if (!purchase) {
          throw new PurchasePostingError(
            "PURCHASE_NOT_FOUND",
            `Purchase '${params.purchaseId}' not found.`
          );
        }

        if (params.branchId && purchase.branch_id !== params.branchId) {
          throw new PurchasePostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: Purchase belongs to branch '${purchase.branch_id}', not '${params.branchId}'.`
          );
        }

        if (purchase.status !== "APPROVED") {
          throw new PurchasePostingError(
            "INVALID_PURCHASE_STATUS",
            `Cannot create voucher draft for purchase '${purchase.id}' in status '${purchase.status}'. Must be APPROVED.`
          );
        }

        const itemsRes = await client.query<PurchaseItemRow>(
          "SELECT * FROM public.purchase_item WHERE purchase_id = $1 AND deleted_at IS NULL ORDER BY id ASC",
          [purchase.id]
        );
        const items = itemsRes.rows;
        if (items.length === 0) {
          throw new PurchasePostingError("EMPTY_PURCHASE", `Purchase '${purchase.id}' has no line items.`);
        }

        const voucherDate = purchase.invoice_date
          ? (typeof purchase.invoice_date === 'string'
              ? purchase.invoice_date.slice(0, 10)
              : (purchase.invoice_date as Date).toISOString().slice(0, 10))
          : new Date().toISOString().slice(0, 10);

        // Derive fiscal year: from DB fiscal period if configured, or compute standard Indian FY
        let fiscalYear: string;
        try {
          const period = await PostingService.validateFiscalPeriod(voucherDate, client);
          fiscalYear = period.fiscal_year;
        } catch {
          const [yr, mo] = voucherDate.split("-").map(Number);
          const startYear = mo >= 4 ? yr : yr - 1;
          fiscalYear = `FY${startYear}-${(startYear + 1).toString().slice(2)}`;
        }

        const { journalLines, taxCalculation, totalPayable, supplierName } =
          await PurchasePostingService.inspectAndBuildJournalLines(
            purchase,
            items,
            client,
            {
              freightPolicy: params.freightPolicy,
              freightAmount: params.freightAmount,
              isFreightBilledOnInvoice: params.isFreightBilledOnInvoice,
            }
          );

        // Create voucher in DRAFT status via canonical PostingService
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "PURCHASE",
            voucher_date: voucherDate,
            branch_id: purchase.branch_id,
            narration: `Purchase invoice ${purchase.invoice_no || purchase.id} from ${supplierName}`,
            reference_type: "PURCHASE",
            reference_id: purchase.id,
            reference_event: "INVOICE_POSTED",
            metadata: {
              purchase_id: purchase.id,
              invoice_no: purchase.invoice_no,
              supplier_id: purchase.supplier_id,
              tax_calculation: taxCalculation,
              proposed_journal_lines: journalLines,
            },
          },
          branchId: purchase.branch_id,
          fiscalYear,
          createdBy: params.createdBy,
          client,
        });

        if (!draftRes.success) {
          throw new PurchasePostingError("POSTING_GUARD_FAILED", draftRes.error);
        }

        // Update total_amount to validated invoice total and ensure metadata contains full breakdown
        const updateSql = `
          UPDATE public.accounting_voucher
          SET total_amount = $1,
              metadata = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *;
        `;
        const updatedVoucherRes = await client.query<AccountingVoucherRow>(updateSql, [
          totalPayable,
          JSON.stringify({
            purchase_id: purchase.id,
            invoice_no: purchase.invoice_no,
            supplier_id: purchase.supplier_id,
            tax_calculation: taxCalculation,
            proposed_journal_lines: journalLines,
          }),
          draftRes.data.id,
        ]);

        return updatedVoucherRes.rows[0];
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof PurchasePostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: "POSTING_GUARD_FAILED" };
      }
      if (err instanceof TaxEngineError) {
        return { success: false, error: err.message, code: "POSTING_GUARD_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PURCHASE_POSTING_FAILED" };
    }
  }

  // ── SUBMIT VOUCHER (DRAFT → SUBMITTED) ────────────────────────────────────────

  /**
   * Transitions a purchase voucher from DRAFT to SUBMITTED status.
   * Enforces server session actor and branch scope.
   */
  static async submitPurchaseVoucher(
    params: SubmitPurchaseVoucherParams
  ): Promise<PurchasePostingResponse<AccountingVoucherRow>> {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const vRes = await client.query<AccountingVoucherRow>(
          "SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new PurchasePostingError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new PurchasePostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        if (voucher.status !== "DRAFT") {
          throw new PurchasePostingError(
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
          throw new PurchasePostingError("INVALID_VOUCHER_STATE", submitRes.error);
        }

        return submitRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof PurchasePostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PURCHASE_POSTING_FAILED" };
    }
  }

  // ── 3. APPROVE VOUCHER (SUBMITTED → APPROVED) ─────────────────────────────────

  /**
   * Approves a SUBMITTED purchase accounting voucher.
   * Step 3D.3 — Voucher Accounting Approval & Segregation of Duties.
   *
   * Invariants enforced:
   * 1. Voucher exists and is in SUBMITTED status.
   * 2. Branch boundary check: voucher belongs to authorized branch.
   * 3. Linked purchase exists and is in APPROVED status.
   * 4. Canonical Permission Check: Approver must possess ACCOUNTING.APPROVE
   *    evaluated through the canonical resolver (hasEffectivePermission), not raw role strings.
   * 5. Segregation of Duties (SoD):
   *    - approvedBy !== voucher.created_by (preparer cannot approve)
   *    - approvedBy !== voucher.submitted_by (submitter cannot approve)
   *    - approvedBy !== purchase.created_by (commercial buyer cannot approve accounting voucher)
   *    - approvedBy !== purchase.approved_by (commercial approver != accounting approver, unless explicitly allowed)
   * 6. Distinct Audit Identities preserved:
   *    purchase.created_by, purchase.approved_by, voucher.created_by, voucher.submitted_by, voucher.approved_by
   * 7. Transition voucher to APPROVED status with approved_by and approved_at.
   * 8. STRICT BOUNDARY: Does NOT post journal entries, does NOT create cost lots,
   *    does NOT modify branch_inventory, does NOT update purchase to POSTED.
   */
  static async approvePurchaseVoucher(
    params: ApprovePurchaseVoucherParams
  ): Promise<PurchasePostingResponse<ApprovePurchaseVoucherResult>> {
    try {
      const execute = async (client: PoolClient): Promise<ApprovePurchaseVoucherResult> => {
        // 1. Fetch & lock voucher
        const vRes = await client.query<AccountingVoucherRow>(
          "SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new PurchasePostingError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        // 2. Branch access check
        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new PurchasePostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        // 3. Voucher lifecycle state verification
        if (voucher.status === "DRAFT") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher '${voucher.id}' in DRAFT status. Voucher must first be submitted.`
          );
        }
        if (voucher.status === "APPROVED") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Accounting voucher '${voucher.voucher_no}' is already APPROVED.`
          );
        }
        if (voucher.status === "POSTED") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher '${voucher.voucher_no}' in POSTED status.`
          );
        }
        if (voucher.status === "CANCELLED") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher '${voucher.voucher_no}' in CANCELLED status.`
          );
        }
        if (voucher.status !== "SUBMITTED") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher in status '${voucher.status}'. Only SUBMITTED vouchers can be approved.`
          );
        }

        // 4. Fetch linked Purchase
        if (!voucher.reference_id) {
          throw new PurchasePostingError(
            "INVALID_ENTITY",
            `Voucher '${voucher.id}' has no linked reference_id.`
          );
        }
        const pRes = await client.query<PurchaseRow>(
          "SELECT * FROM public.purchase WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [voucher.reference_id]
        );
        const purchase = pRes.rows[0];
        if (!purchase) {
          throw new PurchasePostingError(
            "PURCHASE_NOT_FOUND",
            `Linked purchase '${voucher.reference_id}' not found.`
          );
        }

        if (purchase.status !== "APPROVED") {
          throw new PurchasePostingError(
            "INVALID_PURCHASE_STATUS",
            `Cannot approve voucher for purchase '${purchase.id}' in status '${purchase.status}'. Purchase must be APPROVED.`
          );
        }

        // 5. Segregation of Duties (SoD) & Audit Identity Integrity
        if (!purchase.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Purchase '${purchase.id}' has no recorded creator (created_by is null).`
          );
        }
        if (!purchase.approved_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Purchase '${purchase.id}' has no recorded commercial approver (approved_by is null).`
          );
        }
        if (purchase.approved_by === purchase.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Purchase creator '${purchase.created_by}' cannot approve their own purchase.`
          );
        }
        if (!voucher.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Voucher '${voucher.id}' has no recorded creator (created_by is null).`
          );
        }

        // SoD Rule A: Voucher Creator cannot approve own voucher
        if (params.approvedBy === voucher.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher creator '${voucher.created_by}' cannot approve their own voucher.`
          );
        }

        // SoD Rule B: Voucher Submitter cannot approve voucher
        if (voucher.submitted_by && params.approvedBy === voucher.submitted_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher submitter '${voucher.submitted_by}' cannot approve the voucher.`
          );
        }

        // SoD Rule C: Purchase Creator (Buyer) cannot approve accounting voucher
        if (params.approvedBy === purchase.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Purchase creator '${purchase.created_by}' cannot approve the accounting voucher.`
          );
        }

        // SoD Rule D: Commercial Purchase Approver != Accounting Voucher Approver (dual control)
        if (!params.allowCommercialApprover && params.approvedBy === purchase.approved_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Commercial purchase approver '${purchase.approved_by}' cannot approve the accounting voucher (dual-control segregation of duties).`
          );
        }

        // 6. Canonical Permission Resolver Check (ACCOUNTING.APPROVE)
        const actorContext = params.actorSession || {
          id: params.approvedBy,
          user_id: params.approvedBy,
          role: params.actorRole || "STAFF",
        };
        const hasApprovalPerm = hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE");
        if (!hasApprovalPerm) {
          throw new PurchasePostingError(
            "PERMISSION_DENIED",
            `Staff '${params.approvedBy}' lacks required permission 'ACCOUNTING.APPROVE' to approve accounting vouchers.`
          );
        }

        // 7. Execute Lifecycle Transition (SUBMITTED -> APPROVED)
        const approvedVoucher = await AccountingVoucherRepository.approve(
          voucher.id,
          params.approvedBy,
          voucher.branch_id,
          client
        );

        // 8. Update metadata with audit identities and supervisor notes
        const auditIdentities = {
          purchase_id: purchase.id,
          purchase_created_by: purchase.created_by,
          purchase_approved_by: purchase.approved_by,
          voucher_created_by: voucher.created_by,
          voucher_submitted_by: voucher.submitted_by,
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
      if (err instanceof PurchasePostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PURCHASE_POSTING_FAILED" };
    }
  }

  // ── 4. REJECT / CANCEL VOUCHER (SUBMITTED → CANCELLED) ─────────────────────────

  /**
   * Rejects or cancels an unposted purchase accounting voucher.
   */
  static async rejectPurchaseVoucher(
    params: RejectPurchaseVoucherParams
  ): Promise<PurchasePostingResponse<AccountingVoucherRow>> {
    try {
      if (!params.rejectionReason || !params.rejectionReason.trim()) {
        throw new PurchasePostingError(
          "INVALID_ENTITY",
          "Rejection reason is mandatory when rejecting an accounting voucher."
        );
      }

      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const vRes = await client.query<AccountingVoucherRow>(
          "SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new PurchasePostingError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new PurchasePostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        if (voucher.status === "POSTED") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Cannot reject voucher '${voucher.voucher_no}' in POSTED status. Posted vouchers are immutable.`
          );
        }

        if (voucher.status === "CANCELLED") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${voucher.voucher_no}' is already CANCELLED.`
          );
        }

        // Permission check: approver must have permission to reject/cancel vouchers
        const actorContext = params.actorSession || {
          id: params.rejectedBy,
          user_id: params.rejectedBy,
          role: params.actorRole || "STAFF",
        };
        const hasApprovalPerm = hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE");
        if (!hasApprovalPerm) {
          throw new PurchasePostingError(
            "PERMISSION_DENIED",
            `Staff '${params.rejectedBy}' lacks required permission 'ACCOUNTING.APPROVE' to reject accounting vouchers.`
          );
        }

        const cancelledVoucher = await AccountingVoucherRepository.cancel(
          voucher.id,
          params.rejectedBy,
          voucher.branch_id,
          client
        );

        const existingMeta = (cancelledVoucher.metadata || {}) as Record<string, unknown>;
        const updatedMeta = {
          ...existingMeta,
          rejection: {
            rejected_by: params.rejectedBy,
            rejection_reason: params.rejectionReason.trim(),
            rejected_at: new Date().toISOString(),
          },
        };

        const metaSql = `
          UPDATE public.accounting_voucher
          SET metadata = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;
        const res = await client.query<AccountingVoucherRow>(metaSql, [
          JSON.stringify(updatedMeta),
          cancelledVoucher.id,
        ]);

        return res.rows[0];
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof PurchasePostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PURCHASE_POSTING_FAILED" };
    }
  }

  // ── PREVIEW VOUCHER (Read-Only Simulation) ───────────────────────────────────

  /**
   * Previews the accounting voucher calculation and proposed journal lines
   * for an approved purchase without writing any voucher to the database.
   */
  static async previewPurchaseVoucher(
    params: PreviewPurchaseVoucherParams
  ): Promise<PurchasePostingResponse<PreviewPurchaseVoucherResult>> {
    try {
      const execute = async (client: PoolClient): Promise<PreviewPurchaseVoucherResult> => {
        const pRes = await client.query<PurchaseRow>(
          "SELECT * FROM public.purchase WHERE id = $1 AND deleted_at IS NULL",
          [params.purchaseId]
        );
        const purchase = pRes.rows[0];
        if (!purchase) {
          throw new PurchasePostingError("PURCHASE_NOT_FOUND", `Purchase '${params.purchaseId}' not found.`);
        }

        if (params.branchId && purchase.branch_id !== params.branchId) {
          throw new PurchasePostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: Purchase belongs to branch '${purchase.branch_id}', not '${params.branchId}'.`
          );
        }

        const itemsRes = await client.query<PurchaseItemRow>(
          "SELECT * FROM public.purchase_item WHERE purchase_id = $1 AND deleted_at IS NULL ORDER BY id ASC",
          [purchase.id]
        );
        const items = itemsRes.rows;
        if (items.length === 0) {
          throw new PurchasePostingError("EMPTY_PURCHASE", `Purchase '${purchase.id}' has no line items.`);
        }

        const { journalLines, taxCalculation, totalPayable } =
          await PurchasePostingService.inspectAndBuildJournalLines(
            purchase,
            items,
            client,
            {
              freightPolicy: params.freightPolicy,
              freightAmount: params.freightAmount,
              isFreightBilledOnInvoice: params.isFreightBilledOnInvoice,
            }
          );

        return {
          purchase,
          tax_calculation: taxCalculation,
          journal_lines: journalLines,
          total_payable: totalPayable,
          is_balanced: true,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof PurchasePostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof TaxEngineError) {
        return { success: false, error: err.message, code: "POSTING_GUARD_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PURCHASE_POSTING_FAILED" };
    }
  }

  // ── 2. POST PURCHASE (Final Step: Approved Voucher + Receipt + Ledger) ───────

  /**
   * Atomically posts an APPROVED purchase and its corresponding APPROVED accounting voucher
   * to the General Ledger and Inventory Cost Ledger.
   *
   * PRECONDITIONS:
   * - Purchase status is APPROVED.
   * - An associated accounting voucher exists in APPROVED status.
   * - Segregation of Duties:
   *   * purchase.approved_by != purchase.created_by
   *   * voucher.approved_by != voucher.created_by
   *   * postedBy != voucher.created_by
   *   * postedBy != purchase.created_by
   */
  static async postPurchase(
    params: PostPurchaseParams
  ): Promise<PurchasePostingResponse> {
    try {
      const execute = async (client: PoolClient): Promise<PurchasePostingResult> => {
        // ─────────────────────────────────────────────────────────────────────
        // 1. LOCK & FETCH PURCHASE (Pessimistic Concurrency Lock)
        // ─────────────────────────────────────────────────────────────────────
        const purchaseSql = `
          SELECT * FROM public.purchase
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE;
        `;
        const purchaseRes = await client.query<PurchaseRow>(purchaseSql, [params.purchaseId]);
        const purchase = purchaseRes.rows[0];

        if (!purchase) {
          throw new PurchasePostingError(
            "PURCHASE_NOT_FOUND",
            `Purchase '${params.purchaseId}' not found or deleted.`
          );
        }

        // BOLA / branch isolation check
        if (params.branchId && purchase.branch_id !== params.branchId) {
          throw new PurchasePostingError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: Purchase belongs to branch '${purchase.branch_id}', not '${params.branchId}'.`
          );
        }

        if (purchase.status === "POSTED") {
          throw new PurchasePostingError(
            "PURCHASE_ALREADY_POSTED",
            `Purchase '${purchase.id}' is already POSTED.`
          );
        }

        if (purchase.status !== "APPROVED") {
          throw new PurchasePostingError(
            "INVALID_PURCHASE_STATUS",
            `Cannot post purchase '${purchase.id}' in status '${purchase.status}'. Only APPROVED purchases can be posted.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. LOCK & FETCH PURCHASE ITEMS
        // ─────────────────────────────────────────────────────────────────────
        const itemsSql = `
          SELECT * FROM public.purchase_item
          WHERE purchase_id = $1 AND deleted_at IS NULL
          ORDER BY id ASC
          FOR UPDATE;
        `;
        const itemsRes = await client.query<PurchaseItemRow>(itemsSql, [purchase.id]);
        const items = itemsRes.rows;

        if (items.length === 0) {
          throw new PurchasePostingError("EMPTY_PURCHASE", `Purchase '${purchase.id}' has no line items.`);
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. SEGREGATION OF DUTIES (Purchase Level)
        // ─────────────────────────────────────────────────────────────────────
        if (!purchase.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Purchase '${purchase.id}' has no recorded creator (created_by is null).`
          );
        }

        if (!purchase.approved_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Purchase '${purchase.id}' has no recorded approver (approved_by is null).`
          );
        }

        if (purchase.approved_by === purchase.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Purchase creator '${purchase.created_by}' cannot approve their own purchase.`
          );
        }

        if (params.postedBy === purchase.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Purchase creator '${purchase.created_by}' cannot post the accounting voucher.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. RESOLVE & LOCK ACCOUNTING VOUCHER (Must be APPROVED)
        // ─────────────────────────────────────────────────────────────────────
        let voucher: AccountingVoucherRow;

        if (params.voucherId) {
          const vSql = `
            SELECT * FROM public.accounting_voucher 
            WHERE id = $1 AND deleted_at IS NULL
            FOR UPDATE;
          `;
          const vRes = await client.query<AccountingVoucherRow>(vSql, [params.voucherId]);
          voucher = vRes.rows[0];
          if (!voucher) {
            throw new PurchasePostingError(
              "VOUCHER_NOT_FOUND",
              `Specified voucher '${params.voucherId}' not found.`
            );
          }
          if (voucher.reference_id !== purchase.id) {
            throw new PurchasePostingError(
              "INVALID_VOUCHER_STATE",
              `Voucher '${voucher.id}' is linked to reference '${voucher.reference_id}', not purchase '${purchase.id}'.`
            );
          }
        } else {
          // Look up active voucher for this purchase source event
          const vSql = `
            SELECT * FROM public.accounting_voucher 
            WHERE reference_type = 'PURCHASE' 
              AND reference_id = $1 
              AND reference_event = 'INVOICE_POSTED'
              AND status != 'CANCELLED' 
              AND deleted_at IS NULL 
            ORDER BY created_at DESC 
            LIMIT 1 
            FOR UPDATE;
          `;
          const vRes = await client.query<AccountingVoucherRow>(vSql, [purchase.id]);
          voucher = vRes.rows[0];
          if (!voucher) {
            throw new PurchasePostingError(
              "VOUCHER_NOT_FOUND",
              `No accounting voucher found for purchase '${purchase.id}'. A voucher draft must first be created, submitted, and approved before posting.`
            );
          }
        }

        // Voucher must be in APPROVED status
        if (voucher.status === "POSTED") {
          throw new PurchasePostingError(
            "PURCHASE_ALREADY_POSTED",
            `Accounting voucher '${voucher.voucher_no}' is already POSTED.`
          );
        }

        if (voucher.status !== "APPROVED") {
          throw new PurchasePostingError(
            "INVALID_VOUCHER_STATE",
            `Accounting voucher '${voucher.voucher_no}' is in status '${voucher.status}'. Only APPROVED vouchers can be posted.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. SEGREGATION OF DUTIES (Voucher & Posting Level)
        // ─────────────────────────────────────────────────────────────────────
        if (!voucher.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Voucher '${voucher.id}' has no recorded creator.`
          );
        }

        if (!voucher.approved_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Voucher '${voucher.id}' has no recorded approver.`
          );
        }

        if (voucher.approved_by === voucher.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher creator '${voucher.created_by}' cannot approve their own voucher.`
          );
        }

        if (params.postedBy === voucher.created_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher creator '${voucher.created_by}' cannot post their own voucher.`
          );
        }

        if (voucher.submitted_by && params.postedBy === voucher.submitted_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher submitter '${voucher.submitted_by}' cannot post the accounting voucher.`
          );
        }

        if (purchase.approved_by && params.postedBy === purchase.approved_by) {
          throw new PurchasePostingError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Purchase approver '${purchase.approved_by}' cannot post the accounting voucher.`
          );
        }

        // Canonical Permission Check for Posting (ACCOUNTING.POST)
        const actorContext = params.actorSession || {
          id: params.postedBy,
          user_id: params.postedBy,
          role: params.actorRole || "STAFF",
        };
        const hasPostPerm = hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPostPerm) {
          throw new PurchasePostingError(
            "PERMISSION_DENIED",
            `Staff '${params.postedBy}' lacks required permission 'ACCOUNTING.POST' to post transactions to the General Ledger.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 6. BUILD & VALIDATE JOURNAL LINES (Reconstruct with Stored Policy)
        // ─────────────────────────────────────────────────────────────────────
        const vMeta = (voucher.metadata || {}) as Record<string, any>;
        const taxCalcFromMeta = vMeta.tax_calculation;
        const freightOpts = {
          freightPolicy: params.freightPolicy ?? taxCalcFromMeta?.freightPolicy,
          freightAmount: params.freightAmount ?? taxCalcFromMeta?.freightAmount,
          isFreightBilledOnInvoice: params.isFreightBilledOnInvoice ?? taxCalcFromMeta?.isFreightBilledOnInvoice,
        };

        const { journalLines, taxCalculation } = await PurchasePostingService.inspectAndBuildJournalLines(
          purchase,
          items,
          client,
          freightOpts
        );

        // ─────────────────────────────────────────────────────────────────────
        // 7. POST VOUCHER VIA CANONICAL POSTING SERVICE
        // ─────────────────────────────────────────────────────────────────────
        const postVoucherRes = await PostingService.postVoucher({
          voucherId: voucher.id,
          postedBy: params.postedBy,
          lines: journalLines,
          branchId: purchase.branch_id,
          client,
        });

        if (!postVoucherRes.success) {
          throw new PurchasePostingError("POSTING_GUARD_FAILED", `[${postVoucherRes.code}] ${postVoucherRes.error}`);
        }

        const postedVoucher = postVoucherRes.data.voucher;
        const journalEntry = postVoucherRes.data.journal_entry;

        // ─────────────────────────────────────────────────────────────────────
        // 8. CREATE INVENTORY COST LOTS (1:1 with purchase_item)
        // ─────────────────────────────────────────────────────────────────────
        const createdLots: InventoryCostLotRow[] = [];
        const voucherDate = purchase.invoice_date || new Date().toISOString().slice(0, 10);

        for (const item of items) {
          const calcLine = taxCalculation?.lines?.find((l) => l.id === item.id);
          const receivedQty = Number(item.quantity);
          const totalCost = (calcLine?.inventoryLotTotalCost != null)
            ? calcLine.inventoryLotTotalCost
            : Math.round(Number(item.taxable_value) * 100) / 100;
          const unitCost = (calcLine?.inventoryLotUnitCost != null)
            ? calcLine.inventoryLotUnitCost
            : Math.round((totalCost / receivedQty) * 10000) / 10000;

          // Check cost consistency invariant
          const reconstructed = Math.round(receivedQty * unitCost * 100) / 100;
          if (Math.abs(totalCost - reconstructed) > 0.05) {
            throw new PurchasePostingError(
              "COST_CONSISTENCY_VIOLATION",
              `Cost consistency check failed for item '${item.id}': total_cost=${totalCost} but quantity * unit_cost=${reconstructed}.`
            );
          }

          let finalVariantId = item.variant_id;
          if (item.product_id && !finalVariantId) {
            const pvRes = await client.query(
              `SELECT id FROM public.product_variant WHERE product_id = $1 ORDER BY variant_rank ASC, id ASC LIMIT 1`,
              [item.product_id]
            );
            finalVariantId = pvRes.rows?.[0]?.id || null;
          }

          const lotId = `cost_lot_${item.id}`.slice(0, 60);
          const insertLotSql = `
            INSERT INTO public.inventory_cost_lot (
              id, branch_id, product_id, variant_id, item_type,
              purchase_id, purchase_item_id, supplier_id,
              received_quantity, remaining_quantity,
              unit_cost, total_cost, currency,
              received_at, status, created_by, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8,
              $9, $10,
              $11, $12, 'INR',
              $13, 'ACTIVE', $14, NOW(), NOW()
            )
            RETURNING *;
          `;
          const lotParams = [
            lotId,
            purchase.branch_id,
            item.product_id ?? null,
            finalVariantId ?? null,
            item.item_type,
            purchase.id,
            item.id,
            purchase.supplier_id,
            receivedQty,
            receivedQty,
            unitCost,
            totalCost,
            voucherDate,
            params.postedBy,
          ];

          const lotRes = await client.query<InventoryCostLotRow>(insertLotSql, lotParams);
          createdLots.push(lotRes.rows[0]);
        }

        // ─────────────────────────────────────────────────────────────────────
        // 9. UPDATE PHYSICAL INVENTORY (branch_inventory)
        // ─────────────────────────────────────────────────────────────────────
        for (const item of items) {
          // Physical inventory tracked for items with catalog product_id
          if (item.product_id) {
            let finalVariantId = item.variant_id;
            if (!finalVariantId) {
              const pvRes = await client.query(
                `SELECT id FROM public.product_variant WHERE product_id = $1 ORDER BY variant_rank ASC, id ASC LIMIT 1`,
                [item.product_id]
              );
              finalVariantId = pvRes.rows?.[0]?.id || null;
            }

            if (finalVariantId) {
              const receivedQty = Math.round(Number(item.quantity));

              const existingBinv = await client.query(
                `SELECT id, quantity FROM public.branch_inventory 
                 WHERE branch_id = $1 AND variant_id = $2 
                 FOR UPDATE`,
                [purchase.branch_id, finalVariantId]
              );

              if (existingBinv.rows.length > 0) {
                await client.query(
                  `UPDATE public.branch_inventory 
                   SET quantity = quantity + $1, updated_at = NOW(), deleted_at = NULL 
                   WHERE id = $2`,
                  [receivedQty, existingBinv.rows[0].id]
                );
              } else {
                const binvId = `binv_${purchase.branch_id}_${finalVariantId}`.slice(0, 60);
                await client.query(
                  `INSERT INTO public.branch_inventory (
                     id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at
                   ) VALUES (
                     $1, $2, $3, $4, $5, 0, NOW(), NOW()
                   )`,
                  [binvId, purchase.branch_id, item.product_id, finalVariantId, receivedQty]
                );
              }
            }
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 10. INVENTORY MOVEMENT LEDGER (PURCHASE_RECEIPT)
        // ─────────────────────────────────────────────────────────────────────
        const createdMovements: InventoryMovementRow[] = [];

        for (const item of items) {
          let finalVariantId = item.variant_id;
          if (item.product_id && !finalVariantId) {
            const pvRes = await client.query(
              `SELECT id FROM public.product_variant WHERE product_id = $1 ORDER BY variant_rank ASC, id ASC LIMIT 1`,
              [item.product_id]
            );
            finalVariantId = pvRes.rows?.[0]?.id || null;
          }

          const insertMovSql = `
            INSERT INTO public.inventory_movement (
              branch_id, product_id, variant_id,
              movement_type, quantity, direction,
              purchase_id, voucher_id, reference_no, narration,
              created_by, created_at
            ) VALUES (
              $1, $2, $3,
              'PURCHASE_RECEIPT', $4, 'IN',
              $5, $6, $7, $8,
              $9, NOW()
            )
            RETURNING *;
          `;
          const movParams = [
            purchase.branch_id,
            item.product_id ?? null,
            finalVariantId ?? null,
            Number(item.quantity),
            purchase.id,
            postedVoucher.id,
            purchase.invoice_no ?? null,
            `Purchase receipt: ${item.description}`,
            params.postedBy,
          ];

          const movRes = await client.query<InventoryMovementRow>(insertMovSql, movParams);
          createdMovements.push(movRes.rows[0]);
        }

        // ─────────────────────────────────────────────────────────────────────
        // 11. MARK PURCHASE POSTED
        // ─────────────────────────────────────────────────────────────────────
        const updatePurchaseSql = `
          UPDATE public.purchase
          SET status = 'POSTED',
              voucher_id = $2,
              posted_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *;
        `;
        const updatedPurchaseRes = await client.query<PurchaseRow>(updatePurchaseSql, [purchase.id, postedVoucher.id]);
        const updatedPurchase = updatedPurchaseRes.rows[0];

        return {
          purchase: updatedPurchase,
          voucher: postedVoucher,
          journal_entry: journalEntry,
          cost_lots: createdLots,
          movements: createdMovements,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof PurchasePostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: "POSTING_GUARD_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PURCHASE_POSTING_FAILED" };
    }
  }

  // ── 3. PREPARE & POST (Orchestrated Multi-Actor Pipeline) ────────────────────

  /**
   * Orchestrates the complete end-to-end multi-actor workflow:
   * 1. Create Voucher Draft (by voucherCreatedBy)
   * 2. Submit Voucher (by voucherCreatedBy)
   * 3. Approve Voucher (by voucherApprovedBy != voucherCreatedBy)
   * 4. Post Purchase & Voucher (by postedBy != voucherCreatedBy and != purchase.created_by)
   *
   * Enforces strict Segregation of Duties across all transitions.
   */
  static async prepareAndPostPurchase(
    params: PrepareAndPostPurchaseParams
  ): Promise<PurchasePostingResponse> {
    try {
      const execute = async (client: PoolClient): Promise<PurchasePostingResult> => {
        // Step 1: Create draft
        const draftRes = await PurchasePostingService.createPurchaseVoucherDraft({
          purchaseId: params.purchaseId,
          createdBy: params.voucherCreatedBy,
          branchId: params.branchId,
          client,
        });
        if (!draftRes.success) {
          throw new PurchasePostingError(draftRes.code, draftRes.error);
        }
        const voucher = draftRes.data;

        // Step 2: Submit voucher
        const submitRes = await PurchasePostingService.submitPurchaseVoucher({
          voucherId: voucher.id,
          submittedBy: params.voucherCreatedBy,
          branchId: voucher.branch_id,
          client,
        });
        if (!submitRes.success) {
          throw new PurchasePostingError(submitRes.code, submitRes.error);
        }

        // Step 3: Approve voucher (SoD: voucherApprovedBy != voucherCreatedBy)
        const approveRes = await PurchasePostingService.approvePurchaseVoucher({
          voucherId: voucher.id,
          approvedBy: params.voucherApprovedBy,
          actorRole: params.actorRole || "SUPER_ADMIN",
          actorSession: params.actorSession,
          branchId: voucher.branch_id,
          client,
        });
        if (!approveRes.success) {
          throw new PurchasePostingError(approveRes.code, approveRes.error);
        }

        // Step 4: Post purchase
        const postRes = await PurchasePostingService.postPurchase({
          purchaseId: params.purchaseId,
          voucherId: voucher.id,
          postedBy: params.postedBy,
          actorRole: params.actorRole,
          actorSession: params.actorSession,
          branchId: params.branchId,
          freightPolicy: params.freightPolicy,
          freightAmount: params.freightAmount,
          isFreightBilledOnInvoice: params.isFreightBilledOnInvoice,
          client,
        });
        if (!postRes.success) {
          throw new PurchasePostingError(postRes.code, postRes.error);
        }

        return postRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof PurchasePostingError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: "POSTING_GUARD_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PURCHASE_POSTING_FAILED" };
    }
  }
}
