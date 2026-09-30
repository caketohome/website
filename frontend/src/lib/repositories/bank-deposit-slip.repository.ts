/**
 * CakeToHome ERP — Bank Deposit Slip Repository
 * Phase 4F Step 4.10 Substep 4.10.2: Cash Drawer to Bank Deposit Workflow
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - All operations execute direct parameterized SQL against public.bank_deposit_slip.
 * 2. STRICT 3-TIER SEGREGATION OF DUTIES (SoD):
 *    - DB check constraints enforce:
 *      * prepared_by <> approved_by (chk_bank_deposit_sod_preparer_approver)
 *      * prepared_by <> posted_by (chk_bank_deposit_sod_preparer_poster)
 *      * approved_by <> posted_by (chk_bank_deposit_sod_approver_poster)
 * 3. IMMUTABILITY OF POSTED EVIDENCE:
 *    - Once transit_voucher_id is set, key financial fields (amount, branch, bank_account, deposit_date) cannot mutate.
 * 4. PESSIMISTIC LOCKING:
 *    - Uses SELECT ... FOR UPDATE to prevent race conditions during approval, dispatch, or posting.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  BankDepositSlipRow,
  BankDepositStatus,
  BankDepositDenominations,
} from "../types/accounting.types";

export class BankDepositSlipError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BankDepositSlipError";
    this.code = code;
  }
}

export class BankDepositSlipRepository {
  /**
   * Creates a new bank deposit slip in DRAFT or DISPATCHED status.
   */
  static async create(
    params: {
      id?: string;
      slip_number: string;
      company_id?: string;
      branch_id: string;
      bank_account_id: string;
      deposit_date: string;
      amount: number;
      denominations?: BankDepositDenominations;
      status?: BankDepositStatus;
      prepared_by: string;
      metadata?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const id = params.id || `bds_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const companyId = params.company_id || "company_default";
    const status = params.status || "DRAFT";
    const denominations = params.denominations || {};
    const metadata = params.metadata || {};

    const sql = `
      INSERT INTO public.bank_deposit_slip (
        id, slip_number, company_id, branch_id, bank_account_id,
        deposit_date, amount, denominations, status, prepared_by,
        metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      id,
      params.slip_number,
      companyId,
      params.branch_id,
      params.bank_account_id,
      params.deposit_date,
      params.amount,
      JSON.stringify(denominations),
      status,
      params.prepared_by,
      JSON.stringify(metadata),
    ];

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows[0];
  }

  /**
   * Finds a deposit slip by ID with optional row lock.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<BankDepositSlipRow | null> {
    const sql = `
      SELECT * FROM public.bank_deposit_slip
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Finds a deposit slip by slip number.
   */
  static async findBySlipNumber(
    slipNumber: string,
    client?: PoolClient
  ): Promise<BankDepositSlipRow | null> {
    const sql = `
      SELECT * FROM public.bank_deposit_slip
      WHERE slip_number = $1;
    `;
    const res = client ? await client.query(sql, [slipNumber]) : await dbQuery(sql, [slipNumber]);
    return res.rows[0] || null;
  }

  /**
   * Lists deposit slips with branch, account, date, and status filtering.
   */
  static async list(
    filter: {
      branchId?: string;
      bankAccountId?: string;
      status?: BankDepositStatus;
      startDate?: string;
      endDate?: string;
      companyId?: string;
    } = {},
    client?: PoolClient
  ): Promise<BankDepositSlipRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.companyId) {
      conditions.push(`company_id = $${idx++}`);
      values.push(filter.companyId);
    }

    if (filter.branchId) {
      conditions.push(`branch_id = $${idx++}`);
      values.push(filter.branchId);
    }

    if (filter.bankAccountId) {
      conditions.push(`bank_account_id = $${idx++}`);
      values.push(filter.bankAccountId);
    }

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }

    if (filter.startDate) {
      conditions.push(`deposit_date >= $${idx++}`);
      values.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push(`deposit_date <= $${idx++}`);
      values.push(filter.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT * FROM public.bank_deposit_slip
      ${whereClause}
      ORDER BY deposit_date DESC, created_at DESC;
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  /**
   * Updates slip status (e.g. DRAFT -> DISPATCHED).
   */
  static async updateStatus(
    id: string,
    status: BankDepositStatus,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const sql = `
      UPDATE public.bank_deposit_slip
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client ? await client.query(sql, [id, status]) : await dbQuery(sql, [id, status]);
    if (!res.rows[0]) {
      throw new BankDepositSlipError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${id}' not found.`);
    }
    return res.rows[0];
  }

  /**
   * Approves a deposit slip (transitions status to CONFIRMED and records approved_by).
   * DB check constraint enforces approved_by <> prepared_by.
   */
  static async recordApproval(
    id: string,
    approvedBy: string,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const sql = `
      UPDATE public.bank_deposit_slip
      SET status = 'CONFIRMED', approved_by = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    try {
      const res = client ? await client.query(sql, [id, approvedBy]) : await dbQuery(sql, [id, approvedBy]);
      if (!res.rows[0]) {
        throw new BankDepositSlipError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${id}' not found.`);
      }
      return res.rows[0];
    } catch (err: any) {
      if (err.message && err.message.includes("chk_bank_deposit_sod_preparer_approver")) {
        throw new BankDepositSlipError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Preparer cannot approve their own deposit slip."
        );
      }
      throw err;
    }
  }

  /**
   * Records posting of transit voucher (sets posted_by and transit_voucher_id).
   * DB check constraints enforce posted_by <> prepared_by and posted_by <> approved_by.
   */
  static async recordTransitPosting(
    id: string,
    postedBy: string,
    transitVoucherId: string,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const sql = `
      UPDATE public.bank_deposit_slip
      SET posted_by = $2, transit_voucher_id = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    try {
      const res = client ? await client.query(sql, [id, postedBy, transitVoucherId]) : await dbQuery(sql, [id, postedBy, transitVoucherId]);
      if (!res.rows[0]) {
        throw new BankDepositSlipError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${id}' not found.`);
      }
      return res.rows[0];
    } catch (err: any) {
      if (err.message && (err.message.includes("chk_bank_deposit_sod_preparer_poster") || err.message.includes("chk_bank_deposit_sod_approver_poster"))) {
        throw new BankDepositSlipError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Poster must be distinct from preparer and approver."
        );
      }
      throw err;
    }
  }

  /**
   * Cancels a deposit slip.
   */
  static async cancel(
    id: string,
    reason?: string,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const sql = `
      UPDATE public.bank_deposit_slip
      SET status = 'CANCELLED',
          metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cancel_reason}', to_jsonb($2::text), true),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client ? await client.query(sql, [id, reason || "Cancelled by user"]) : await dbQuery(sql, [id, reason || "Cancelled by user"]);
    if (!res.rows[0]) {
      throw new BankDepositSlipError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${id}' not found.`);
    }
    return res.rows[0];
  }

  /**
   * Rejects a deposit slip.
   */
  static async reject(
    id: string,
    rejectedBy: string,
    reason?: string,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const sql = `
      UPDATE public.bank_deposit_slip
      SET status = 'REJECTED',
          metadata = jsonb_set(
            jsonb_set(COALESCE(metadata, '{}'::jsonb), '{reject_reason}', to_jsonb($2::text), true),
            '{rejected_by}', to_jsonb($3::text), true
          ),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client ? await client.query(sql, [id, reason || "Rejected by supervisor", rejectedBy]) : await dbQuery(sql, [id, reason || "Rejected by supervisor", rejectedBy]);
    if (!res.rows[0]) {
      throw new BankDepositSlipError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${id}' not found.`);
    }
    return res.rows[0];
  }

  /**
   * Records posting of Stage-2 credit clearance voucher (sets credit_voucher_id, bank_ref_number, bank_value_date).
   */
  static async recordCreditPosting(
    id: string,
    creditVoucherId: string,
    bankRefNumber?: string | null,
    bankValueDate?: string | null,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const sql = `
      UPDATE public.bank_deposit_slip
      SET credit_voucher_id = $2,
          bank_ref_number = COALESCE($3, bank_ref_number),
          bank_value_date = COALESCE($4::date, bank_value_date),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client
      ? await client.query(sql, [id, creditVoucherId, bankRefNumber || null, bankValueDate || null])
      : await dbQuery(sql, [id, creditVoucherId, bankRefNumber || null, bankValueDate || null]);
    if (!res.rows[0]) {
      throw new BankDepositSlipError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${id}' not found.`);
    }
    return res.rows[0];
  }
}

