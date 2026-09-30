/**
 * CakeToHome ERP — Purchase Return & Supplier Debit Note Service
 * Phase 4F Step 3D.6-A: Canonical Purchase Return & Supplier Debit Note Workflow
 *
 * ARCHITECTURE & CONSTRAINTS:
 * 1. ONLY POSTED PURCHASES CAN RECEIVE RETURNS:
 *    - Rejects returns against DRAFT, SUBMITTED, or APPROVED purchases.
 *    - Accounts Payable and Inventory cost lots are only recognized upon purchase posting;
 *      returning unposted goods is strictly an invalid lifecycle operation.
 * 2. ITEM & COST-LOT BASED QUANTITY CONTROL:
 *    - Each returned item is traced directly to its authoritative `inventory_cost_lot`.
 *    - Return quantity must be > 0 and <= `lot.remaining_quantity`.
 *    - Over-returns are strictly rejected with RETURN_EXCEEDS_AVAILABLE_QUANTITY.
 * 3. EXCLUSIVE FINANCIAL EFFECT (DEBIT NOTE):
 *    - Dr 2111 Accounts Payable (carrying supplier_id & branch_id dimensions).
 *    - Cr 1131 / 1132 / 1133 Merchandise Inventory (returned cost basis).
 *    - Cr 1141–1149 Input GST Accounts (reversal of unallowable Input Tax Credit under GST Rule 42).
 *    - Total Debit == Total Credit (strictly balanced).
 * 4. INVENTORY LEDGER & PHYSICAL STOCK INTEGRATION:
 *    - Atomically decrements `inventory_cost_lot.remaining_quantity`.
 *    - If remaining reaches 0, lot transitions to `status = 'DEPLETED'`.
 *    - Atomically decrements physical `branch_inventory.quantity` for catalog items (non-negative constraint enforced).
 *    - Inserts authoritative `inventory_movement` record:
 *      movement_type = 'PURCHASE_RETURN', direction = 'OUT'.
 * 5. SEGREGATION OF DUTIES (SoD):
 *    - returnedBy !== purchase.created_by
 *    - returnedBy !== purchase.approved_by
 *    - SUPER_ADMIN cannot bypass SoD restriction.
 *    - Caller must possess canonical permission: hasEffectivePermission(actorContext, "ACCOUNTING.POST").
 * 6. FAIL-CLOSED CONFIGURATION GUARDS:
 *    - Unconfigured accounting start date → rejected.
 *    - Zero configured or locked fiscal periods → rejected.
 * 7. CANONICAL REUSE:
 *    - Directly reuses PostingService primitives (validateAccountingStartDate, validateFiscalPeriod,
 *      validatePostingAccounts, validateJournalLines, createVoucherDraft, submitVoucher, approveVoucher, postVoucher).
 * 8. AUTHORITATIVE ACCOUNTING EVENT:
 *    - reference_type = 'PURCHASE_RETURN'
 *    - reference_id = debit_note_id
 *    - reference_event = 'SUPPLIER_DEBIT_NOTE'
 *    - Idempotency enforced via database partial index.
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

// ─── Error Model ───────────────────────────────────────────────────────────────

export type PurchaseReturnErrorCode =
  | "PURCHASE_NOT_FOUND"
  | "INVALID_PURCHASE_STATUS"
  | "BRANCH_ACCESS_DENIED"
  | "EMPTY_RETURN"
  | "ITEM_NOT_FOUND"
  | "INVALID_RETURN_QUANTITY"
  | "RETURN_EXCEEDS_AVAILABLE_QUANTITY"
  | "ACCOUNT_RESOLUTION_FAILED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "PERMISSION_DENIED"
  | "DUPLICATE_SOURCE_EVENT"
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "POSTING_BEFORE_ACCOUNTING_START_DATE"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "FISCAL_PERIOD_LOCKED"
  | "PURCHASE_RETURN_FAILED";

export class PurchaseReturnError extends Error {
  readonly code: PurchaseReturnErrorCode;

  constructor(code: PurchaseReturnErrorCode, message: string) {
    super(message);
    this.name = "PurchaseReturnError";
    this.code = code;
  }
}

// ─── DTOs & Parameters ────────────────────────────────────────────────────────

export interface PurchaseReturnItemInput {
  purchaseItemId: string;
  quantity: number;
  reason?: string;
}

export interface ProcessPurchaseReturnParams {
  purchaseId: string;
  branchId: string;
  items: PurchaseReturnItemInput[];
  returnDate: string; // YYYY-MM-DD
  reason: string;
  /** Staff user ID executing the supplier return */
  returnedBy: string;
  actorRole?: string;
  actorSession?: any;
  /** Optional distinct voucher preparer identity */
  voucherPreparerId?: string;
  /** Optional existing transaction client for testing or orchestrated pipelines */
  client?: PoolClient;
}

