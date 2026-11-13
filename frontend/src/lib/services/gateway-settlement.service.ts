/**
 * CakeToHome ERP — Gateway Settlement Service
 * Phase 4F Step 4.10 Substep 4.10.3: Gateway Payout Batch & Order Settlement Allocation
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - All operations execute direct parameterized SQL against PostgreSQL.
 * 2. BRANCH ATTRIBUTION GROUND TRUTH:
 *    - Order has NO relational branch_id column.
 *    - The authoritative relational source is payment_transaction.branch_id.
 *    - If order.metadata->>'branch_id' exists, it MUST equal payment_transaction.branch_id.
 *      Mismatch -> BRANCH_RELATIONSHIP_MISMATCH.
 *      Missing/unverified -> SETTLEMENT_ORDER_BRANCH_UNVERIFIED.
 * 3. BRANCH-PARTITIONED VOUCHERS (ADR-4.10-02 Model A):
 *    - Cross-branch mixing in a single voucher is strictly forbidden.
 *    - Allocations are partitioned by settlement_branch_id.
 *    - Exactly one RECEIPT voucher is generated per branch:
 *        Dr 1112 Bank Operating A/c       [Net Share]
 *        Dr 5290 Payment Gateway MDR Fees [MDR Share: Identified Fee + Reported Tax]
 *        Cr 1113 Gateway Clearing         [Gross Share]
 *    - Balanced: Net Share + MDR Share == Gross Share.
 * 4. FINANCIAL MATH & ROUNDING INTEGRITY:
 *    - Gross - Fee - Tax - Deductions ± Rounding == Net in exact integer paise.
 *    - Controlled rounding variance up to ₹1.00 (100 paise) permitted.
 *    - Discrepancy > ₹1.00 fails closed with SETTLEMENT_VARIANCE_MISMATCH.
 * 5. OTHER DEDUCTIONS INTEGRITY:
 *    - If other_deductions_amount > 0 without documented evidence:
 *      fails closed with UNRECONCILED_SETTLEMENT_EXCEPTION.
 * 6. GST ON MDR TREATMENT:
 *    - Daily settlement does NOT post to Input Tax accounts (1143, 1144, 1146).
 *    - Processing expense remains in 5290. ITC reclassification is deferred to monthly invoice audit.
 * 7. STRICT 3-TIER SEGREGATION OF DUTIES (SoD):
 *    - prepared_by != approved_by != posted_by.
 *    - SUPER_ADMIN cannot bypass SoD.
 * 8. DETERMINISTIC LOCK ORDERING:
 *    - gateway_payout_batch -> gateway_settlement_order -> payment_transaction -> bank_account -> accounting_voucher.
 * 9. HARD ACCOUNTING CONFIGURATION GUARDS:
 *    - Fails closed if accounting_start_date is unconfigured or fiscal period is missing/locked.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  GatewayPayoutRepository,
  GatewayPayoutError,
} from "../repositories/gateway-payout.repository";
import {
  GatewaySettlementOrderRepository,
  GatewaySettlementOrderError,
} from "../repositories/gateway-settlement-order.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  GatewayPayoutBatchRow,
  GatewaySettlementOrderRow,
  GatewayPayoutStatus,
  GatewaySettlementErrorCode,
  IngestGatewayPayoutBatchParams,
  ApproveGatewayPayoutBatchParams,
  PostGatewayPayoutSettlementParams,
  CancelGatewayPayoutBatchParams,
  GatewayPayoutBatchResult,
  ListGatewayPayoutBatchesFilter,
  JournalLineInput,
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
} from "../types/accounting.types";

export class GatewaySettlementServiceError extends Error {
  readonly code: GatewaySettlementErrorCode;

  constructor(code: GatewaySettlementErrorCode, message: string) {
    super(message);
    this.name = "GatewaySettlementServiceError";
    this.code = code;
  }
}

export class GatewaySettlementService {
  /**
   * Helper to resolve actor context safely.
   */
  private static resolveActorScope(actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    [key: string]: unknown;
  }): { isSuperAdmin: boolean; actorBranch: string | null; actorId: string } {
    if (!actorContext) {
      throw new GatewaySettlementServiceError(
        "PERMISSION_DENIED",
        "Missing actor context for gateway settlement operation."
      );
    }

    const role = (actorContext.role || "").toUpperCase();
    const actorId = actorContext.id || actorContext.user_id || "";
    const isSuperAdmin = role === "SUPER_ADMIN";
    const actorBranch = actorContext.branch_id || actorContext.branchId || null;

    return { isSuperAdmin, actorBranch, actorId };
  }

  /**
   * Ingests a new gateway payout batch and validates order settlement allocations.
   * Status transitions to INGESTED (or EXCEPTION).
   */
  static async ingestPayoutBatch(
    params: IngestGatewayPayoutBatchParams,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchResult> {
    const { isSuperAdmin } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "GATEWAY.SETTLE_PREPARE");

    if (!hasPerm) {
      throw new GatewaySettlementServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission (GATEWAY.SETTLE_PREPARE) to ingest gateway payout batches."
      );
    }

    const execute = async (c: PoolClient): Promise<GatewayPayoutBatchResult> => {
      // 1. Idempotency Check on (provider, payout_reference)
      const existingBatch = await GatewayPayoutRepository.findByProviderAndReference(
        params.provider,
        params.payout_reference,
        c,
        false
      );

      if (existingBatch) {
        if (existingBatch.status === "POSTED") {
          const orders = await GatewaySettlementOrderRepository.findByBatchId(existingBatch.id, c);
          return {
            payoutBatch: existingBatch,
            settlementOrders: orders,
            wasDuplicate: true,
          };
        }
        if (existingBatch.status !== "CANCELLED") {
          throw new GatewaySettlementServiceError(
            "DUPLICATE_PAYOUT_REFERENCE",
            `Gateway payout batch with provider '${params.provider}' and reference '${params.payout_reference}' already exists.`
          );
        }
      }

      // 2. Validate Bank Account
      const bankAccount = await BankAccountRepository.findById(params.bank_account_id, c, false);
      if (!bankAccount) {
        throw new GatewaySettlementServiceError(
          "BANK_ACCOUNT_NOT_FOUND",
          `Bank account '${params.bank_account_id}' not found.`
        );
      }
      if (bankAccount.status === "INACTIVE") {
        throw new GatewaySettlementServiceError(
          "BANK_ACCOUNT_INACTIVE",
          `Destination bank account '${params.bank_account_id}' is INACTIVE.`
        );
      }
      if (bankAccount.status === "FROZEN") {
        throw new GatewaySettlementServiceError(
          "BANK_ACCOUNT_FROZEN",
          `Destination bank account '${params.bank_account_id}' is FROZEN.`
        );
      }

      // 3. Financial Math Integrity in Integer Paise
      const grossPaise = Math.round(Number(params.gross_amount) * 100);
      const feePaise = Math.round(Number(params.identified_fee_amount ?? 0) * 100);
      const taxPaise = Math.round(Number(params.reported_tax_amount ?? 0) * 100);
      const otherPaise = Math.round(Number(params.other_deductions_amount ?? 0) * 100);
      const netPaise = Math.round(Number(params.net_amount) * 100);
      const roundingPaise = Math.round(Number(params.rounding_variance ?? 0) * 100);

      // Check non-negativity
      if (grossPaise < 0 || feePaise < 0 || taxPaise < 0 || otherPaise < 0 || netPaise < 0) {
        throw new GatewaySettlementServiceError(
          "SETTLEMENT_MATH_MISMATCH",
          "Settlement financial amounts must be non-negative."
        );
      }

      // Verify exact arithmetic identity
      const calculatedNetPaise = grossPaise - feePaise - taxPaise - otherPaise + roundingPaise;
      if (calculatedNetPaise !== netPaise) {
        throw new GatewaySettlementServiceError(
          "SETTLEMENT_MATH_MISMATCH",
          `Settlement financial equation mismatch: Gross (${grossPaise}p) - Fee (${feePaise}p) - Tax (${taxPaise}p) - Other (${otherPaise}p) + Rounding (${roundingPaise}p) != Net (${netPaise}p).`
        );
      }

      // 4. Controlled Rounding Variance Policy (Max ₹1.00 / 100 paise)
      if (Math.abs(roundingPaise) > 100) {
        throw new GatewaySettlementServiceError(
          "SETTLEMENT_VARIANCE_MISMATCH",
          `Settlement rounding variance ${Math.abs(roundingPaise)} paise exceeds allowable maximum of 100 paise (₹1.00).`
        );
      }

      // 5. Other Deductions Accounting Control
      const hasDeductionEvidence = Boolean(
        params.metadata?.authorized_deduction_reason ||
        params.metadata?.deduction_category ||
        params.metadata?.deduction_evidence
      );

      if (otherPaise > 0 && !hasDeductionEvidence) {
        throw new GatewaySettlementServiceError(
          "UNRECONCILED_SETTLEMENT_EXCEPTION",
          `Payout includes other deductions (${params.other_deductions_amount}) without authoritative documentation/category evidence.`
        );
      }

      // 6. Validate Orders and Transactions
      if (!params.orders || params.orders.length === 0) {
        throw new GatewaySettlementServiceError(
          "SETTLEMENT_ALLOCATION_MISMATCH",
          "At least one order settlement allocation is required."
        );
      }

      // Batch gross sum vs Order gross sum check
      let sumOrderGrossPaise = 0;
      let sumOrderNetPaise = 0;

      for (const ord of params.orders) {
        const oGross = Math.round(Number(ord.allocated_gross_amount) * 100);
        const oFee = ord.identified_fee_amount !== undefined
          ? Math.round(Number(ord.identified_fee_amount) * 100)
          : (params.orders.length === 1 ? feePaise : 0);
        const oTax = ord.reported_tax_amount !== undefined
          ? Math.round(Number(ord.reported_tax_amount) * 100)
          : (params.orders.length === 1 ? taxPaise : 0);
        const oOther = ord.other_deductions_amount !== undefined
          ? Math.round(Number(ord.other_deductions_amount) * 100)
          : (params.orders.length === 1 ? otherPaise : 0);
        const oNet = oGross - oFee - oTax - oOther;

        sumOrderGrossPaise += oGross;
        sumOrderNetPaise += oNet;
      }

      if (sumOrderGrossPaise !== grossPaise) {
        throw new GatewaySettlementServiceError(
          "SETTLEMENT_ALLOCATION_MISMATCH",
          `Sum of allocated order gross amounts (${sumOrderGrossPaise}p) does not equal batch gross amount (${grossPaise}p).`
        );
      }

      if (Math.abs(sumOrderNetPaise + roundingPaise - netPaise) > 100) {
        throw new GatewaySettlementServiceError(
          "SETTLEMENT_ALLOCATION_MISMATCH",
          `Sum of allocated order net amounts (${sumOrderNetPaise}p) plus rounding does not balance batch net amount (${netPaise}p).`
        );
      }

      // 7. Verify Each Payment Transaction & Linked Order
      const validatedAllocations: Array<{
        payment_transaction_id: string;
        order_id: string;
        settlement_branch_id: string;
        allocated_gross_amount: number;
        identified_fee_amount: number;
        reported_tax_amount: number;
        other_deductions_amount: number;
        allocated_net_amount: number;
        allocation_status: "VALIDATED" | "EXCEPTION";
        exception_reason: string | null;
        provider_payment_id: string | null;
        metadata: Record<string, unknown>;
      }> = [];

      let exceptionCount = 0;

      // Deterministic lock ordering: sort orders by payment_transaction_id to prevent concurrency deadlocks
      const sortedOrders = [...params.orders].sort((a, b) =>
        a.payment_transaction_id.localeCompare(b.payment_transaction_id)
      );

      for (const ord of sortedOrders) {
        // Fetch and lock transaction FOR UPDATE (deterministic locking hierarchy)
        const txnRes = await c.query(
          `SELECT id, branch_id, order_id, amount, provider, status, settlement_status, created_at, deleted_at
           FROM public.payment_transaction
           WHERE id = $1
           FOR UPDATE`,
          [ord.payment_transaction_id]
        );

        if (txnRes.rows.length === 0) {
          throw new GatewaySettlementServiceError(
            "PAYMENT_TRANSACTION_NOT_FOUND",
            `Payment transaction '${ord.payment_transaction_id}' not found in database.`
          );
        }

        const txn = txnRes.rows[0];

        // Legacy prototype quarantine rule:
        // Transactions from the prototype baseline (e.g. COD or created before the accounting baseline) cannot be settled
        const txnCreatedAt = new Date(txn.created_at).getTime();
        const isPrototype = txn.provider === "cod" || txnCreatedAt < new Date("2026-09-25T00:00:00Z").getTime();
        if (isPrototype) {
          throw new GatewaySettlementServiceError(
            "ORDER_ALREADY_SETTLED",
            `Transaction '${txn.id}' is a quarantined legacy prototype record and cannot be settled into accounting.`
          );
        }

        // Transaction double-settlement check across batches (executed after acquiring row lock)
        const existingAlloc = await GatewaySettlementOrderRepository.findActiveByTransactionId(
          txn.id,
          undefined,
          c
        );
        if (existingAlloc) {
          throw new GatewaySettlementServiceError(
            "ORDER_ALREADY_SETTLED",
            `Payment transaction '${txn.id}' is already actively allocated to payout batch '${existingAlloc.payout_batch_id}'.`
          );
        }

        // Amount verification: gross must equal payment_transaction.amount
        const txnAmountPaise = Math.round(Number(txn.amount) * 100);
        const allocGrossPaise = Math.round(Number(ord.allocated_gross_amount) * 100);
        if (txnAmountPaise !== allocGrossPaise) {
          throw new GatewaySettlementServiceError(
            "SETTLEMENT_ALLOCATION_MISMATCH",
            `Allocated gross amount (${ord.allocated_gross_amount}) does not equal transaction amount (${txn.amount}) for transaction '${txn.id}'.`
          );
        }

        // Linked order verification
        const orderRes = await c.query(
          `SELECT id, metadata, deleted_at, canceled_at
           FROM public."order"
           WHERE id = $1`,
          [ord.order_id]
        );

        if (orderRes.rows.length === 0) {
          throw new GatewaySettlementServiceError(
            "ORDER_NOT_FOUND",
            `Linked order '${ord.order_id}' for transaction '${txn.id}' not found in database.`
          );
        }

        const orderRow = orderRes.rows[0];
        if (orderRow.deleted_at) {
          throw new GatewaySettlementServiceError(
            "ORDER_NOT_FOUND",
            `Linked order '${ord.order_id}' has been deleted.`
          );
        }

        // Branch verification:
        // payment_transaction.branch_id is the primary relational authority.
        // If order.metadata->>'branch_id' is present, it MUST match.
        // If missing or empty, fail with SETTLEMENT_ORDER_BRANCH_UNVERIFIED.
        const orderMetaBranch = orderRow.metadata?.branch_id;
        if (!orderMetaBranch || typeof orderMetaBranch !== "string" || orderMetaBranch.trim() === "") {
          throw new GatewaySettlementServiceError(
            "SETTLEMENT_ORDER_BRANCH_UNVERIFIED",
            `Linked order '${ord.order_id}' contains no verifiable branch identity in metadata.`
          );
        }

        if (orderMetaBranch.trim() !== txn.branch_id) {
          throw new GatewaySettlementServiceError(
            "BRANCH_RELATIONSHIP_MISMATCH",
            `Branch mismatch: payment_transaction.branch_id ('${txn.branch_id}') does not match order.metadata.branch_id ('${orderMetaBranch}').`
          );
        }

        const oFee = ord.identified_fee_amount !== undefined
          ? Number(ord.identified_fee_amount)
          : (params.orders.length === 1 ? Number(params.identified_fee_amount ?? 0) : 0);
        const oTax = ord.reported_tax_amount !== undefined
          ? Number(ord.reported_tax_amount)
          : (params.orders.length === 1 ? Number(params.reported_tax_amount ?? 0) : 0);
        const oOther = ord.other_deductions_amount !== undefined
          ? Number(ord.other_deductions_amount)
          : (params.orders.length === 1 ? Number(params.other_deductions_amount ?? 0) : 0);
        const oNet = Number(ord.allocated_gross_amount) - oFee - oTax - oOther;

        validatedAllocations.push({
          payment_transaction_id: txn.id,
          order_id: ord.order_id,
          settlement_branch_id: txn.branch_id,
          allocated_gross_amount: ord.allocated_gross_amount,
          identified_fee_amount: oFee,
          reported_tax_amount: oTax,
          other_deductions_amount: oOther,
          allocated_net_amount: oNet,
          allocation_status: "VALIDATED",
          exception_reason: null,
          provider_payment_id: ord.provider_payment_id || null,
          metadata: ord.metadata || {},
        });
      }

      // 8. Create Gateway Payout Batch Record
      const batchStatus: GatewayPayoutStatus = exceptionCount > 0 ? "EXCEPTION" : "INGESTED";
      const createdBatch = await GatewayPayoutRepository.create(
        {
          company_id: params.company_id || await CompanyRepository.resolveCompanyId(),
          provider: params.provider,
          payout_reference: params.payout_reference,
          settlement_reference: params.settlement_reference || null,
          bank_account_id: params.bank_account_id,
          settlement_date: params.settlement_date,
          bank_value_date: params.bank_value_date || null,
          gross_amount: params.gross_amount,
          identified_fee_amount: params.identified_fee_amount ?? 0,
          reported_tax_amount: params.reported_tax_amount ?? 0,
          other_deductions_amount: params.other_deductions_amount ?? 0,
          net_amount: params.net_amount,
          rounding_variance: params.rounding_variance ?? 0,
          currency: params.currency || "INR",
          status: batchStatus,
          unreconciled_exception_count: exceptionCount,
          ingestion_source: params.ingestion_source || "MANUAL",
          prepared_by: params.prepared_by,
          metadata: params.metadata || {},
        },
        c
      );

      // 9. Create Settlement Order Allocations
      const createdAllocations = await GatewaySettlementOrderRepository.createAllocations(
        validatedAllocations.map((a) => ({
          payout_batch_id: createdBatch.id,
          ...a,
        })),
        c
      );

      return {
        payoutBatch: createdBatch,
        settlementOrders: createdAllocations,
        wasDuplicate: false,
      };
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Approves an ingested payout batch.
   * Enforces 3-tier SoD: approvedBy != prepared_by.
   * SUPER_ADMIN cannot self-approve.
   */
  static async approvePayoutBatch(
    params: ApproveGatewayPayoutBatchParams,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow> {
    const { isSuperAdmin } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "GATEWAY.SETTLE_APPROVE");

    if (!hasPerm) {
      throw new GatewaySettlementServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission (GATEWAY.SETTLE_APPROVE) to approve gateway payout batches."
      );
    }

    const execute = async (c: PoolClient): Promise<GatewayPayoutBatchRow> => {
      // 1. Lock batch FOR UPDATE
      const batch = await GatewayPayoutRepository.findById(params.payoutBatchId, c, true);
      if (!batch) {
        throw new GatewaySettlementServiceError(
          "INVALID_PAYOUT_STATUS",
          `Gateway payout batch '${params.payoutBatchId}' not found.`
        );
      }

      if (batch.status === "APPROVED") {
        return batch;
      }

      if (batch.status === "POSTED") {
        throw new GatewaySettlementServiceError(
          "POSTED_PAYOUT_IMMUTABLE",
          "Cannot approve an already POSTED gateway payout batch."
        );
      }

      // Check exceptions
      if (batch.status === "EXCEPTION" || batch.unreconciled_exception_count > 0) {
        throw new GatewaySettlementServiceError(
          "UNRECONCILED_SETTLEMENT_EXCEPTION",
          "Cannot approve a payout batch with unreconciled exceptions."
        );
      }

      if (batch.status !== "INGESTED" && batch.status !== "PARTITIONED") {
        throw new GatewaySettlementServiceError(
          "INVALID_PAYOUT_STATUS",
          `Cannot approve payout batch in status '${batch.status}'.`
        );
      }

      // Strict SoD: Preparer cannot approve own batch (SUPER_ADMIN cannot bypass!)
      if (batch.prepared_by === params.approvedBy) {
        throw new GatewaySettlementServiceError(
          "SELF_APPROVAL_FORBIDDEN",
          `Segregation of Duties violation: Preparer '${batch.prepared_by}' cannot approve their own gateway payout batch.`
        );
      }

      return await GatewayPayoutRepository.recordApproval(params.payoutBatchId, params.approvedBy, c);
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Posts branch-partitioned vouchers to the General Ledger for an approved payout batch.
   * Lock order: gateway_payout_batch -> gateway_settlement_order -> bank_account -> accounting_voucher.
   *
   * Branch Posting for each branch K:
   * Dr 1112 Bank Operating A/c       [Net Share K]
   * Dr 5290 Payment Gateway MDR Fees [MDR Share K]
   * Cr 1113 Gateway Clearing         [Gross Share K]
   */
  static async postPayoutSettlement(
    params: PostGatewayPayoutSettlementParams,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchResult> {
    const { isSuperAdmin } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "GATEWAY.SETTLE_POST") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");

    if (!hasPerm) {
      throw new GatewaySettlementServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission (GATEWAY.SETTLE_POST or ACCOUNTING.POST) to post gateway settlement vouchers."
      );
    }

    const execute = async (c: PoolClient): Promise<GatewayPayoutBatchResult> => {
      // 1. Lock gateway_payout_batch FOR UPDATE
      const batch = await GatewayPayoutRepository.findById(params.payoutBatchId, c, true);
      if (!batch) {
        throw new GatewaySettlementServiceError(
          "INVALID_PAYOUT_STATUS",
          `Gateway payout batch '${params.payoutBatchId}' not found.`
        );
      }

      // Idempotency: if already POSTED, return existing result
      if (batch.status === "POSTED") {
        const orders = await GatewaySettlementOrderRepository.findByBatchId(batch.id, c);
        return {
          payoutBatch: batch,
          settlementOrders: orders,
          wasDuplicate: true,
        };
      }

      // Status check: must be APPROVED before GL posting
      if (batch.status !== "APPROVED" && batch.status !== "PARTITIONED") {
        throw new GatewaySettlementServiceError(
          "INVALID_PAYOUT_STATUS",
          `Cannot post gateway payout batch in status '${batch.status}'. Batch must be APPROVED before posting.`
        );
      }

      // Check exceptions
      if (batch.unreconciled_exception_count > 0) {
        throw new GatewaySettlementServiceError(
          "UNRECONCILED_SETTLEMENT_EXCEPTION",
          "Cannot post a payout batch with unreconciled exceptions."
        );
      }

      // 2. Strict 3-Tier SoD:
      // Poster cannot be preparer or approver (SUPER_ADMIN cannot bypass!)
      if (params.postedBy === batch.prepared_by) {
        throw new GatewaySettlementServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Preparer '${batch.prepared_by}' cannot post the settlement voucher.`
        );
      }

      if (batch.approved_by && params.postedBy === batch.approved_by) {
        throw new GatewaySettlementServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Approver '${batch.approved_by}' cannot post the settlement voucher.`
        );
      }

      // 3. Lock gateway_settlement_order rows FOR UPDATE
      const allocations = await GatewaySettlementOrderRepository.findByBatchId(batch.id, c, true);
      if (allocations.length === 0) {
        throw new GatewaySettlementServiceError(
          "SETTLEMENT_ALLOCATION_MISMATCH",
          `No order settlement allocations found for payout batch '${batch.id}'.`
        );
      }

      // Check if any allocation is in EXCEPTION status
      const exceptionOrder = allocations.find((a) => a.allocation_status === "EXCEPTION");
      if (exceptionOrder) {
        throw new GatewaySettlementServiceError(
          "UNRECONCILED_SETTLEMENT_EXCEPTION",
          `Order '${exceptionOrder.order_id}' is in EXCEPTION status (${exceptionOrder.exception_reason}). Cannot post.`
        );
      }

      // 4. Lock payment_transaction rows FOR UPDATE in deterministic order (gateway_payout_batch -> gateway_settlement_order -> payment_transaction -> bank_account)
      const txnIdsToLock = [...new Set(allocations.map((a) => a.payment_transaction_id))].sort();
      if (txnIdsToLock.length > 0) {
        await c.query(
          `SELECT id FROM public.payment_transaction WHERE id = ANY($1) ORDER BY id FOR UPDATE`,
          [txnIdsToLock]
        );
      }

      // 5. Lock bank_account FOR UPDATE
      const bankAccount = await BankAccountRepository.findById(batch.bank_account_id, c, true);
      if (!bankAccount) {
        throw new GatewaySettlementServiceError(
          "BANK_ACCOUNT_NOT_FOUND",
          `Destination bank account '${batch.bank_account_id}' not found.`
        );
      }
      if (bankAccount.status === "INACTIVE") {
        throw new GatewaySettlementServiceError(
          "BANK_ACCOUNT_INACTIVE",
          `Destination bank account '${batch.bank_account_id}' is INACTIVE.`
        );
      }
      if (bankAccount.status === "FROZEN") {
        throw new GatewaySettlementServiceError(
          "BANK_ACCOUNT_FROZEN",
          `Destination bank account '${batch.bank_account_id}' is FROZEN.`
        );
      }

      const voucherDate = params.voucherDate || batch.settlement_date;

      // 5. HARD ACCOUNTING CONFIGURATION GUARDS
      // A. Accounting start date guard
      try {
        await PostingService.validateAccountingStartDate(voucherDate, c);
      } catch (err: any) {
        if (err instanceof PostingServiceError) {
          throw new GatewaySettlementServiceError(err.code as GatewaySettlementErrorCode, err.message);
        }
        throw err;
      }

      // B. Fiscal period guard
      let fiscalPeriod;
      try {
        fiscalPeriod = await PostingService.validateFiscalPeriod(voucherDate, c);
      } catch (err: any) {
        if (err instanceof PostingServiceError) {
          throw new GatewaySettlementServiceError(err.code as GatewaySettlementErrorCode, err.message);
        }
        throw err;
      }

      // C. Control Accounts Validation: Bank Account GL, 5290 (MDR Fees), 1113 (Gateway Clearing), 5295 (Rounding)
      const targetBankGlId = bankAccount.gl_account_id;
      const accountsRes = await c.query(
        `SELECT id, code, name, is_active, is_group
         FROM public.accounting_account
         WHERE (id = $1 OR code IN ('5290', '1113', '5295')) AND deleted_at IS NULL`,
        [targetBankGlId]
      );

      const accMap = new Map<string, any>();
      for (const row of accountsRes.rows) {
        accMap.set(row.code, row);
        accMap.set(row.id, row);
      }

      const bankGlAccount = accMap.get(targetBankGlId);
      if (!bankGlAccount || !bankGlAccount.is_active || bankGlAccount.is_group) {
        throw new GatewaySettlementServiceError(
          "CONTROL_ACCOUNT_INACTIVE",
          `Bank GL Account (${bankAccount.gl_account_code || targetBankGlId}) is missing, inactive, or a group account.`
        );
      }

      const acc5290 = accMap.get("5290");
      if (!acc5290 || !acc5290.is_active || acc5290.is_group) {
        throw new GatewaySettlementServiceError(
          "CONTROL_ACCOUNT_INACTIVE",
          "Control Account 5290 (Payment Gateway MDR Fees) is missing, inactive, or a group account."
        );
      }

      const acc1113 = accMap.get("1113");
      if (!acc1113 || !acc1113.is_active || acc1113.is_group) {
        throw new GatewaySettlementServiceError(
          "CONTROL_ACCOUNT_INACTIVE",
          "Control Account 1113 (Gateway Clearing) is missing, inactive, or a group account."
        );
      }

      const acc5295 = accMap.get("5295");

      // 6. BRANCH-PARTITIONED VOUCHER POSTING (ADR-4.10-02 Model A)
      // Group allocations strictly by settlement_branch_id
      const branchAllocationsMap = new Map<string, GatewaySettlementOrderRow[]>();
      for (const alloc of allocations) {
        const bId = alloc.settlement_branch_id;
        if (!branchAllocationsMap.has(bId)) {
          branchAllocationsMap.set(bId, []);
        }
        branchAllocationsMap.get(bId)!.push(alloc);
      }

      const createdVouchers: AccountingVoucherRow[] = [];
      const createdJournals: (AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] })[] = [];

      // Calculate any batch-level rounding variance
      const roundingVarianceNum = Number(batch.rounding_variance);
      let remainingRoundingVariance = roundingVarianceNum;

      for (const [branchId, branchOrders] of branchAllocationsMap.entries()) {
        let branchGross = 0;
        let branchFee = 0;
        let branchTax = 0;
        let branchOther = 0;

        for (const bo of branchOrders) {
          branchGross += Number(bo.allocated_gross_amount);
          branchFee += Number(bo.identified_fee_amount);
          branchTax += Number(bo.reported_tax_amount);
          branchOther += Number(bo.other_deductions_amount);
        }

        const branchMDR = branchFee + branchTax;
        let branchNet = branchGross - branchMDR - branchOther;

        // Apply remaining rounding variance to the first branch partition if applicable
        let branchRounding = 0;
        if (remainingRoundingVariance !== 0) {
          branchRounding = remainingRoundingVariance;
          branchNet += branchRounding;
          remainingRoundingVariance = 0;
        }

        // Lines for Branch K:
        // Dr Bank GL A/c                   [Net Share]
        // Dr 5290 Payment Gateway MDR Fees [MDR Share: Fee + Tax]
        // Cr 1113 Gateway Clearing         [Gross Share]
        // (Optional: Dr/Cr 5295 if rounding variance is present)
        const orderIds = branchOrders.map((o) => o.order_id);
        const txnIds = branchOrders.map((o) => o.payment_transaction_id);

        const lines: JournalLineInput[] = [
          {
            account_id: bankGlAccount.id,
            debit_amount: branchNet,
            credit_amount: 0,
            narration: `Net settlement credit from ${batch.provider.toUpperCase()} - Payout: ${batch.payout_reference} (Branch: ${branchId})`,
            metadata: {
              payout_batch_id: batch.id,
              payout_reference: batch.payout_reference,
              provider: batch.provider,
              settlement_branch_id: branchId,
              bank_account_id: batch.bank_account_id,
              bank_gl_code: bankGlAccount.code,
              order_ids: orderIds,
              payment_transaction_ids: txnIds,
            },
          },
          {
            account_id: acc5290.id,
            debit_amount: branchMDR,
            credit_amount: 0,
            narration: `Gateway MDR fees (${batch.provider.toUpperCase()}) - Payout: ${batch.payout_reference} (Branch: ${branchId})`,
            metadata: {
              payout_batch_id: batch.id,
              payout_reference: batch.payout_reference,
              provider: batch.provider,
              settlement_branch_id: branchId,
              identified_fee: branchFee,
              reported_tax: branchTax,
            },
          },
        ];

        // If branchRounding != 0, balance via 5295 Cash Rounding / Variance
        if (branchRounding !== 0 && acc5295) {
          if (branchRounding > 0) {
            // Net is larger by branchRounding -> Cr 5295
            lines.push({
              account_id: acc5295.id,
              debit_amount: 0,
              credit_amount: branchRounding,
              narration: `Settlement rounding variance credit - Payout: ${batch.payout_reference}`,
              metadata: { payout_batch_id: batch.id, branch_id: branchId },
            });
          } else {
            // Net is smaller by branchRounding -> Dr 5295
            lines.push({
              account_id: acc5295.id,
              debit_amount: Math.abs(branchRounding),
              credit_amount: 0,
              narration: `Settlement rounding variance debit - Payout: ${batch.payout_reference}`,
              metadata: { payout_batch_id: batch.id, branch_id: branchId },
            });
          }
        }

        // Cr 1113 Gateway Clearing
        lines.push({
          account_id: acc1113.id,
          debit_amount: 0,
          credit_amount: branchGross,
          narration: `Gateway clearing clearance (${batch.provider.toUpperCase()}) - Payout: ${batch.payout_reference} (Branch: ${branchId})`,
          metadata: {
            payout_batch_id: batch.id,
            payout_reference: batch.payout_reference,
            provider: batch.provider,
            settlement_branch_id: branchId,
            order_ids: orderIds,
            payment_transaction_ids: txnIds,
          },
        });

        // Create Voucher Draft for this single branch
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "RECEIPT",
            voucher_date: voucherDate,
            branch_id: branchId,
            narration: `Gateway payout settlement - ${batch.provider.toUpperCase()} - Ref: ${batch.payout_reference} (Branch: ${branchId})`,
            reference_type: "GATEWAY_PAYOUT",
            reference_id: `${batch.payout_reference}_${branchId}`,
            reference_event: "GATEWAY_SETTLEMENT",
            metadata: {
              source_module: "GATEWAY_PAYOUT",
              payout_batch_id: batch.id,
              payout_reference: batch.payout_reference,
              provider: batch.provider,
              bank_account_id: batch.bank_account_id,
              branch_id: branchId,
              order_ids: orderIds,
              payment_transaction_ids: txnIds,
            },
          },
          branchId,
          fiscalYear: fiscalPeriod.fiscal_year || "FY2026-27",
          createdBy: batch.prepared_by,
          client: c,
        });

        if (!draftRes.success) {
          throw new GatewaySettlementServiceError(draftRes.code as GatewaySettlementErrorCode, draftRes.error);
        }
        const draftVoucher = draftRes.data;

        // Submit Voucher
        const submitRes = await PostingService.submitVoucher({
          voucherId: draftVoucher.id,
          submittedBy: batch.prepared_by,
          branchId,
          client: c,
        });
        if (!submitRes.success) {
          throw new GatewaySettlementServiceError(submitRes.code as GatewaySettlementErrorCode, submitRes.error);
        }

        // Approve Voucher (using batch's approved_by or supervisor)
        const voucherApprover = batch.approved_by || params.postedBy;
        const approveRes = await PostingService.approveVoucher({
          voucherId: draftVoucher.id,
          approvedBy: voucherApprover,
          branchId,
          client: c,
        });
        if (!approveRes.success) {
          throw new GatewaySettlementServiceError(approveRes.code as GatewaySettlementErrorCode, approveRes.error);
        }

        // Post Voucher to GL
        const postRes = await PostingService.postVoucher({
          voucherId: draftVoucher.id,
          postedBy: params.postedBy,
          lines,
          branchId,
          client: c,
        });
        if (!postRes.success) {
          throw new GatewaySettlementServiceError(postRes.code as GatewaySettlementErrorCode, postRes.error);
        }

        createdVouchers.push(postRes.data.voucher);
        createdJournals.push(postRes.data.journal_entry);

        // Link voucher to all allocations for this branch
        await GatewaySettlementOrderRepository.recordVoucherLinkForBranch(
          batch.id,
          branchId,
          postRes.data.voucher.id,
          c
        );
      }

      // 7. Update Batch Status to POSTED
      const updatedBatch = await GatewayPayoutRepository.recordPosting(batch.id, params.postedBy, c);
      const updatedOrders = await GatewaySettlementOrderRepository.findByBatchId(batch.id, c);

      return {
        payoutBatch: updatedBatch,
        settlementOrders: updatedOrders,
        vouchers: createdVouchers,
        journalEntries: createdJournals,
        wasDuplicate: false,
      };
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Cancels a payout batch before posting.
   */
  static async cancelPayoutBatch(
    params: CancelGatewayPayoutBatchParams,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow> {
    const { isSuperAdmin } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "GATEWAY.SETTLE_PREPARE") ||
      hasEffectivePermission(params.actorContext, "GATEWAY.SETTLE_APPROVE");

    if (!hasPerm) {
      throw new GatewaySettlementServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission to cancel gateway payout batches."
      );
    }

    const execute = async (c: PoolClient): Promise<GatewayPayoutBatchRow> => {
      const batch = await GatewayPayoutRepository.findById(params.payoutBatchId, c, true);
      if (!batch) {
        throw new GatewaySettlementServiceError(
          "INVALID_PAYOUT_STATUS",
          `Gateway payout batch '${params.payoutBatchId}' not found.`
        );
      }

      if (batch.status === "POSTED") {
        throw new GatewaySettlementServiceError(
          "POSTED_PAYOUT_IMMUTABLE",
          "Cannot cancel an already POSTED gateway payout batch."
        );
      }

      return await GatewayPayoutRepository.cancelBatch(
        params.payoutBatchId,
        params.cancelledBy,
        params.reason,
        c
      );
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Retrieves a payout batch by ID along with its settlement order allocations.
   */
  static async getBatchById(
    id: string,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchResult | null> {
    const batch = await GatewayPayoutRepository.findById(id, client);
    if (!batch) return null;

    const orders = await GatewaySettlementOrderRepository.findByBatchId(id, client);
    return {
      payoutBatch: batch,
      settlementOrders: orders,
    };
  }

  /**
   * Lists gateway payout batches.
   */
  static async listBatches(
    filter: ListGatewayPayoutBatchesFilter = {},
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow[]> {
    return await GatewayPayoutRepository.list(filter, client);
  }
}
