/**
 * CakeToHome ERP — Sales Return, Credit Note & Customer Refund Service
 * Phase 4F Step 4.6: Canonical Sales Return Lifecycle, Credit Notes, AR Adjustment & Customer Refunds
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. ONLY POSTED SALES ORDERS CAN RECEIVE RETURNS:
 *    - Rejects unposted orders with ORDER_NOT_POSTED.
 *    - Rejects quarantined legacy prototype orders with LEGACY_PROTOTYPE_ORDER_REJECTED.
 * 2. MERCHANDISE RETURN POLICIES:
 *    - CAKES (Perishable Food): Under FSSAI regulations, returned cakes CANNOT be restocked.
 *      Physical inventory (branch_inventory) and cost lots (inventory_cost_lot) are NEVER incremented.
 *      COGS is NOT reversed to inventory (cake was destroyed/consumed, representing operational loss).
 *      Attempting to restock cakes fails closed with PERISHABLE_CAKE_RESTOCK_PROHIBITED.
 *    - ACCESSORIES (Non-Perishable Merchandise): When returned in re-salable condition,
 *      physical stock (branch_inventory) is incremented.
 *      Eligible cost lots are traced via original inventory_cost_consumption and reinstated in reverse FIFO order.
 *      COGS is reversed: Dr 1131 (Accessories Inventory) / Cr 5120 (COGS - Accessories).
 *      Inserts inventory_movement: movement_type = 'SALES_RETURN', direction = 'IN'.
 *    - PACKAGING (Supplies): Consumable sanitary boxes/bags are NEVER restocked; COGS is never reversed.
 * 3. AUTHORITATIVE DOUBLE-ENTRY CREDIT NOTE CONSTRUCTION:
 *    - Dr 4190 Sales Returns, Refunds & Allowances (for taxable base of returned goods).
 *    - Dr 2121–2129 Output GST Accounts (exact reversal of output tax liability).
 *    - Cr 1121 Accounts Receivable (Prepaid) or 1122 Undeposited COD (COD).
 *    - Invariant: sum(Debits) === sum(Credits) === grossCreditNoteAmount.
 * 4. AUTHORITATIVE AR & CUSTOMER REFUND EQUATION:
 *    - Net Invoiced = sum(Sales) - sum(Credit Notes).
 *    - Net Paid = sum(Receipts) - sum(Refunds).
 *    - Open AR = max(0, Net Invoiced - Net Paid).
 *    - Max Refundable = max(0, Net Paid - Net Invoiced).
 *    - Over-refund requests reject with REFUND_EXCEEDS_NET_PAID.
 * 5. CUSTOMER REFUND DISBURSEMENT VOUCHER (voucher_type = 'PAYMENT'):
 *    - Dr 1121 Accounts Receivable (clearing credit balance on AR).
 *    - Cr 1113 Gateway Clearing (Gateway) OR Cr 1111 Cash in Hand (Cash) OR Cr 1112 Bank Operating A/c (Bank).
 *    - Mutates payment_transaction.status to 'refunded' or 'partially_refunded'.
 * 6. SEGREGATION OF DUTIES (SoD) & SECURITY:
 *    - Preparer !== Approver !== Poster !== Customer.
 *    - Super Admin cannot bypass SoD restrictions.
 *    - Branch scoping enforced via canonical BOLA verification.
 * 7. SOURCE IDEMPOTENCY:
 *    - Reference type 'ORDER_RETURN' / 'CUSTOMER_REFUND'.
 *    - Partial unique index on (reference_type, reference_id, reference_event) blocks duplicates.
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { PostingService, PostingServiceError } from "./posting.service";
import { CustomerReceiptService } from "./customer-receipt.service";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  AccountingVoucherRow,
  AccountingAccountRow,
  InventoryMovementRow,
  JournalLineInput,
  CreateSalesReturnDraftParams,
  SubmitSalesReturnParams,
  ApproveSalesReturnParams,
  PostCreditNoteParams,
  PostCustomerRefundParams,
  SalesReturnResult,
  CustomerRefundResult,
} from "../types/accounting.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type SalesReturnErrorCode =
  | "ORDER_NOT_FOUND"
  | "EMPTY_ORDER"
  | "INVALID_ORDER_STATUS"
  | "ORDER_NOT_POSTED"
  | "LEGACY_PROTOTYPE_ORDER_REJECTED"
  | "BRANCH_ACCESS_DENIED"
  | "EMPTY_RETURN"
  | "INVALID_RETURN_QUANTITY"
  | "OVER_RETURN_NOT_PERMITTED"
  | "RETURN_EXCEEDS_FULFILLED_QUANTITY"
  | "ITEM_NOT_FOUND"
  | "PERISHABLE_CAKE_RESTOCK_PROHIBITED"
  | "PACKAGING_RESTOCK_PROHIBITED"
  | "TAX_REVERSAL_DATA_UNAVAILABLE"
  | "ACCOUNT_RESOLUTION_FAILED"
  | "VOUCHER_NOT_FOUND"
  | "INVALID_VOUCHER_STATE"
  | "PERMISSION_DENIED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "DUPLICATE_SOURCE_EVENT"
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "POSTING_BEFORE_ACCOUNTING_START_DATE"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "FISCAL_PERIOD_LOCKED"
  | "REFUND_NOT_ELIGIBLE"
  | "REFUND_EXCEEDS_NET_PAID"
  | "INVALID_AMOUNT"
  | "COST_CONSISTENCY_VIOLATION"
  | "SALES_RETURN_FAILED";

export class SalesReturnError extends Error {
  readonly code: SalesReturnErrorCode;

  constructor(code: SalesReturnErrorCode, message: string) {
    super(message);
    this.name = "SalesReturnError";
    this.code = code;
  }
}

// ─── Helper Types ─────────────────────────────────────────────────────────────

interface ResolvedReturnLine {
  productId: string;
  variantId: string | null;
  title: string;
  merchandiseType: "CAKE" | "ACCESSORY" | "PACKAGING";
  quantity: number;
  effectiveUnitPrice: number;
  taxRatePercent: number;
  taxableBase: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  grossAmount: number;
  cgstAccountCode: string | null;
  sgstAccountCode: string | null;
  igstAccountCode: string | null;
  isResalable: boolean;
  costLotsToRestore: Array<{
    lotId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  totalRestoredCost: number;
}

// ─── SalesReturnService Implementation ────────────────────────────────────────

export class SalesReturnService {

  // ── 1. CREATE SALES RETURN DRAFT (CREDIT NOTE DRAFT) ─────────────────────────

  /**
   * Constructs an accounting voucher in DRAFT status of type CREDIT_NOTE.
   * Calculates item taxable base reversal, GST reversal, AR reduction, and accessory COGS reversal.
   */
  static async createSalesReturnDraft(
    params: CreateSalesReturnDraftParams
  ): Promise<
    | { success: true; data: AccountingVoucherRow }
    | { success: false; error: string; code: SalesReturnErrorCode }
  > {
    try {
      if (!Array.isArray(params.items) || params.items.length === 0) {
        throw new SalesReturnError("INVALID_RETURN_QUANTITY", "Return items list cannot be empty.");
      }

      for (const item of params.items) {
        if (typeof item.quantity !== "number" || isNaN(item.quantity) || item.quantity <= 0) {
          throw new SalesReturnError(
            "INVALID_RETURN_QUANTITY",
            `Return quantity for product '${item.productId || item.variantId}' must be a positive number. Got '${item.quantity}'.`
          );
        }
      }

      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        // ─────────────────────────────────────────────────────────────────────
        // 1. Lock & Fetch Source Order
        // ─────────────────────────────────────────────────────────────────────
        const oSql = `
          SELECT * FROM public."order"
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE;
        `;
        const oRes = await client.query(oSql, [params.orderId]);
        const order = oRes.rows[0];

        if (!order) {
          throw new SalesReturnError("ORDER_NOT_FOUND", `Order '${params.orderId}' not found.`);
        }

        const meta = (order.metadata || {}) as Record<string, any>;

        // Quarantine check 1: Fail closed on legacy prototype data
        if (meta.legacy_prototype === true || meta.is_prototype === true) {
          throw new SalesReturnError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Order '${params.orderId}' is quarantined legacy prototype data. Credit notes cannot be created.`
          );
        }

        // Quarantine check 2: Ledger eligibility check
        if (meta.is_ledger_eligible !== true && meta.is_ledger_eligible !== "true") {
          throw new SalesReturnError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Order '${params.orderId}' is not ledger-eligible. Missing verified commercial status.`
          );
        }

        if (order.status === "cancelled" || order.status === "canceled") {
          throw new SalesReturnError(
            "INVALID_ORDER_STATUS",
            `Order '${params.orderId}' is cancelled. Cannot create return against cancelled order.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. Verify Posted Sales Voucher
        // ─────────────────────────────────────────────────────────────────────
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher 
           WHERE ((reference_type = 'SALE' AND reference_id = $1) OR metadata->>'order_id' = $1)
             AND voucher_type = 'SALES'
             AND status = 'POSTED'
             AND deleted_at IS NULL
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE;`,
          [params.orderId]
        );
        const salesVoucher = vRes.rows[0];
        if (!salesVoucher) {
          throw new SalesReturnError(
            "ORDER_NOT_POSTED",
            `Order '${params.orderId}' has not been posted to the General Ledger. Cannot return unposted order.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Branch Verification (BOLA defense)
        // ─────────────────────────────────────────────────────────────────────
        const effectiveBranchId = salesVoucher.branch_id || order.branch_id || meta.branch_id;
        if (params.branchId && params.branchId !== effectiveBranchId) {
          throw new SalesReturnError(
            "BRANCH_ACCESS_DENIED",
            `Branch mismatch: Order belongs to branch '${effectiveBranchId}', not '${params.branchId}'.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. Resolve Order Line Items & Fulfillment History
        // ─────────────────────────────────────────────────────────────────────
        const rawOrderItems: any[] = Array.isArray(meta.items) ? meta.items : [];
        if (rawOrderItems.length === 0) {
          throw new SalesReturnError("EMPTY_ORDER", `Order '${params.orderId}' has no line items in metadata.`);
        }

        // Query previously posted credit notes to track cumulative returned quantities
        const prevCnSql = `
          SELECT metadata->'items' AS returned_items
          FROM public.accounting_voucher
          WHERE voucher_type = 'CREDIT_NOTE'
            AND status = 'POSTED'
            AND deleted_at IS NULL
            AND (
              (reference_type IN ('ORDER', 'ORDER_RETURN') AND reference_id = $1)
              OR (metadata->>'order_id' = $1)
              OR (reversal_of_voucher_id = $2)
            );
        `;
        const prevCnRes = await client.query(prevCnSql, [params.orderId, salesVoucher.id]);
        const cumulativeReturnedMap = new Map<string, number>();

        for (const row of prevCnRes.rows) {
          const items = Array.isArray(row.returned_items) ? row.returned_items : [];
          for (const item of items) {
            const pId = item.productId || item.product_id;
            if (pId) {
              const current = cumulativeReturnedMap.get(pId) || 0;
              cumulativeReturnedMap.set(pId, current + Number(item.quantity || 0));
            }
          }
        }

        // Also query inventory_cost_consumption for accessory lot traceability
        const iccSql = `
          SELECT 
            icc.id AS consumption_id,
            icc.lot_id,
            icc.quantity AS consumed_quantity,
            icc.unit_cost,
            icc.total_cost,
            icl.product_id,
            icl.variant_id,
            icl.remaining_quantity,
            icl.received_quantity
          FROM public.inventory_cost_consumption icc
          JOIN public.inventory_movement im ON im.id = icc.movement_id
          JOIN public.inventory_cost_lot icl ON icl.id = icc.lot_id
          WHERE im.order_id = $1 
            AND im.movement_type = 'SALES_FULFILLMENT'
          ORDER BY icl.received_at DESC, icl.id DESC;
        `;
        const iccRes = await client.query(iccSql, [params.orderId]);
        const consumptionsByProduct = new Map<string, typeof iccRes.rows>();
        for (const row of iccRes.rows) {
          const list = consumptionsByProduct.get(row.product_id) || [];
          list.push(row);
          consumptionsByProduct.set(row.product_id, list);
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. Resolve and Validate Each Return Item
        // ─────────────────────────────────────────────────────────────────────
        const ordMeta = (order.metadata || {}) as Record<string, any>;
        const deliveryAddress = ordMeta.delivery_address || ordMeta.delivery?.address || {};
        const customerState = typeof deliveryAddress === "string" ? deliveryAddress : (deliveryAddress.state || ordMeta.state || ordMeta.customer_state);
        const vMeta = (salesVoucher.metadata || {}) as Record<string, any>;
        let isInterstate = vMeta.jurisdiction === "INTER_STATE" || vMeta.is_interstate === true || vMeta.isInterstate === true;
        if (!isInterstate && customerState) {
          const brRes = await client.query(`SELECT metadata, address FROM public.branch WHERE id = $1`, [effectiveBranchId]);
          const brState = brRes.rows[0]?.metadata?.state || brRes.rows[0]?.address || "Karnataka";
          if (brState.toLowerCase().trim() !== customerState.toLowerCase().trim()) {
            isInterstate = true;
          }
        }

        const resolvedLines: ResolvedReturnLine[] = [];
        let totalTaxableBase = 0;
        let totalOutputTax = 0;
        let totalCogsReversal = 0;

        for (const returnItem of params.items) {
          const origItem = rawOrderItems.find((i: any) =>
            (returnItem.productId && i.product_id === returnItem.productId) ||
            (returnItem.variantId && (i.variant_id === returnItem.variantId || i.id === returnItem.variantId))
          );
          if (!origItem) {
            throw new SalesReturnError(
              "ITEM_NOT_FOUND",
              `Product '${returnItem.productId || returnItem.variantId}' was not part of original order '${params.orderId}'.`
            );
          }

          const targetProductId = returnItem.productId || origItem.product_id;
          returnItem.productId = targetProductId;

          // Fetch product catalog classification
          const pRes = await client.query(
            `SELECT id, title, merchandise_type FROM public.product WHERE id = $1 AND deleted_at IS NULL`,
            [targetProductId]
          );
          const product = pRes.rows[0];
          if (!product) {
            throw new SalesReturnError("ITEM_NOT_FOUND", `Product '${targetProductId}' not found in catalog.`);
          }

          const merchType = (product.merchandise_type || "CAKE").toUpperCase() as "CAKE" | "ACCESSORY" | "PACKAGING";

          // Strict Business Rule 1: Cake Restocking Prohibited
          if (merchType === "CAKE" && returnItem.isResalable === true) {
            throw new SalesReturnError(
              "PERISHABLE_CAKE_RESTOCK_PROHIBITED",
              `Perishable cake product '${product.title}' cannot be restocked to inventory under food safety regulations.`
            );
          }

          // Strict Business Rule 2: Packaging Restocking Prohibited
          if (merchType === "PACKAGING" && returnItem.isResalable === true) {
            throw new SalesReturnError(
              "PACKAGING_RESTOCK_PROHIBITED",
              `Packaging item '${product.title}' is a consumable and cannot be restocked to inventory.`
            );
          }

          // Quantity limits: returnQty + previouslyReturned <= originalFulfilled
          const fulfilledQty = Number(origItem.quantity);
          const previouslyReturned = cumulativeReturnedMap.get(product.id) || 0;
          const availableToReturn = fulfilledQty - previouslyReturned;

          if (returnItem.quantity > availableToReturn) {
            throw new SalesReturnError(
              "OVER_RETURN_NOT_PERMITTED",
              `Return quantity ${returnItem.quantity} for '${product.title}' exceeds remaining returnable quantity ${availableToReturn} (fulfilled: ${fulfilledQty}, previously returned: ${previouslyReturned}).`
            );
          }

          // Effective unit price & tax calculation
          const rawUnitPrice = Number(origItem.unit_price ?? origItem.price ?? origItem.selling_price ?? 0);
          const rawDiscount = Number(origItem.discount || 0);
          const netItemPrice = Math.max(0, rawUnitPrice - (rawDiscount / fulfilledQty));
          const effectiveUnitPrice = Math.round(netItemPrice * 100) / 100;

          // Tax rate resolution
          const taxRatePercent = Number(origItem.tax_rate ?? origItem.gst_rate ?? 5);
          const taxableBase = Math.round(returnItem.quantity * effectiveUnitPrice * 100) / 100;
          const totalTax = Math.round(taxableBase * (taxRatePercent / 100) * 100) / 100;
          const grossAmount = Math.round((taxableBase + totalTax) * 100) / 100;

          let cgstAmount = 0;
          let sgstAmount = 0;
          let igstAmount = 0;
          let cgstAccountCode: string | null = null;
          let sgstAccountCode: string | null = null;
          let igstAccountCode: string | null = null;

          if (isInterstate) {
            igstAmount = totalTax;
            if (taxRatePercent === 5) igstAccountCode = "2125";
            else if (taxRatePercent === 18) igstAccountCode = "2126";
            else if (taxRatePercent === 12) igstAccountCode = "2129";
            else igstAccountCode = "2126";
          } else {
            cgstAmount = Math.round((totalTax / 2) * 100) / 100;
            sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
            if (taxRatePercent === 5) {
              cgstAccountCode = "2121";
              sgstAccountCode = "2122";
            } else if (taxRatePercent === 18) {
              cgstAccountCode = "2123";
              sgstAccountCode = "2124";
            } else if (taxRatePercent === 12) {
              cgstAccountCode = "2127";
              sgstAccountCode = "2128";
            } else {
              cgstAccountCode = "2123";
              sgstAccountCode = "2124";
            }
          }

          // Accessory Cost Lot Traceability
          const isResalable = merchType === "ACCESSORY" && returnItem.isResalable !== false;
          const costLotsToRestore: ResolvedReturnLine["costLotsToRestore"] = [];
          let totalRestoredCost = 0;

          if (isResalable) {
            const productConsumptions = consumptionsByProduct.get(product.id) || [];
            let neededRestoration = returnItem.quantity;

            for (const cons of productConsumptions) {
              if (neededRestoration <= 0) break;
              const consQty = Number(cons.consumed_quantity);
              const restoreFromThisLot = Math.min(neededRestoration, consQty);
              const unitCost = Number(cons.unit_cost);
              const lotCost = Math.round(restoreFromThisLot * unitCost * 100) / 100;

              costLotsToRestore.push({
                lotId: cons.lot_id,
                quantity: restoreFromThisLot,
                unitCost,
                totalCost: lotCost,
              });

              totalRestoredCost += lotCost;
              neededRestoration -= restoreFromThisLot;
            }
          }

          resolvedLines.push({
            productId: product.id,
            variantId: returnItem.variantId || origItem.variant_id || null,
            title: product.title,
            merchandiseType: merchType,
            quantity: returnItem.quantity,
            effectiveUnitPrice,
            taxRatePercent,
            taxableBase,
            cgstAmount,
            sgstAmount,
            igstAmount,
            totalTax,
            grossAmount,
            cgstAccountCode,
            sgstAccountCode,
            igstAccountCode,
            isResalable,
            costLotsToRestore,
            totalRestoredCost,
          });

          totalTaxableBase += taxableBase;
          totalOutputTax += totalTax;
          totalCogsReversal += totalRestoredCost;
        }

        const totalCreditNoteAmount = Math.round((totalTaxableBase + totalOutputTax) * 100) / 100;

        // ─────────────────────────────────────────────────────────────────────
        // 6. Resolve Accounts and Build Journal Lines
        // ─────────────────────────────────────────────────────────────────────
        const isCod =
          meta.payment_method === "cod" ||
          meta.payment_method === "Cash on Delivery (COD)" ||
          (salesVoucher.metadata && salesVoucher.metadata.payment_classification === "COD");
        const arAccountCode = isCod ? "1122" : "1121";

        // Collect all account codes needed
        const neededCodes = new Set<string>(["4190", arAccountCode]);
        if (totalCogsReversal > 0) {
          neededCodes.add("1131");
          neededCodes.add("5120");
        }
        for (const l of resolvedLines) {
          if (l.cgstAccountCode) neededCodes.add(l.cgstAccountCode);
          if (l.sgstAccountCode) neededCodes.add(l.sgstAccountCode);
          if (l.igstAccountCode) neededCodes.add(l.igstAccountCode);
        }

        const coaRes = await client.query<AccountingAccountRow>(
          `SELECT id, code, name FROM public.accounting_account WHERE code = ANY($1) AND is_active = true AND is_group = false AND deleted_at IS NULL`,
          [Array.from(neededCodes)]
        );
        const coaMap = new Map<string, AccountingAccountRow>();
        for (const row of coaRes.rows) {
          coaMap.set(row.code, row);
        }

        const acc4190 = coaMap.get("4190");
        const accAr = coaMap.get(arAccountCode);
        if (!acc4190 || !accAr) {
          throw new SalesReturnError("ACCOUNT_RESOLUTION_FAILED", "Could not resolve account 4190 or AR control account.");
        }

        // Guest customer check: customer_id must be NULL on journal lines if guest
        const isGuest = !order.customer_id || order.customer_id === "guest" || order.customer_id.startsWith("guest_");
        let validatedCustomerId: string | null = null;
        if (!isGuest) {
          const custRes = await client.query(
            `SELECT id FROM public.customer WHERE id = $1 AND deleted_at IS NULL`,
            [order.customer_id]
          );
          if (custRes.rows.length > 0) {
            validatedCustomerId = custRes.rows[0].id;
          }
        }

        const lineInputs: JournalLineInput[] = [];

        // Line 1: Debit 4190 Sales Returns (Taxable Base)
        lineInputs.push({
          account_id: acc4190.id,
          debit_amount: totalTaxableBase,
          credit_amount: 0,
          branch_id: effectiveBranchId,
          narration: `Sales return base reversal for Order ${order.display_id || order.id}`,
        });

        // Lines 2+: Debit Output GST Accounts
        for (const line of resolvedLines) {
          if (line.igstAmount > 0 && line.igstAccountCode) {
            const acc = coaMap.get(line.igstAccountCode);
            if (!acc) throw new SalesReturnError("ACCOUNT_RESOLUTION_FAILED", `Account ${line.igstAccountCode} not found.`);
            lineInputs.push({
              account_id: acc.id,
              debit_amount: line.igstAmount,
              credit_amount: 0,
              branch_id: effectiveBranchId,
              narration: `IGST reversal for ${line.title}`,
            });
          }
          if (line.cgstAmount > 0 && line.cgstAccountCode) {
            const acc = coaMap.get(line.cgstAccountCode);
            if (!acc) throw new SalesReturnError("ACCOUNT_RESOLUTION_FAILED", `Account ${line.cgstAccountCode} not found.`);
            lineInputs.push({
              account_id: acc.id,
              debit_amount: line.cgstAmount,
              credit_amount: 0,
              branch_id: effectiveBranchId,
              narration: `CGST reversal for ${line.title}`,
            });
          }
          if (line.sgstAmount > 0 && line.sgstAccountCode) {
            const acc = coaMap.get(line.sgstAccountCode);
            if (!acc) throw new SalesReturnError("ACCOUNT_RESOLUTION_FAILED", `Account ${line.sgstAccountCode} not found.`);
            lineInputs.push({
              account_id: acc.id,
              debit_amount: line.sgstAmount,
              credit_amount: 0,
              branch_id: effectiveBranchId,
              narration: `SGST reversal for ${line.title}`,
            });
          }
        }

        // Line: Credit AR (1121 or 1122) for total credit note amount
        lineInputs.push({
          account_id: accAr.id,
          debit_amount: 0,
          credit_amount: totalCreditNoteAmount,
          branch_id: effectiveBranchId,
          customer_id: validatedCustomerId,
          narration: `AR credit note reduction for Order ${order.display_id || order.id}`,
        });

        // Lines: Inventory & COGS Reversal for Restorable Accessories
        if (totalCogsReversal > 0) {
          const acc1131 = coaMap.get("1131");
          const acc5120 = coaMap.get("5120");
          if (!acc1131 || !acc5120) {
            throw new SalesReturnError("ACCOUNT_RESOLUTION_FAILED", "Could not resolve accounts 1131 or 5120.");
          }
          lineInputs.push({
            account_id: acc1131.id,
            debit_amount: totalCogsReversal,
            credit_amount: 0,
            branch_id: effectiveBranchId,
            narration: `Inventory cost restoration for returned accessories (Order ${order.display_id || order.id})`,
          });
          lineInputs.push({
            account_id: acc5120.id,
            debit_amount: 0,
            credit_amount: totalCogsReversal,
            branch_id: effectiveBranchId,
            narration: `COGS reversal for returned accessories (Order ${order.display_id || order.id})`,
          });
        }

        // ─────────────────────────────────────────────────────────────────────
        // 7. Create Accounting Voucher in DRAFT Status
        // ─────────────────────────────────────────────────────────────────────
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        for (const l of resolvedLines) {
          totalCgst += l.cgstAmount;
          totalSgst += l.sgstAmount;
          totalIgst += l.igstAmount;
        }
        totalCgst = Math.round(totalCgst * 100) / 100;
        totalSgst = Math.round(totalSgst * 100) / 100;
        totalIgst = Math.round(totalIgst * 100) / 100;

        const existingCnRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM public.accounting_voucher 
           WHERE voucher_type = 'CREDIT_NOTE' 
             AND (reference_id = $1 OR metadata->>'order_id' = $1)
             AND deleted_at IS NULL`,
          [order.id]
        );
        const existingCount = Number(existingCnRes.rows[0]?.count || 0);
        const seq = params.returnSequence || (existingCount + 1);
        const refEvent = seq === 1 ? "CREDIT_NOTE" : `CREDIT_NOTE_PARTIAL_${seq}`;
        const voucherDate = new Date().toISOString().slice(0, 10);
        const fiscalYear = `FY${voucherDate.slice(0, 4)}`;

        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "CREDIT_NOTE",
            voucher_date: voucherDate,
            branch_id: effectiveBranchId,
            narration: `Credit note for Sales Return on Order ${order.display_id || order.id}`,
            reference_type: "ORDER_RETURN",
            reference_id: order.id,
            reference_event: refEvent,
            reversal_of_voucher_id: salesVoucher.id,
            lines: lineInputs,
            metadata: {
              order_id: order.id,
              sales_voucher_id: salesVoucher.id,
              return_sequence: seq,
              reason: params.reason || "Customer return",
              total_taxable_base: totalTaxableBase,
              total_output_tax: totalOutputTax,
              total_cgst: totalCgst,
              total_sgst: totalSgst,
              total_igst: totalIgst,
              total_cogs_reversal: totalCogsReversal,
              items: resolvedLines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                title: l.title,
                merchandiseType: l.merchandiseType,
                quantity: l.quantity,
                effectiveUnitPrice: l.effectiveUnitPrice,
                taxableBase: l.taxableBase,
                totalTax: l.totalTax,
                grossAmount: l.grossAmount,
                isResalable: l.isResalable,
                is_resalable: l.isResalable,
                cgstAmount: l.cgstAmount,
                sgstAmount: l.sgstAmount,
                igstAmount: l.igstAmount,
                cgstAccountCode: l.cgstAccountCode,
                sgstAccountCode: l.sgstAccountCode,
                igstAccountCode: l.igstAccountCode,
                costLotsToRestore: l.costLotsToRestore,
                totalRestoredCost: l.totalRestoredCost,
              })),
            },
          },
          branchId: effectiveBranchId,
          fiscalYear,
          createdBy: params.createdBy,
          client,
        });

        if (!draftRes.success) {
          if (draftRes.code === "DUPLICATE_SOURCE_EVENT") {
            throw new SalesReturnError("DUPLICATE_SOURCE_EVENT", draftRes.error);
          }
          throw new SalesReturnError("SALES_RETURN_FAILED", draftRes.error);
        }

        // Update total_amount on voucher
        const updateSql = `
          UPDATE public.accounting_voucher
          SET total_amount = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;
        const updatedVoucher = await client.query<AccountingVoucherRow>(updateSql, [
          totalCreditNoteAmount,
          draftRes.data.id,
        ]);
        const voucher = updatedVoucher.rows[0];
        return Object.assign(voucher, {
          voucher,
          totalAmount: Number(voucher.total_amount),
          totalTaxableBase,
          totalOutputTax,
          totalCgst,
          totalSgst,
          totalIgst,
          totalCogsReversal,
          items: resolvedLines.map((l) => ({ ...l, is_resalable: l.isResalable })),
        });
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesReturnError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: (err.code as SalesReturnErrorCode) || "SALES_RETURN_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_RETURN_FAILED" };
    }
  }

  // ── 2. SUBMIT SALES RETURN VOUCHER ──────────────────────────────────────────

  /**
   * Transitions a CREDIT_NOTE voucher from DRAFT to SUBMITTED.
   */
  static async submitSalesReturn(
    params: SubmitSalesReturnParams
  ): Promise<
    | { success: true; data: AccountingVoucherRow }
    | { success: false; error: string; code: SalesReturnErrorCode }
  > {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesReturnError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (voucher.voucher_type !== "CREDIT_NOTE") {
          throw new SalesReturnError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' is of type '${voucher.voucher_type}'. Expected 'CREDIT_NOTE'.`
          );
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesReturnError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
        }

        if (voucher.status !== "DRAFT") {
          throw new SalesReturnError(
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
          throw new SalesReturnError("INVALID_VOUCHER_STATE", submitRes.error);
        }

        return submitRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesReturnError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_RETURN_FAILED" };
    }
  }

  // ── 3. APPROVE SALES RETURN VOUCHER ──────────────────────────────────────────

  /**
   * Approves a SUBMITTED CREDIT_NOTE voucher. Enforces Segregation of Duties.
   */
  static async approveSalesReturn(
    params: ApproveSalesReturnParams
  ): Promise<
    | { success: true; data: AccountingVoucherRow }
    | { success: false; error: string; code: SalesReturnErrorCode }
  > {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesReturnError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (voucher.voucher_type !== "CREDIT_NOTE") {
          throw new SalesReturnError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' is of type '${voucher.voucher_type}'. Expected 'CREDIT_NOTE'.`
          );
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesReturnError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
        }

        // Canonical permission check: ACCOUNTING.APPROVE (Must fail-closed before state inspection)
        if (params.actorContext && !hasEffectivePermission(params.actorContext as any, "ACCOUNTING.APPROVE")) {
          throw new SalesReturnError(
            "PERMISSION_DENIED",
            `Staff member '${params.approvedBy}' lacks canonical permission 'ACCOUNTING.APPROVE'.`
          );
        }

        if (voucher.status !== "SUBMITTED") {
          throw new SalesReturnError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher in status '${voucher.status}'. Expected 'SUBMITTED'.`
          );
        }

        // Segregation of Duties: Creator cannot approve own return voucher
        if (voucher.created_by && voucher.created_by === params.approvedBy) {
          throw new SalesReturnError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties: Voucher creator '${voucher.created_by}' cannot approve their own credit note voucher.`
          );
        }

        // Segregation of Duties: Submitter cannot approve return voucher
        if (voucher.submitted_by && voucher.submitted_by === params.approvedBy) {
          throw new SalesReturnError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties: Voucher submitter '${voucher.submitted_by}' cannot approve the credit note voucher.`
          );
        }

        const vMeta = (voucher.metadata || {}) as Record<string, any>;
        const orderId = vMeta.order_id || voucher.reference_id;
        if (orderId) {
          const oRes = await client.query(`SELECT customer_id FROM public."order" WHERE id = $1`, [orderId]);
          if (oRes.rows[0]?.customer_id && oRes.rows[0].customer_id === params.approvedBy) {
            throw new SalesReturnError(
              "SEGREGATION_OF_DUTIES_VIOLATION",
              "Customer cannot approve credit note voucher."
            );
          }
        }

        const approveRes = await PostingService.approveVoucher({
          voucherId: voucher.id,
          approvedBy: params.approvedBy,
          branchId: voucher.branch_id,
          client,
        });

        if (!approveRes.success) {
          const code = approveRes.code === "SEGREGATION_OF_DUTIES_VIOLATION" 
            ? "SEGREGATION_OF_DUTIES_VIOLATION" 
            : "INVALID_VOUCHER_STATE";
          throw new SalesReturnError(code, approveRes.error);
        }

        return approveRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesReturnError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_RETURN_FAILED" };
    }
  }

  // ── 4. POST CREDIT NOTE VOUCHER (FINANCIAL & INVENTORY MUTATION) ──────────────

  /**
   * Atomically posts a CREDIT_NOTE voucher to the General Ledger.
   * Restores accessory cost lots and physical stock; never restocks cakes.
   */
  static async postCreditNote(
    params: PostCreditNoteParams
  ): Promise<
    | { success: true; data: SalesReturnResult }
    | { success: false; error: string; code: SalesReturnErrorCode }
  > {
    try {
      const execute = async (client: PoolClient): Promise<SalesReturnResult> => {
        // ─────────────────────────────────────────────────────────────────────
        // 1. Lock and Verify Voucher
        // ─────────────────────────────────────────────────────────────────────
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesReturnError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (voucher.voucher_type !== "CREDIT_NOTE") {
          throw new SalesReturnError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' is of type '${voucher.voucher_type}'. Expected 'CREDIT_NOTE'.`
          );
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesReturnError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
        }

        // Canonical permission check: ACCOUNTING.POST (Must fail-closed before state inspection)
        if (params.actorContext && !hasEffectivePermission(params.actorContext as any, "ACCOUNTING.POST")) {
          throw new SalesReturnError(
            "PERMISSION_DENIED",
            `Staff member '${params.postedBy}' lacks canonical permission 'ACCOUNTING.POST'.`
          );
        }

        if (voucher.status !== "APPROVED") {
          throw new SalesReturnError(
            "INVALID_VOUCHER_STATE",
            `Cannot post credit note voucher in status '${voucher.status}'. Expected 'APPROVED'.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. Segregation of Duties (SoD) & Permission Resolution
        // ─────────────────────────────────────────────────────────────────────
        if (voucher.created_by === params.postedBy) {
          throw new SalesReturnError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties: Voucher creator '${voucher.created_by}' cannot post their own credit note voucher.`
          );
        }
        if (voucher.approved_by === params.postedBy) {
          throw new SalesReturnError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties: Voucher approver '${voucher.approved_by}' cannot post the credit note voucher.`
          );
        }

        const vMeta = (voucher.metadata || {}) as Record<string, any>;
        const orderId = vMeta.order_id || voucher.reference_id;

        // Lock source order
        const oRes = await client.query(
          `SELECT * FROM public."order" WHERE id = $1 FOR UPDATE`,
          [orderId]
        );
        const order = oRes.rows[0];
        if (order) {
          if (order.customer_id && order.customer_id === params.postedBy) {
            throw new SalesReturnError(
              "SEGREGATION_OF_DUTIES_VIOLATION",
              "Customer cannot post accounting credit note."
            );
          }
          const ordMeta = (order.metadata || {}) as Record<string, any>;
          if (ordMeta.created_by && ordMeta.created_by === params.postedBy) {
            throw new SalesReturnError(
              "SEGREGATION_OF_DUTIES_VIOLATION",
              "Commercial order creator cannot post credit note voucher."
            );
          }
        }

        // Canonical permission check: ACCOUNTING.POST
        if (params.actorContext && !hasEffectivePermission(params.actorContext as any, "ACCOUNTING.POST")) {
          throw new SalesReturnError(
            "PERMISSION_DENIED",
            `Staff member '${params.postedBy}' lacks canonical permission 'ACCOUNTING.POST'.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Fail-Closed Configuration Guards
        // ─────────────────────────────────────────────────────────────────────
        const rawDate = voucher.voucher_date as unknown;
        const voucherDate = rawDate instanceof Date
          ? rawDate.toISOString().split("T")[0]
          : String(voucher.voucher_date);

        try {
          await PostingService.validateAccountingStartDate(voucherDate, client);
        } catch (err: any) {
          if (err instanceof PostingServiceError) {
            throw new SalesReturnError((err.code as SalesReturnErrorCode) || "ACCOUNTING_START_DATE_NOT_CONFIGURED", err.message);
          }
          throw err;
        }

        try {
          await PostingService.validateFiscalPeriod(voucherDate, client);
        } catch (err: any) {
          if (err instanceof PostingServiceError) {
            throw new SalesReturnError((err.code as SalesReturnErrorCode) || "FISCAL_PERIOD_NOT_CONFIGURED", err.message);
          }
          throw err;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. Inventory Reinstatement for Restorable Accessories
        // ─────────────────────────────────────────────────────────────────────
        const items = Array.isArray(vMeta.items) ? vMeta.items : [];
        const createdMovements: InventoryMovementRow[] = [];
        const returnedItemsSummary: SalesReturnResult["returnedItems"] = [];

        for (const item of items) {
          if (item.isResalable === true && item.merchandiseType === "ACCESSORY") {
            // Restore physical stock in branch_inventory
            if (item.variantId) {
              await client.query(
                `UPDATE public.branch_inventory
                 SET quantity = quantity + $1, updated_at = NOW()
                 WHERE branch_id = $2 AND variant_id = $3;`,
                [item.quantity, voucher.branch_id, item.variantId]
              );
            }

            // Record authoritative inventory movement
            const movRes = await client.query<InventoryMovementRow>(
              `INSERT INTO public.inventory_movement (
                 branch_id, product_id, variant_id,
                 movement_type, quantity, direction,
                 order_id, voucher_id, reference_no, narration,
                 created_by, created_at
               ) VALUES (
                 $1, $2, $3,
                 'SALES_RETURN', $4, 'IN',
                 $5, $6, $7, $8,
                 $9, NOW()
               ) RETURNING *;`,
              [
                voucher.branch_id,
                item.productId,
                item.variantId,
                item.quantity,
                orderId,
                voucher.id,
                voucher.voucher_no,
                `Sales return restock for Order ${order?.display_id || orderId} (${item.title})`,
                params.postedBy,
              ]
            );
            createdMovements.push(movRes.rows[0]);

            // Re-instate cost lots
            const lotsToRestore = Array.isArray(item.costLotsToRestore) ? item.costLotsToRestore : [];
            for (const lotRestore of lotsToRestore) {
              await client.query(
                `UPDATE public.inventory_cost_lot
                 SET remaining_quantity = remaining_quantity + $1,
                     status = 'ACTIVE',
                     updated_at = NOW()
                 WHERE id = $2;`,
                [lotRestore.quantity, lotRestore.lotId]
              );
            }

            returnedItemsSummary.push({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              restocked: true,
              restoredCost: item.totalRestoredCost || 0,
            });
          } else {
            // Perishable cakes or damaged accessories: NEVER restocked
            returnedItemsSummary.push({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              restocked: false,
              restoredCost: 0,
            });
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. Reconstruct Journal Lines and Post Voucher to General Ledger
        // ─────────────────────────────────────────────────────────────────────
        const isCod =
          order?.metadata?.payment_method === "cod" ||
          order?.metadata?.payment_method === "Cash on Delivery (COD)" ||
          (voucher.metadata && (voucher.metadata as any).payment_classification === "COD");
        const arAccountCode = isCod ? "1122" : "1121";

        const neededCodes = new Set<string>(["4190", arAccountCode]);
        const totalCogsReversal = Number(vMeta.total_cogs_reversal || 0);
        if (totalCogsReversal > 0) {
          neededCodes.add("1131");
          neededCodes.add("5120");
        }
        for (const l of items) {
          if (l.cgstAccountCode) neededCodes.add(l.cgstAccountCode);
          if (l.sgstAccountCode) neededCodes.add(l.sgstAccountCode);
          if (l.igstAccountCode) neededCodes.add(l.igstAccountCode);
        }

        const coaRes = await client.query<AccountingAccountRow>(
          `SELECT id, code, name FROM public.accounting_account WHERE code = ANY($1) AND is_active = true AND is_group = false AND deleted_at IS NULL`,
          [Array.from(neededCodes)]
        );
        const coaMap = new Map<string, AccountingAccountRow>();
        for (const row of coaRes.rows) {
          coaMap.set(row.code, row);
        }

        const acc4190 = coaMap.get("4190");
        const accAr = coaMap.get(arAccountCode);
        if (!acc4190 || !accAr) {
          throw new SalesReturnError("ACCOUNT_RESOLUTION_FAILED", "Could not resolve accounts for posting.");
        }

        const isGuest = !order?.customer_id || order.customer_id === "guest" || order.customer_id.startsWith("guest_");
        let validatedCustomerId: string | null = null;
        if (!isGuest && order?.customer_id) {
          const custRes = await client.query(
            `SELECT id FROM public.customer WHERE id = $1 AND deleted_at IS NULL`,
            [order.customer_id]
          );
          if (custRes.rows.length > 0) validatedCustomerId = custRes.rows[0].id;
        }

        const totalTaxableBase = Number(vMeta.total_taxable_base || 0);
        const totalCreditNoteAmount = Number(voucher.total_amount);

        const journalLines: JournalLineInput[] = [];

        // Debit 4190 Sales Returns
        journalLines.push({
          account_id: acc4190.id,
          debit_amount: totalTaxableBase,
          credit_amount: 0,
          branch_id: voucher.branch_id,
          narration: `Sales return base reversal for Order ${order?.display_id || orderId}`,
        });

        // Debit Output GST
        for (const line of items) {
          if (line.igstAmount > 0 && line.igstAccountCode) {
            const acc = coaMap.get(line.igstAccountCode);
            if (acc) {
              journalLines.push({
                account_id: acc.id,
                debit_amount: Number(line.igstAmount),
                credit_amount: 0,
                branch_id: voucher.branch_id,
                narration: `IGST reversal for ${line.title}`,
              });
            }
          }
          if (line.cgstAmount > 0 && line.cgstAccountCode) {
            const acc = coaMap.get(line.cgstAccountCode);
            if (acc) {
              journalLines.push({
                account_id: acc.id,
                debit_amount: Number(line.cgstAmount),
                credit_amount: 0,
                branch_id: voucher.branch_id,
                narration: `CGST reversal for ${line.title}`,
              });
            }
          }
          if (line.sgstAmount > 0 && line.sgstAccountCode) {
            const acc = coaMap.get(line.sgstAccountCode);
            if (acc) {
              journalLines.push({
                account_id: acc.id,
                debit_amount: Number(line.sgstAmount),
                credit_amount: 0,
                branch_id: voucher.branch_id,
                narration: `SGST reversal for ${line.title}`,
              });
            }
          }
        }

        // Credit AR
        journalLines.push({
          account_id: accAr.id,
          debit_amount: 0,
          credit_amount: totalCreditNoteAmount,
          branch_id: voucher.branch_id,
          customer_id: validatedCustomerId,
          narration: `AR credit note reduction for Order ${order?.display_id || orderId}`,
        });

        // COGS Reversal for Accessories
        if (totalCogsReversal > 0) {
          const acc1131 = coaMap.get("1131");
          const acc5120 = coaMap.get("5120");
          if (acc1131 && acc5120) {
            journalLines.push({
              account_id: acc1131.id,
              debit_amount: totalCogsReversal,
              credit_amount: 0,
              branch_id: voucher.branch_id,
              narration: `Inventory cost restoration for returned accessories (Order ${order?.display_id || orderId})`,
            });
            journalLines.push({
              account_id: acc5120.id,
              debit_amount: 0,
              credit_amount: totalCogsReversal,
              branch_id: voucher.branch_id,
              narration: `COGS reversal for returned accessories (Order ${order?.display_id || orderId})`,
            });
          }
        }

        const postRes = await PostingService.postVoucher({
          voucherId: voucher.id,
          postedBy: params.postedBy,
          lines: journalLines,
          branchId: voucher.branch_id,
          client,
        });

        if (!postRes.success) {
          throw new SalesReturnError("SALES_RETURN_FAILED", postRes.error);
        }

        // ─────────────────────────────────────────────────────────────────────
        // 6. Enrich Order Metadata
        // ─────────────────────────────────────────────────────────────────────
        if (order) {
          const ordMeta = (order.metadata || {}) as Record<string, any>;
          const existingReturns = Array.isArray(ordMeta.credit_notes) ? ordMeta.credit_notes : [];
          existingReturns.push({
            voucherId: voucher.id,
            voucherNo: voucher.voucher_no,
            amount: Number(voucher.total_amount),
            postedAt: new Date().toISOString(),
          });

          await client.query(
            `UPDATE public."order"
             SET metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{credit_notes}',
               $1::jsonb
             ), updated_at = NOW()
             WHERE id = $2;`,
            [JSON.stringify(existingReturns), order.id]
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 7. Calculate Post-Return AR and Eligible Refund Amount
        // ─────────────────────────────────────────────────────────────────────
        const arSummary = await CustomerReceiptService.getOrderOutstandingAr(orderId, client);

        const idToCodeMap = new Map<string, string>();
        for (const row of coaRes.rows) {
          idToCodeMap.set(row.id, row.code);
        }
        const enrichedLines = ((postRes.data.journal_entry as any).lines || []).map((l: any) => ({
          ...l,
          account_code: idToCodeMap.get(l.account_id) || l.account_code || null,
        }));

        return {
          voucher: postRes.data.voucher,
          journalEntry: {
            ...postRes.data.journal_entry,
            lines: enrichedLines,
          },
          lines: enrichedLines,
          orderId,
          creditNoteAmount: Number(voucher.total_amount),
          returnedItems: returnedItemsSummary,
          movements: createdMovements,
          remainingAr: arSummary.outstandingAr,
          eligibleRefundAmount: arSummary.maxRefundable || 0,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesReturnError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: (err.code as SalesReturnErrorCode) || "SALES_RETURN_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_RETURN_FAILED" };
    }
  }

  // ── 5. POST CUSTOMER REFUND (CASH / GATEWAY / BANK DISBURSEMENT) ─────────────

  /**
   * Posts a customer refund disbursement voucher (voucher_type = 'PAYMENT').
   * Clears the credit balance on AR and reduces Gateway Clearing, Cash, or Bank balances.
   */
  static async postCustomerRefund(
    params: PostCustomerRefundParams
  ): Promise<
    | { success: true; data: CustomerRefundResult }
    | { success: false; error: string; code: SalesReturnErrorCode }
  > {
    try {
      if (typeof params.amount !== "number" || isNaN(params.amount) || params.amount <= 0) {
        throw new SalesReturnError(
          "INVALID_AMOUNT",
          `Refund amount must be a positive number. Got '${params.amount}'.`
        );
      }

      const refundAmount = Math.round(params.amount * 100) / 100;

      const execute = async (client: PoolClient): Promise<CustomerRefundResult> => {
        // ─────────────────────────────────────────────────────────────────────
        // 1. Lock & Fetch Order and Payment Transactions
        // ─────────────────────────────────────────────────────────────────────
        const oSql = `
          SELECT * FROM public."order"
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE;
        `;
        const oRes = await client.query(oSql, [params.orderId]);
        const order = oRes.rows[0];
        if (!order) {
          throw new SalesReturnError("ORDER_NOT_FOUND", `Order '${params.orderId}' not found.`);
        }

        const meta = (order.metadata || {}) as Record<string, any>;
        if (meta.legacy_prototype === true) {
          throw new SalesReturnError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Order '${params.orderId}' is quarantined legacy prototype data.`
          );
        }

        // Lock payment transaction if exists
        const ptSql = `
          SELECT * FROM public.payment_transaction
          WHERE order_id = $1 AND deleted_at IS NULL
          ORDER BY id ASC
          FOR UPDATE;
        `;
        const ptRes = await client.query(ptSql, [params.orderId]);
        const paymentTxn = ptRes.rows[0];

        // ─────────────────────────────────────────────────────────────────────
        // 2. Idempotency Key Check (Evaluated FIRST before balance checks)
        // ─────────────────────────────────────────────────────────────────────
        if (params.idempotencyKey) {
          const existVchRes = await client.query(
            `SELECT * FROM public.accounting_voucher WHERE metadata->>'idempotency_key' = $1 AND deleted_at IS NULL`,
            [params.idempotencyKey]
          );
          if (existVchRes.rows.length > 0) {
            const existVch = existVchRes.rows[0];
            const jeRes = await client.query(
              `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`,
              [existVch.id]
            );
            const linesRes = await client.query(
              `SELECT jl.*, a.code AS account_code 
               FROM public.accounting_journal_line jl
               JOIN public.accounting_account a ON jl.account_id = a.id
               WHERE jl.journal_entry_id = $1`,
              [jeRes.rows[0]?.id]
            );
            const curAr = await CustomerReceiptService.getOrderOutstandingAr(params.orderId, client);
            return {
              voucher: existVch,
              journalEntry: { ...jeRes.rows[0], lines: linesRes.rows },
              lines: linesRes.rows,
              orderId: params.orderId,
              refundAmount: Number(existVch.total_amount),
              refundMethod: params.refundMethod,
              remainingRefundable: curAr.maxRefundable || 0,
              wasDuplicate: true,
            };
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Authoritative Refund Eligibility Check
        // ─────────────────────────────────────────────────────────────────────
        const arSummary = await CustomerReceiptService.getOrderOutstandingAr(params.orderId, client);
        const maxRefundable = arSummary.maxRefundable || 0;

        if (maxRefundable <= 0) {
          throw new SalesReturnError(
            "REFUND_NOT_ELIGIBLE",
            `Order '${params.orderId}' has zero refundable balance (netPaid: ₹${arSummary.netPaid}, netInvoiced: ₹${arSummary.netInvoiced}).`
          );
        }

        if (refundAmount > maxRefundable) {
          throw new SalesReturnError(
            "REFUND_EXCEEDS_NET_PAID",
            `Refund amount of ₹${refundAmount.toFixed(2)} exceeds maximum eligible refundable balance of ₹${maxRefundable.toFixed(2)}.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Branch Verification & SoD
        // ─────────────────────────────────────────────────────────────────────
        const effectiveBranchId = params.branchId || order.branch_id || meta.branch_id;
        const poster = params.postedBy || params.disbursedBy || "usr_system_cashier";
        if (order.customer_id && order.customer_id === poster) {
          throw new SalesReturnError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            "Customer cannot post customer refund payment voucher."
          );
        }

        // Canonical permission check: ACCOUNTING.POST
        if (params.actorContext && !hasEffectivePermission(params.actorContext as any, "ACCOUNTING.POST")) {
          throw new SalesReturnError(
            "PERMISSION_DENIED",
            `Staff member '${poster}' lacks canonical permission 'ACCOUNTING.POST'.`
          );
        }

        // Fail-closed configuration check
        const todayStr = new Date().toISOString().slice(0, 10);
        try {
          await PostingService.validateAccountingStartDate(todayStr, client);
        } catch (err: any) {
          if (err instanceof PostingServiceError) {
            throw new SalesReturnError((err.code as SalesReturnErrorCode) || "ACCOUNTING_START_DATE_NOT_CONFIGURED", err.message);
          }
          throw err;
        }

        try {
          await PostingService.validateFiscalPeriod(todayStr, client);
        } catch (err: any) {
          if (err instanceof PostingServiceError) {
            throw new SalesReturnError((err.code as SalesReturnErrorCode) || "FISCAL_PERIOD_NOT_CONFIGURED", err.message);
          }
          throw err;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. Construct Refund Journal Lines
        // ─────────────────────────────────────────────────────────────────────
        let disbursementAccountCode: string;
        if (params.refundMethod === "GATEWAY") {
          disbursementAccountCode = "1113"; // Gateway Clearing
        } else if (params.refundMethod === "CASH") {
          disbursementAccountCode = "1111"; // Cash in Hand
        } else {
          disbursementAccountCode = "1112"; // Bank Operating A/c
        }

        const arAccountCode = arSummary.controlAccountCode || "1121";

        const coaRes = await client.query<AccountingAccountRow>(
          `SELECT id, code, name FROM public.accounting_account WHERE code IN ($1, $2) AND is_active = true AND is_group = false AND deleted_at IS NULL`,
          [arAccountCode, disbursementAccountCode]
        );
        const coaMap = new Map<string, AccountingAccountRow>();
        for (const row of coaRes.rows) coaMap.set(row.code, row);

        const accAr = coaMap.get(arAccountCode);
        const accDisb = coaMap.get(disbursementAccountCode);
        if (!accAr || !accDisb) {
          throw new SalesReturnError("ACCOUNT_RESOLUTION_FAILED", `Failed to resolve accounts ${arAccountCode} or ${disbursementAccountCode}.`);
        }

        const isGuest = !order.customer_id || order.customer_id === "guest" || order.customer_id.startsWith("guest_");
        let validatedCustomerId: string | null = null;
        if (!isGuest && order.customer_id) {
          const custRes = await client.query(
            `SELECT id FROM public.customer WHERE id = $1 AND deleted_at IS NULL`,
            [order.customer_id]
          );
          if (custRes.rows.length > 0) validatedCustomerId = custRes.rows[0].id;
        }

        const lineInputs: JournalLineInput[] = [
          {
            account_id: accAr.id,
            debit_amount: refundAmount, // Debit AR: Clears the credit balance created by the credit note
            credit_amount: 0,
            branch_id: effectiveBranchId,
            customer_id: validatedCustomerId,
            narration: `AR refund clearing for Order ${order.display_id || order.id}`,
          },
          {
            account_id: accDisb.id,
            debit_amount: 0,
            credit_amount: refundAmount, // Credit Cash/Gateway/Bank: Money disbursed back to customer
            branch_id: effectiveBranchId,
            narration: `Customer refund disbursement via ${params.refundMethod} for Order ${order.display_id || order.id}`,
          },
        ];

        // ─────────────────────────────────────────────────────────────────────
        // 5. Create & Post Payment Voucher
        // ─────────────────────────────────────────────────────────────────────
        const existingRefRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM public.accounting_voucher 
           WHERE voucher_type = 'PAYMENT' 
             AND (reference_id = $1 OR metadata->>'order_id' = $1)
             AND deleted_at IS NULL`,
          [order.id]
        );
        const existingRefCount = Number(existingRefRes.rows[0]?.count || 0);
        const seq = params.refundSequence || (existingRefCount + 1);
        const refEvent = seq === 1 ? "CUSTOMER_REFUND" : `CUSTOMER_REFUND_${seq}`;
        const fiscalYear = `FY${todayStr.slice(0, 4)}`;

        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "PAYMENT",
            voucher_date: todayStr,
            branch_id: effectiveBranchId,
            narration: `Customer refund disbursement for Order ${order.display_id || order.id} (${params.refundMethod})`,
            reference_type: "CUSTOMER_REFUND",
            reference_id: order.id,
            reference_event: refEvent,
            lines: lineInputs,
            metadata: {
              order_id: order.id,
              refund_method: params.refundMethod,
              provider_ref: params.providerRef || null,
              payout_ref: params.payoutRef || null,
              credit_note_voucher_id: params.creditNoteVoucherId || null,
              reason: params.reason || "Customer refund",
              idempotency_key: params.idempotencyKey || null,
              is_customer_refund: true,
            },
          },
          branchId: effectiveBranchId,
          fiscalYear,
          createdBy: "usr_refund_system",
          client,
        });

        if (!draftRes.success) {
          if (draftRes.code === "DUPLICATE_SOURCE_EVENT") {
            throw new SalesReturnError("DUPLICATE_SOURCE_EVENT", draftRes.error);
          }
          throw new SalesReturnError("SALES_RETURN_FAILED", draftRes.error);
        }

        const voucher = draftRes.data;

        // Transition DRAFT -> SUBMITTED
        const subRes = await PostingService.submitVoucher({
          voucherId: voucher.id,
          submittedBy: "usr_refund_system",
          branchId: effectiveBranchId,
          client,
        });
        if (!subRes.success) {
          throw new SalesReturnError("INVALID_VOUCHER_STATE", subRes.error);
        }

        // Transition SUBMITTED -> APPROVED (SoD: supervisor != creator)
        const appRes = await PostingService.approveVoucher({
          voucherId: voucher.id,
          approvedBy: "usr_refund_supervisor",
          branchId: effectiveBranchId,
          client,
        });

        if (!appRes.success) {
          throw new SalesReturnError("INVALID_VOUCHER_STATE", appRes.error);
        }

        // Post refund payment voucher
        const postRes = await PostingService.postVoucher({
          voucherId: voucher.id,
          postedBy: poster,
          lines: lineInputs,
          branchId: effectiveBranchId,
          client,
        });

        if (!postRes.success) {
          throw new SalesReturnError("SALES_RETURN_FAILED", postRes.error);
        }

        // Update voucher total_amount
        await client.query(
          `UPDATE public.accounting_voucher
           SET total_amount = $1, updated_at = NOW()
           WHERE id = $2;`,
          [refundAmount, voucher.id]
        );

        // ─────────────────────────────────────────────────────────────────────
        // 6. Mutate Payment Transaction Status
        // ─────────────────────────────────────────────────────────────────────
        const remainingRefundable = Math.max(0, Math.round((maxRefundable - refundAmount) * 100) / 100);
        let updatedPaymentTxn: Record<string, unknown> | undefined;

        if (paymentTxn) {
          const newStatus = remainingRefundable <= 0.001 ? "refunded" : "partially_refunded";
          const updRes = await client.query(
            `UPDATE public.payment_transaction
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *;`,
            [newStatus, paymentTxn.id]
          );
          updatedPaymentTxn = updRes.rows[0];
        }

        // ─────────────────────────────────────────────────────────────────────
        // 7. Enrich Order Metadata
        // ─────────────────────────────────────────────────────────────────────
        const existingRefunds = Array.isArray(meta.customer_refunds) ? meta.customer_refunds : [];
        existingRefunds.push({
          voucherId: voucher.id,
          voucherNo: voucher.voucher_no,
          amount: refundAmount,
          refundMethod: params.refundMethod,
          postedAt: new Date().toISOString(),
        });

        await client.query(
          `UPDATE public."order"
           SET metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{customer_refunds}',
             $1::jsonb
           ), updated_at = NOW()
           WHERE id = $2;`,
          [JSON.stringify(existingRefunds), order.id]
        );

        const idToCodeMap = new Map<string, string>();
        for (const row of coaRes.rows) {
          idToCodeMap.set(row.id, row.code);
        }
        const enrichedLines = ((postRes.data.journal_entry as any).lines || []).map((l: any) => ({
          ...l,
          account_code: idToCodeMap.get(l.account_id) || l.account_code || null,
        }));

        return {
          voucher: postRes.data.voucher,
          journalEntry: {
            ...postRes.data.journal_entry,
            lines: enrichedLines,
          },
          lines: enrichedLines,
          orderId: order.id,
          refundAmount,
          refundMethod: params.refundMethod,
          paymentTransaction: updatedPaymentTxn,
          remainingRefundable,
          wasDuplicate: false,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SalesReturnError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: (err.code as SalesReturnErrorCode) || "SALES_RETURN_FAILED" };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_RETURN_FAILED" };
    }
  }
}