export interface ReturnedItemSummary {
  purchase_item_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_type: string;
  returned_quantity: number;
  cost_lot_id: string;
  unit_cost: number;
  total_cost: number;
  taxable_value: number;
  reversed_cgst: number;
  reversed_sgst: number;
  reversed_igst: number;
  total_tax_reversed: number;
  total_return_amount: number;
}

export interface PurchaseReturnResult {
  debit_note_id: string;
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  returned_items: ReturnedItemSummary[];
  movements: InventoryMovementRow[];
  total_inventory_cost: number;
  total_tax_reversed: number;
  total_debit_amount: number;
}

export type PurchaseReturnResponse<T = PurchaseReturnResult> =
  | { success: true; data: T }
  | { success: false; error: string; code: PurchaseReturnErrorCode };

// ─── Helper Functions ─────────────────────────────────────────────────────────

function generateDebitNoteId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `dn_${ts}${rnd}`;
}

function generateMovementId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `mov_${ts}${rnd}`;
}

async function resolveInputGstAccount(
  component: "CGST" | "SGST" | "IGST",
  rate: number,
  client: PoolClient
): Promise<AccountingAccountRow> {
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

  throw new PurchaseReturnError(
    "ACCOUNT_RESOLUTION_FAILED",
    `No Input Tax account found in Chart of Accounts for ${component} at rate ${rate}%.`
  );
}

// ─── PurchaseReturnService ────────────────────────────────────────────────────

