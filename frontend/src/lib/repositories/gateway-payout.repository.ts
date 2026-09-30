/**
 * CakeToHome ERP — Gateway Payout Repository
 * Phase 4F Step 4.10 Substep 4.10.3: Gateway Payout Batch & Order Settlement Allocation
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - All operations execute direct parameterized SQL against public.gateway_payout_batch.
 * 2. STRICT 3-TIER SEGREGATION OF DUTIES (SoD):
 *    - DB check constraints enforce:
 *      * prepared_by <> approved_by (chk_payout_sod_preparer_approver)
 *      * prepared_by <> posted_by (chk_payout_sod_preparer_poster)
 *      * approved_by <> posted_by (chk_payout_sod_approver_poster)
 * 3. IMMUTABILITY OF POSTED EVIDENCE:
 *    - Once status = 'POSTED', payout batches and their financial fields cannot be mutated.
 * 4. PESSIMISTIC LOCKING:
 *    - Uses SELECT ... FOR UPDATE to defend against race conditions during approval, partitioning, and GL posting.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  GatewayPayoutBatchRow,
  GatewayPayoutStatus,
  ListGatewayPayoutBatchesFilter,
} from "../types/accounting.types";

export class GatewayPayoutError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GatewayPayoutError";
    this.code = code;
  }
}

export class GatewayPayoutRepository {
  /**
   * Creates a new gateway payout batch record.
   */
  static async create(
    params: {
      id?: string;
      company_id?: string;
      provider: string;
      payout_reference: string;
      settlement_reference?: string | null;
      bank_account_id: string;
      settlement_date: string;
      bank_value_date?: string | null;
      gross_amount: number;
      identified_fee_amount?: number;
      reported_tax_amount?: number;
      other_deductions_amount?: number;
      net_amount: number;
      rounding_variance?: number;
      currency?: string;
      status?: GatewayPayoutStatus;
      unreconciled_exception_count?: number;
      ingestion_source?: string;
      prepared_by: string;
      metadata?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow> {
    const id = params.id || `gpb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const companyId = params.company_id || "company_default";
    const provider = params.provider.trim().toLowerCase();
    const payoutRef = params.payout_reference.trim();
    const settlementRef = params.settlement_reference ? params.settlement_reference.trim() : null;
    const bankAccountId = params.bank_account_id.trim();
    const settlementDate = params.settlement_date;
    const bankValueDate = params.bank_value_date || null;
    const grossAmount = params.gross_amount;
    const feeAmount = params.identified_fee_amount ?? 0;
    const taxAmount = params.reported_tax_amount ?? 0;
    const otherDeductions = params.other_deductions_amount ?? 0;
    const netAmount = params.net_amount;
    const roundingVariance = params.rounding_variance ?? 0;
    const currency = params.currency || "INR";
    const status = params.status || "INGESTED";
    const exceptionCount = params.unreconciled_exception_count ?? 0;
    const ingestionSource = params.ingestion_source || "MANUAL";
    const metadata = params.metadata || {};

    const sql = `
      INSERT INTO public.gateway_payout_batch (
        id, company_id, provider, payout_reference, settlement_reference,
        bank_account_id, settlement_date, bank_value_date, gross_amount,
        identified_fee_amount, reported_tax_amount, other_deductions_amount,
        net_amount, rounding_variance, currency, status, unreconciled_exception_count,
        ingestion_source, prepared_by, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, NOW(), NOW()
      )
      RETURNING *;
    `;
    const values = [
      id,
      companyId,
      provider,
      payoutRef,
      settlementRef,
      bankAccountId,
      settlementDate,
      bankValueDate,
      grossAmount,
      feeAmount,
      taxAmount,
      otherDeductions,
      netAmount,
      roundingVariance,
      currency,
      status,
      exceptionCount,
      ingestionSource,
      params.prepared_by,
      JSON.stringify(metadata),
    ];

    try {
      const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
      return res.rows[0];
    } catch (err: any) {
      if (err.code === "23505" || (err.message && err.message.includes("uq_gateway_payout_provider_reference"))) {
        throw new GatewayPayoutError(
          "DUPLICATE_PAYOUT_REFERENCE",
          `Gateway payout batch with provider '${provider}' and reference '${payoutRef}' already exists.`
        );
      }
      throw err;
    }
  }

  /**
   * Finds a payout batch by ID with optional pessimistic row lock.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<GatewayPayoutBatchRow | null> {
    const sql = `
      SELECT * FROM public.gateway_payout_batch
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Finds a payout batch by provider and payout reference.
   */
  static async findByProviderAndReference(
    provider: string,
    payoutReference: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<GatewayPayoutBatchRow | null> {
    const sql = `
      SELECT * FROM public.gateway_payout_batch
      WHERE provider = $1 AND payout_reference = $2
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client
      ? await client.query(sql, [provider.trim().toLowerCase(), payoutReference.trim()])
      : await dbQuery(sql, [provider.trim().toLowerCase(), payoutReference.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Updates status of a payout batch.
   */
  static async updateStatus(
    id: string,
    status: GatewayPayoutStatus,
    updates?: {
      unreconciled_exception_count?: number;
      metadata?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow> {
    const batch = await this.findById(id, client, true);
    if (!batch) {
      throw new GatewayPayoutError("INVALID_PAYOUT_STATUS", `Gateway payout batch '${id}' not found.`);
    }
    if (batch.status === "POSTED") {
      throw new GatewayPayoutError("POSTED_PAYOUT_IMMUTABLE", `Posted payout batch '${id}' cannot be modified.`);
    }

    const mergedMetadata = updates?.metadata
      ? { ...(batch.metadata || {}), ...updates.metadata }
      : batch.metadata;
    const exceptionCount = updates?.unreconciled_exception_count ?? batch.unreconciled_exception_count;

    const sql = `
      UPDATE public.gateway_payout_batch
      SET status = $2,
          unreconciled_exception_count = $3,
          metadata = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client
      ? await client.query(sql, [id, status, exceptionCount, JSON.stringify(mergedMetadata)])
      : await dbQuery(sql, [id, status, exceptionCount, JSON.stringify(mergedMetadata)]);
    return res.rows[0];
  }

  /**
   * Records approval of a payout batch. Enforces SoD: approved_by <> prepared_by.
   */
  static async recordApproval(
    id: string,
    approvedBy: string,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow> {
    const sql = `
      UPDATE public.gateway_payout_batch
      SET status = 'APPROVED', approved_by = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    try {
      const res = client ? await client.query(sql, [id, approvedBy]) : await dbQuery(sql, [id, approvedBy]);
      if (!res.rows[0]) {
        throw new GatewayPayoutError("INVALID_PAYOUT_STATUS", `Gateway payout batch '${id}' not found.`);
      }
      return res.rows[0];
    } catch (err: any) {
      if (err.message && err.message.includes("chk_payout_sod_preparer_approver")) {
        throw new GatewayPayoutError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Preparer cannot approve their own gateway payout batch."
        );
      }
      throw err;
    }
  }

  /**
   * Records posting of a payout batch. Enforces SoD: posted_by <> prepared_by and posted_by <> approved_by.
   */
  static async recordPosting(
    id: string,
    postedBy: string,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow> {
    const sql = `
      UPDATE public.gateway_payout_batch
      SET status = 'POSTED', posted_by = $2, posted_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    try {
      const res = client ? await client.query(sql, [id, postedBy]) : await dbQuery(sql, [id, postedBy]);
      if (!res.rows[0]) {
        throw new GatewayPayoutError("INVALID_PAYOUT_STATUS", `Gateway payout batch '${id}' not found.`);
      }
      return res.rows[0];
    } catch (err: any) {
      if (
        (err.message && err.message.includes("chk_payout_sod_preparer_poster")) ||
        (err.message && err.message.includes("chk_payout_sod_approver_poster"))
      ) {
        throw new GatewayPayoutError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Poster cannot be the same user who prepared or approved the gateway payout batch."
        );
      }
      throw err;
    }
  }

  /**
   * Cancels a payout batch.
   */
  static async cancelBatch(
    id: string,
    cancelledBy: string,
    reason?: string,
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow> {
    const batch = await this.findById(id, client, true);
    if (!batch) {
      throw new GatewayPayoutError("INVALID_PAYOUT_STATUS", `Gateway payout batch '${id}' not found.`);
    }
    if (batch.status === "POSTED") {
      throw new GatewayPayoutError("POSTED_PAYOUT_IMMUTABLE", "Cannot cancel an already POSTED gateway payout batch.");
    }

    const metadata = {
      ...(batch.metadata || {}),
      cancelled_by: cancelledBy,
      cancellation_reason: reason || "Cancelled by user",
      cancelled_at: new Date().toISOString(),
    };

    const sql = `
      UPDATE public.gateway_payout_batch
      SET status = 'CANCELLED', metadata = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client
      ? await client.query(sql, [id, JSON.stringify(metadata)])
      : await dbQuery(sql, [id, JSON.stringify(metadata)]);
    return res.rows[0];
  }

  /**
   * Lists payout batches with optional filtering and pagination.
   */
  static async list(
    filter: ListGatewayPayoutBatchesFilter = {},
    client?: PoolClient
  ): Promise<GatewayPayoutBatchRow[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter.provider) {
      conditions.push(`provider = $${idx++}`);
      values.push(filter.provider.trim().toLowerCase());
    }

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }

    if (filter.bankAccountId) {
      conditions.push(`bank_account_id = $${idx++}`);
      values.push(filter.bankAccountId);
    }

    if (filter.startDate) {
      conditions.push(`settlement_date >= $${idx++}`);
      values.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push(`settlement_date <= $${idx++}`);
      values.push(filter.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 100;
    const offset = filter.offset && filter.offset >= 0 ? filter.offset : 0;

    values.push(limit);
    const limitParam = `$${idx++}`;
    values.push(offset);
    const offsetParam = `$${idx++}`;

    const sql = `
      SELECT * FROM public.gateway_payout_batch
      ${whereClause}
      ORDER BY settlement_date DESC, created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam};
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }
}
