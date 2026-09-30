/**
 * CakeToHome ERP — Gateway Settlement Order Repository
 * Phase 4F Step 4.10 Substep 4.10.3: Gateway Payout Batch & Order Settlement Allocation
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - Direct SQL operations against public.gateway_settlement_order.
 * 2. UNIQUE ALLOCATION INTEGRITY:
 *    - uq_gateway_settlement_batch_txn prevents duplicate allocations of the same payment_transaction_id within a batch.
 *    - Cross-batch unique protection prevents settled transactions from double-settlement.
 * 3. BRANCH-PARTITIONED LINKAGE:
 *    - Each allocation explicitly records settlement_branch_id and links to the branch-partitioned voucher.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  GatewaySettlementOrderRow,
  GatewayAllocationStatus,
} from "../types/accounting.types";

export class GatewaySettlementOrderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GatewaySettlementOrderError";
    this.code = code;
  }
}

export class GatewaySettlementOrderRepository {
  /**
   * Inserts an allocation row for a payment transaction in a payout batch.
   */
  static async createAllocation(
    params: {
      id?: string;
      payout_batch_id: string;
      payment_transaction_id: string;
      order_id: string;
      settlement_branch_id: string;
      allocated_gross_amount: number;
      identified_fee_amount?: number;
      reported_tax_amount?: number;
      other_deductions_amount?: number;
      allocated_net_amount: number;
      allocation_status?: GatewayAllocationStatus;
      exception_reason?: string | null;
      provider_payment_id?: string | null;
      voucher_id?: string | null;
      metadata?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<GatewaySettlementOrderRow> {
    const id = params.id || `gso_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const feeAmount = params.identified_fee_amount ?? 0;
    const taxAmount = params.reported_tax_amount ?? 0;
    const otherDeductions = params.other_deductions_amount ?? 0;
    const status = params.allocation_status || "PENDING";
    const exceptionReason = params.exception_reason || null;
    const providerPaymentId = params.provider_payment_id || null;
    const voucherId = params.voucher_id || null;
    const metadata = params.metadata || {};

    const sql = `
      INSERT INTO public.gateway_settlement_order (
        id, payout_batch_id, payment_transaction_id, order_id,
        settlement_branch_id, allocated_gross_amount, identified_fee_amount,
        reported_tax_amount, other_deductions_amount, allocated_net_amount,
        allocation_status, exception_reason, provider_payment_id,
        voucher_id, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15, NOW(), NOW()
      )
      RETURNING *;
    `;
    const values = [
      id,
      params.payout_batch_id,
      params.payment_transaction_id,
      params.order_id,
      params.settlement_branch_id,
      params.allocated_gross_amount,
      feeAmount,
      taxAmount,
      otherDeductions,
      params.allocated_net_amount,
      status,
      exceptionReason,
      providerPaymentId,
      voucherId,
      JSON.stringify(metadata),
    ];

    try {
      const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
      return res.rows[0];
    } catch (err: any) {
      if (err.code === "23505" || (err.message && err.message.includes("uq_gateway_settlement_batch_txn"))) {
        throw new GatewaySettlementOrderError(
          "ORDER_ALREADY_SETTLED",
          `Transaction '${params.payment_transaction_id}' is already allocated in payout batch '${params.payout_batch_id}'.`
        );
      }
      throw err;
    }
  }

  /**
   * Batch creates multiple allocations in a single query or transaction.
   */
  static async createAllocations(
    allocations: Array<{
      id?: string;
      payout_batch_id: string;
      payment_transaction_id: string;
      order_id: string;
      settlement_branch_id: string;
      allocated_gross_amount: number;
      identified_fee_amount?: number;
      reported_tax_amount?: number;
      other_deductions_amount?: number;
      allocated_net_amount: number;
      allocation_status?: GatewayAllocationStatus;
      exception_reason?: string | null;
      provider_payment_id?: string | null;
      metadata?: Record<string, unknown>;
    }>,
    client?: PoolClient
  ): Promise<GatewaySettlementOrderRow[]> {
    const results: GatewaySettlementOrderRow[] = [];
    for (const alloc of allocations) {
      const created = await this.createAllocation(alloc, client);
      results.push(created);
    }
    return results;
  }

  /**
   * Finds all settlement allocations for a payout batch.
   */
  static async findByBatchId(
    payoutBatchId: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<GatewaySettlementOrderRow[]> {
    const sql = `
      SELECT * FROM public.gateway_settlement_order
      WHERE payout_batch_id = $1
      ORDER BY created_at ASC
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [payoutBatchId]) : await dbQuery(sql, [payoutBatchId]);
    return res.rows;
  }

  /**
   * Finds an active settlement allocation for a payment transaction across batches.
   * Checks for allocations in non-cancelled batches.
   */
  static async findActiveByTransactionId(
    paymentTransactionId: string,
    excludeBatchId?: string,
    client?: PoolClient
  ): Promise<GatewaySettlementOrderRow | null> {
    const conditions = [
      `gso.payment_transaction_id = $1`,
      `gpb.status <> 'CANCELLED'`,
      `gso.allocation_status IN ('VALIDATED', 'POSTED')`,
    ];
    const values: any[] = [paymentTransactionId];

    if (excludeBatchId) {
      conditions.push(`gso.payout_batch_id <> $2`);
      values.push(excludeBatchId);
    }

    const sql = `
      SELECT gso.*
      FROM public.gateway_settlement_order gso
      JOIN public.gateway_payout_batch gpb ON gpb.id = gso.payout_batch_id
      WHERE ${conditions.join(" AND ")}
      LIMIT 1;
    `;
    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows[0] || null;
  }

  /**
   * Updates allocation status and exception reason.
   */
  static async updateStatus(
    id: string,
    status: GatewayAllocationStatus,
    exceptionReason?: string | null,
    client?: PoolClient
  ): Promise<GatewaySettlementOrderRow> {
    const sql = `
      UPDATE public.gateway_settlement_order
      SET allocation_status = $2, exception_reason = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client
      ? await client.query(sql, [id, status, exceptionReason || null])
      : await dbQuery(sql, [id, status, exceptionReason || null]);
    return res.rows[0];
  }

  /**
   * Links a posted voucher to an allocation.
   */
  static async recordVoucherLink(
    id: string,
    voucherId: string,
    client?: PoolClient
  ): Promise<GatewaySettlementOrderRow> {
    const sql = `
      UPDATE public.gateway_settlement_order
      SET voucher_id = $2, allocation_status = 'POSTED', updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client ? await client.query(sql, [id, voucherId]) : await dbQuery(sql, [id, voucherId]);
    return res.rows[0];
  }

  /**
   * Links a posted voucher to all validated allocations for a specific branch in a payout batch.
   */
  static async recordVoucherLinkForBranch(
    payoutBatchId: string,
    settlementBranchId: string,
    voucherId: string,
    client?: PoolClient
  ): Promise<number> {
    const sql = `
      UPDATE public.gateway_settlement_order
      SET voucher_id = $3, allocation_status = 'POSTED', updated_at = NOW()
      WHERE payout_batch_id = $1
        AND settlement_branch_id = $2
        AND allocation_status = 'VALIDATED';
    `;
    const res = client
      ? await client.query(sql, [payoutBatchId, settlementBranchId, voucherId])
      : await dbQuery(sql, [payoutBatchId, settlementBranchId, voucherId]);
    return res.rowCount || 0;
  }
}