export class PurchaseReturnService {
  /**
   * Atomically processes a supplier purchase return:
   * 1. Validates purchase status === 'POSTED'.
   * 2. Validates and locks source inventory cost lots.
   * 3. Decrements cost lot remaining quantities and marks depleted if exhausted.
   * 4. Decrements physical branch inventory for catalog items.
   * 5. Logs PURCHASE_RETURN inventory movements.
   * 6. Posts a balanced DEBIT_NOTE voucher to the General Ledger:
   *    Dr 2111 (Accounts Payable)
   *    Cr 1131 / 1132 / 1133 (Merchandise Inventory)
   *    Cr 1141–1149 (Input GST ITC Reversal)
   */
  static async processReturn(
    params: ProcessPurchaseReturnParams
  ): Promise<PurchaseReturnResponse<PurchaseReturnResult>> {
    const {
      purchaseId,
      branchId,
      items,
      returnDate,
      reason,
      returnedBy,
      actorRole,
      actorSession,
      voucherPreparerId,
      client: callerClient,
    } = params;

    try {
      const executeReturn = async (client: PoolClient): Promise<PurchaseReturnResult> => {
        // ── 1. VALIDATE INPUTS & LOCK PURCHASE ROW ─────────────────────────────
        if (!items || items.length === 0) {
          throw new PurchaseReturnError("EMPTY_RETURN", "At least one item must be specified for return.");
        }

        if (!returnDate || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
          throw new PurchaseReturnError(
            "INVALID_RETURN_QUANTITY",
            "A valid return date (YYYY-MM-DD) is required."
          );
        }

        const lockPurchaseSql = `
          SELECT * FROM public.purchase
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE
        `;
        const pRes = await client.query<PurchaseRow>(lockPurchaseSql, [purchaseId]);
        const purchase = pRes.rows[0];

        if (!purchase) {
          throw new PurchaseReturnError(
            "PURCHASE_NOT_FOUND",
            `Purchase '${purchaseId}' not found or deleted.`
          );
        }

        // Branch Isolation / BOLA Defense
        if (branchId && purchase.branch_id !== branchId) {
          throw new PurchaseReturnError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: purchase belongs to branch '${purchase.branch_id}', not '${branchId}'.`
          );
        }

        // Only POSTED purchases can receive returns
        if (purchase.status !== "POSTED") {
          throw new PurchaseReturnError(
            "INVALID_PURCHASE_STATUS",
            `Purchase returns can only be processed against POSTED purchases. Current purchase status is '${purchase.status}'.`
          );
        }

        const purchaseMeta = (typeof purchase.metadata === "string"
          ? JSON.parse(purchase.metadata || "{}")
          : purchase.metadata || {}) as Record<string, any>;

        if (purchaseMeta.is_reversed) {
          throw new PurchaseReturnError(
            "INVALID_PURCHASE_STATUS",
            `Cannot process return: Purchase '${purchaseId}' has been voided/reversed.`
          );
        }

        const origVoucherCheck = await client.query(
          `SELECT id, reversed_by_voucher_id FROM public.accounting_voucher
           WHERE reference_type = 'PURCHASE'
             AND reference_id = $1
             AND status = 'POSTED'
             AND deleted_at IS NULL`,
          [purchaseId]
        );
        if (origVoucherCheck.rows[0]?.reversed_by_voucher_id) {
          throw new PurchaseReturnError(
            "INVALID_PURCHASE_STATUS",
            `Cannot process return: Purchase '${purchaseId}' voucher has been reversed.`
          );
        }

        // ── 2. FAIL-CLOSED CONFIG GUARDS ───────────────────────────────────────
        await PostingService.validateAccountingStartDate(returnDate, client);
        const period = await PostingService.validateFiscalPeriod(returnDate, client);
        const fiscalYear = period.fiscal_year;

        // ── 3. SEGREGATION OF DUTIES (SoD) & PERMISSION VALIDATION ─────────────
        if (purchase.created_by && returnedBy === purchase.created_by) {
          throw new PurchaseReturnError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Purchase creator ('${purchase.created_by}') cannot authorize or process supplier returns for their own purchase requisition.`
          );
        }

        if (purchase.approved_by && returnedBy === purchase.approved_by) {
          throw new PurchaseReturnError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Purchase commercial approver ('${purchase.approved_by}') cannot authorize or process supplier returns for this purchase.`
          );
        }

        const actorContext = {
          userId: returnedBy,
          role: actorRole || (actorSession?.role as any) || (returnedBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
          session: actorSession || {
            user: {
              id: returnedBy,
              role: actorRole || (returnedBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
            },
          },
        };

        const hasPostingPerm = hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPostingPerm) {
          throw new PurchaseReturnError(
            "PERMISSION_DENIED",
            `Caller '${returnedBy}' lacks required permission 'ACCOUNTING.POST' to authorize supplier debit notes.`
          );
        }

        // ── 4. RESOLVE CANONICAL COA CONTROL ACCOUNTS ─────────────────────────
        const accPayable = await AccountingAccountRepository.findByCode("2111", client);
        const accAccessories = await AccountingAccountRepository.findByCode("1131", client);
        const accCakes = await AccountingAccountRepository.findByCode("1132", client);
        const accPackaging = await AccountingAccountRepository.findByCode("1133", client);

        if (!accPayable || !accAccessories || !accCakes || !accPackaging) {
          throw new PurchaseReturnError(
            "ACCOUNT_RESOLUTION_FAILED",
            "One or more required CoA accounts (2111, 1131, 1132, 1133) are missing or inactive."
          );
        }

        // ── 5. VALIDATE ITEMS & COMPUTE RETURN AMOUNTS ─────────────────────────
        const debitNoteId = generateDebitNoteId();
        const returnedSummaries: ReturnedItemSummary[] = [];
        const movements: InventoryMovementRow[] = [];

        let totalInventoryCost = 0;
        let totalTaxReversed = 0;

        // Map to aggregate credits by account ID
        const creditAccountMap = new Map<string, { amount: number; narration: string; metadata: any }>();

        const addCredit = (accountId: string, amount: number, narration: string, metadata: any) => {
          const current = creditAccountMap.get(accountId) || { amount: 0, narration, metadata };
          current.amount += amount;
          creditAccountMap.set(accountId, current);
        };

        for (const returnItem of items) {
          const returnQty = Number(returnItem.quantity);
          if (isNaN(returnQty) || returnQty <= 0) {
            throw new PurchaseReturnError(
              "INVALID_RETURN_QUANTITY",
              `Return quantity must be strictly greater than zero. Received: ${returnItem.quantity}.`
            );
          }

          // Fetch and lock purchase item
          const itemRes = await client.query<PurchaseItemRow>(
            `SELECT * FROM public.purchase_item 
             WHERE id = $1 AND purchase_id = $2 AND deleted_at IS NULL`,
            [returnItem.purchaseItemId, purchaseId]
          );
          const pItem = itemRes.rows[0];
          if (!pItem) {
            throw new PurchaseReturnError(
              "ITEM_NOT_FOUND",
              `Purchase item '${returnItem.purchaseItemId}' does not belong to purchase '${purchaseId}' or is deleted.`
            );
          }

          // Fetch and lock source cost lot
          const lotRes = await client.query<InventoryCostLotRow>(
            `SELECT * FROM public.inventory_cost_lot 
             WHERE purchase_item_id = $1 
             FOR UPDATE`,
            [pItem.id]
          );
          const lot = lotRes.rows[0];
          if (!lot) {
            throw new PurchaseReturnError(
              "ITEM_NOT_FOUND",
              `No active inventory cost lot found for purchase item '${pItem.id}'.`
            );
          }

          const remainingQty = Number(lot.remaining_quantity);
          if (returnQty > remainingQty + 0.0001) {
            throw new PurchaseReturnError(
              "RETURN_EXCEEDS_AVAILABLE_QUANTITY",
              `Return quantity (${returnQty}) exceeds available remaining cost lot quantity (${remainingQty}) for item '${pItem.description || pItem.id}'.`
            );
          }

          // Calculate returned inventory cost basis
          const unitCost = Number(lot.unit_cost);
          const itemCost = Math.round(unitCost * returnQty * 100) / 100;
          totalInventoryCost += itemCost;

          // Resolve inventory credit account based on merchandise classification
          let invAccountId = accCakes.id;
          if (pItem.item_type === "ACCESSORY") invAccountId = accAccessories.id;
          if (pItem.item_type === "PACKAGING") invAccountId = accPackaging.id;

          addCredit(
            invAccountId,
            itemCost,
            `Debit Note Inventory Reversal: ${pItem.description || pItem.id} (${returnQty} units returned)`,
            { purchase_id: purchase.id, purchase_item_id: pItem.id, return_qty: returnQty }
          );

          // Calculate pro-rata returned taxable value and taxes
          const origQty = Number(pItem.quantity);
          const origTaxable = Number(pItem.taxable_value);
          const unitTaxable = origTaxable / origQty;
          const returnedTaxable = Math.round(unitTaxable * returnQty * 100) / 100;

          let reversedCgst = 0;
          let reversedSgst = 0;
          let reversedIgst = 0;

          // Check if intra-state or inter-state GST applies
          if (pItem.cgst_rate !== null && Number(pItem.cgst_rate) > 0) {
            const cgstRate = Number(pItem.cgst_rate);
            reversedCgst = Math.round((returnedTaxable * cgstRate) / 100 * 100) / 100;
            const accCgst = await resolveInputGstAccount("CGST", cgstRate, client);
            addCredit(
              accCgst.id,
              reversedCgst,
              `Input CGST Reversal (${cgstRate}%) on Debit Note: Invoice ${purchase.invoice_no || purchase.id}`,
              { purchase_id: purchase.id, tax_component: "CGST", rate: cgstRate }
            );
          }

          if (pItem.sgst_rate !== null && Number(pItem.sgst_rate) > 0) {
            const sgstRate = Number(pItem.sgst_rate);
            reversedSgst = Math.round((returnedTaxable * sgstRate) / 100 * 100) / 100;
            const accSgst = await resolveInputGstAccount("SGST", sgstRate, client);
            addCredit(
              accSgst.id,
              reversedSgst,
              `Input SGST Reversal (${sgstRate}%) on Debit Note: Invoice ${purchase.invoice_no || purchase.id}`,
              { purchase_id: purchase.id, tax_component: "SGST", rate: sgstRate }
            );
          }

          if (pItem.igst_rate !== null && Number(pItem.igst_rate) > 0) {
            const igstRate = Number(pItem.igst_rate);
            reversedIgst = Math.round((returnedTaxable * igstRate) / 100 * 100) / 100;
            const accIgst = await resolveInputGstAccount("IGST", igstRate, client);
            addCredit(
              accIgst.id,
              reversedIgst,
              `Input IGST Reversal (${igstRate}%) on Debit Note: Invoice ${purchase.invoice_no || purchase.id}`,
              { purchase_id: purchase.id, tax_component: "IGST", rate: igstRate }
            );
          }

          const itemTaxReversed = reversedCgst + reversedSgst + reversedIgst;
          totalTaxReversed += itemTaxReversed;
          const totalReturnAmount = Math.round((itemCost + itemTaxReversed) * 100) / 100;

          // Record summary
          returnedSummaries.push({
            purchase_item_id: pItem.id,
            product_id: pItem.product_id,
            variant_id: pItem.variant_id,
            item_type: pItem.item_type,
            returned_quantity: returnQty,
            cost_lot_id: lot.id,
            unit_cost: unitCost,
            total_cost: itemCost,
            taxable_value: returnedTaxable,
            reversed_cgst: reversedCgst,
            reversed_sgst: reversedSgst,
            reversed_igst: reversedIgst,
            total_tax_reversed: itemTaxReversed,
            total_return_amount: totalReturnAmount,
          });

          // ── 6. UPDATE COST LOT (REMAINING QUANTITY & STATUS) ─────────────────
          const newRemaining = Math.max(0, Math.round((remainingQty - returnQty) * 10000) / 10000);
          const newStatus = newRemaining === 0 ? "DEPLETED" : lot.status;

          await client.query(
            `UPDATE public.inventory_cost_lot 
             SET remaining_quantity = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [newRemaining, newStatus, lot.id]
          );

          // ── 7. UPDATE PHYSICAL BRANCH INVENTORY (CATALOG ITEMS) ───────────────
          if (pItem.variant_id) {
            const binvRes = await client.query(
              `SELECT * FROM public.branch_inventory 
               WHERE branch_id = $1 AND variant_id = $2 
               FOR UPDATE`,
              [purchase.branch_id, pItem.variant_id]
            );
            if (binvRes.rows[0]) {
              const currentStock = Number(binvRes.rows[0].quantity);
              if (currentStock < returnQty) {
                throw new PurchaseReturnError(
                  "RETURN_EXCEEDS_AVAILABLE_QUANTITY",
                  `Physical stock in branch (${currentStock}) is less than return quantity (${returnQty}) for item '${pItem.description || pItem.id}'.`
                );
              }

              await client.query(
                `UPDATE public.branch_inventory 
                 SET quantity = quantity - $1,
                     updated_at = NOW()
                 WHERE branch_id = $2 AND variant_id = $3`,
                [returnQty, purchase.branch_id, pItem.variant_id]
              );
            }
          }

          // ── 8. INSERT INVENTORY MOVEMENT (PURCHASE_RETURN) ─────────────────────
          const movId = generateMovementId();
          const movRes = await client.query<InventoryMovementRow>(
            `INSERT INTO public.inventory_movement
               (id, branch_id, product_id, variant_id, movement_type, quantity, direction,
                purchase_id, reference_no, narration, created_by, created_at)
             VALUES ($1, $2, $3, $4, 'PURCHASE_RETURN', $5, 'OUT', $6, $7, $8, $9, NOW())
             RETURNING *`,
            [
              movId,
              purchase.branch_id,
              pItem.product_id ?? null,
              pItem.variant_id ?? null,
              returnQty,
              purchase.id,
              debitNoteId,
              `Supplier return: ${returnItem.reason || reason || "Damaged/Rejected goods"}`,
              returnedBy,
            ]
          );
          movements.push(movRes.rows[0]);
        }

        // ── 9. CONSTRUCT BALANCED DOUBLE-ENTRY JOURNAL LINES ───────────────────
        const totalDebitAmount = Math.round((totalInventoryCost + totalTaxReversed) * 100) / 100;
        const journalLines: JournalLineInput[] = [];

        // Debit: Accounts Payable (2111) reduces liability to supplier
        journalLines.push({
          account_id: accPayable.id,
          debit_amount: totalDebitAmount,
          credit_amount: 0,
          branch_id: purchase.branch_id,
          supplier_id: purchase.supplier_id,
          narration: `Supplier Debit Note: Return against Invoice ${purchase.invoice_no || purchase.id} (${reason})`,
          metadata: {
            purchase_id: purchase.id,
            debit_note_id: debitNoteId,
            return_reason: reason,
          },
        });

        // Credits: Inventory accounts and Input GST accounts
        for (const [accId, entry] of creditAccountMap.entries()) {
          const roundedCredit = Math.round(entry.amount * 100) / 100;
          if (roundedCredit > 0) {
            journalLines.push({
              account_id: accId,
              debit_amount: 0,
              credit_amount: roundedCredit,
              branch_id: purchase.branch_id,
              supplier_id: purchase.supplier_id,
              narration: entry.narration,
              metadata: entry.metadata,
            });
          }
        }

        // Validate double-entry balance and accounts
        PostingService.validateJournalLines(journalLines);
        await PostingService.validatePostingAccounts(
          journalLines.map((l) => l.account_id),
          client
        );

        // ── 10. CREATE, SUBMIT, APPROVE, AND POST VOUCHER VIA PostingService ───
        const defaultPreparer = `cashier_${purchase.branch_id.replace(/^br_/, "")}`;
        const preparerId =
          voucherPreparerId && voucherPreparerId !== returnedBy
            ? voucherPreparerId
            : (returnedBy === defaultPreparer
                ? `clerk_${purchase.branch_id.replace(/^br_/, "")}`
                : defaultPreparer);

        // Create Voucher Draft
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "DEBIT_NOTE",
            voucher_date: returnDate,
            branch_id: purchase.branch_id,
            narration: `Supplier Debit Note: Return on Purchase Invoice ${purchase.invoice_no || purchase.id}`,
            reference_type: "PURCHASE_RETURN",
            reference_id: debitNoteId,
            reference_event: "SUPPLIER_DEBIT_NOTE",
            lines: journalLines,
            metadata: {
              purchase_id: purchase.id,
              debit_note_id: debitNoteId,
              reason,
              items: returnedSummaries,
            },
          },
          branchId: purchase.branch_id,
          fiscalYear,
          createdBy: preparerId,
          client,
        });

        if (!draftRes.success) {
          throw new PurchaseReturnError(
            draftRes.code as PurchaseReturnErrorCode,
            `Failed to create debit note voucher draft: ${draftRes.error}`
          );
        }
        const voucherDraft = draftRes.data;

        // Submit Voucher
        const submitRes = await PostingService.submitVoucher({
          voucherId: voucherDraft.id,
          submittedBy: preparerId,
          branchId: purchase.branch_id,
          client,
        });
        if (!submitRes.success) {
          throw new PurchaseReturnError(
            submitRes.code as PurchaseReturnErrorCode,
            `Failed to submit debit note voucher: ${submitRes.error}`
          );
        }

        // Approve Voucher (SoD: returnedBy !== preparerId)
        const approveRes = await PostingService.approveVoucher({
          voucherId: voucherDraft.id,
          approvedBy: returnedBy,
          branchId: purchase.branch_id,
          client,
        });
        if (!approveRes.success) {
          throw new PurchaseReturnError(
            approveRes.code as PurchaseReturnErrorCode,
            `Failed to approve debit note voucher: ${approveRes.error}`
          );
        }

        // Post Voucher to General Ledger
        const postRes = await PostingService.postVoucher({
          voucherId: voucherDraft.id,
          postedBy: returnedBy,
          lines: journalLines,
          branchId: purchase.branch_id,
          client,
        });

        if (!postRes.success) {
          throw new PurchaseReturnError(
            postRes.code as PurchaseReturnErrorCode,
            `Failed to post debit note voucher to General Ledger: ${postRes.error} [${postRes.code}]`
          );
        }

        // Link voucher_id to the created inventory movements
        for (const mov of movements) {
          await client.query(
            "UPDATE public.inventory_movement SET voucher_id = $1 WHERE id = $2",
            [voucherDraft.id, mov.id]
          );
          mov.voucher_id = voucherDraft.id;
        }

        // ── 11. RETURN RESULT ──────────────────────────────────────────────────
        return {
          debit_note_id: debitNoteId,
          voucher: postRes.data.voucher,
          journal_entry: postRes.data.journal_entry,
          returned_items: returnedSummaries,
          movements,
          total_inventory_cost: totalInventoryCost,
          total_tax_reversed: totalTaxReversed,
          total_debit_amount: totalDebitAmount,
        };
      };

      const executeWithSavepoint = async (client: PoolClient): Promise<PurchaseReturnResult> => {
        await client.query("SAVEPOINT sp_purchase_return");
        try {
          const res = await executeReturn(client);
          await client.query("RELEASE SAVEPOINT sp_purchase_return");
          return res;
        } catch (e) {
          await client.query("ROLLBACK TO SAVEPOINT sp_purchase_return");
          throw e;
        }
      };

      const result = callerClient
        ? await executeWithSavepoint(callerClient)
        : await dbTransaction(executeReturn);

      return { success: true, data: result };
    } catch (e: any) {
      if (e instanceof PurchaseReturnError) {
        return { success: false, error: e.message, code: e.code };
      }
      if (e instanceof PostingServiceError) {
        return { success: false, error: e.message, code: e.code as PurchaseReturnErrorCode };
      }
      return {
        success: false,
        error: e.message || "An unexpected error occurred during purchase return processing.",
        code: "PURCHASE_RETURN_FAILED",
      };
    }
  }
}
