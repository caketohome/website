/**
 * CakeToHome ERP — Bank Account Repository
 * Phase B: Enterprise Company Bank Account Master
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - All operations execute direct parameterized SQL against public.bank_account.
 * 2. STRICT VALIDATION & CONSTRAINTS:
 *    - Bank accounts belong strictly to the COMPANY (no branch ownership).
 *    - Strict 1:1 foreign key mapping to public.accounting_account (gl_account_id).
 *    - Composite unique constraint on (ifsc_code, account_number).
 *    - IFSC regex: ^[A-Z]{4}0[A-Z0-9]{6}$.
 *    - Status IN ('ACTIVE', 'INACTIVE', 'FROZEN').
 * 3. ENTERPRISE GL LINKAGE:
 *    - Bank accounts join with public.accounting_account to surface gl_account_code and gl_account_name.
 * 4. PESSIMISTIC LOCKING:
 *    - Supports SELECT ... FOR UPDATE for atomic mutations and concurrency defense.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type { BankAccountRow, BankAccountStatus, BankAccountType } from "../types/accounting.types";

export class BankAccountError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BankAccountError";
    this.code = code;
  }
}

export class BankAccountRepository {
  /**
   * Creates a new bank account record.
   */
  static async create(
    params: {
      id?: string;
      company_id: string;
      account_name: string;
      bank_name: string;
      account_number: string;
      account_number_masked: string;
      ifsc_code: string;
      account_type?: BankAccountType;
      branch_name?: string | null;
      gl_account_id: string;
      status?: BankAccountStatus;
      metadata?: Record<string, unknown>;
      created_by?: string;
    },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const id = params.id || `ba_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const companyId = params.company_id;
    if (!companyId) {
      throw new BankAccountError(
        "BANK_ACCOUNT_VALIDATION",
        "company_id is required. Configure Company Master in Admin → Company Settings."
      );
    }

    const accountName = params.account_name.trim();
    const bankName = params.bank_name.trim();
    const accountNumber = params.account_number.trim();
    const maskedAcc = params.account_number_masked.trim();
    const ifsc = params.ifsc_code.trim().toUpperCase();
    const accountType = params.account_type || "CURRENT";
    const branchName = params.branch_name?.trim() || null;
    const glAccountId = params.gl_account_id;
    const status = params.status || "ACTIVE";
    const metadata = params.metadata || {};
    const createdBy = params.created_by || "system";

    const sql = `
      INSERT INTO public.bank_account (
        id, company_id, account_name, bank_name, account_number, account_number_masked,
        ifsc_code, account_type, branch_name, gl_account_id, status, metadata,
        created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      id,
      companyId,
      accountName,
      bankName,
      accountNumber,
      maskedAcc,
      ifsc,
      accountType,
      branchName,
      glAccountId,
      status,
      JSON.stringify(metadata),
      createdBy,
    ];

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows[0];
  }

  /**
   * Finds a bank account by ID with optional pessimistic row lock and joined GL account data.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<BankAccountRow | null> {
    const sql = `
      SELECT
        ba.*,
        aa.code AS gl_account_code,
        aa.name AS gl_account_name
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      WHERE ba.id = $1
      ${forUpdate ? "FOR UPDATE OF ba" : ""};
    `;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Finds a bank account by its mapped GL account ID.
   */
  static async findByGlAccountId(
    glAccountId: string,
    client?: PoolClient
  ): Promise<BankAccountRow | null> {
    const sql = `
      SELECT
        ba.*,
        aa.code AS gl_account_code,
        aa.name AS gl_account_name
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      WHERE ba.gl_account_id = $1
      LIMIT 1;
    `;
    const res = client ? await client.query(sql, [glAccountId]) : await dbQuery(sql, [glAccountId]);
    return res.rows[0] || null;
  }

  /**
   * Finds a bank account by exact IFSC and account number.
   */
  static async findByAccountNumberAndIfsc(
    accountNumber: string,
    ifscCode: string,
    client?: PoolClient
  ): Promise<BankAccountRow | null> {
    const sql = `
      SELECT * FROM public.bank_account
      WHERE ifsc_code = $1 AND account_number = $2
      LIMIT 1;
    `;
    const res = client
      ? await client.query(sql, [ifscCode.trim().toUpperCase(), accountNumber.trim()])
      : await dbQuery(sql, [ifscCode.trim().toUpperCase(), accountNumber.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Lists bank accounts with optional company, status, and text search filtering.
   */
  static async list(
    filter: {
      companyId?: string;
      status?: BankAccountStatus;
      search?: string;
      branchId?: string | null;
      includeEnterprise?: boolean;
    } = {},
    client?: PoolClient
  ): Promise<BankAccountRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.companyId) {
      conditions.push(`ba.company_id = $${idx++}`);
      values.push(filter.companyId);
    }

    if (filter.status) {
      conditions.push(`ba.status = $${idx++}`);
      values.push(filter.status);
    }

    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim()}%`;
      conditions.push(
        `(ba.account_name ILIKE $${idx} OR ba.bank_name ILIKE $${idx} OR ba.account_number_masked ILIKE $${idx} OR ba.ifsc_code ILIKE $${idx} OR aa.code ILIKE $${idx} OR aa.name ILIKE $${idx})`
      );
      values.push(q);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT
        ba.*,
        aa.code AS gl_account_code,
        aa.name AS gl_account_name
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      ${whereClause}
      ORDER BY ba.created_at DESC;
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  /**
   * Updates an existing bank account.
   */
  static async update(
    id: string,
    updates: {
      account_name?: string;
      bank_name?: string;
      account_number?: string;
      account_number_masked?: string;
      ifsc_code?: string;
      account_type?: BankAccountType;
      branch_name?: string | null;
      gl_account_id?: string;
      status?: BankAccountStatus;
      metadata?: Record<string, unknown>;
      updated_by?: string;
    },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [id];
    let idx = 2;

    if (updates.account_name !== undefined) {
      setClauses.push(`account_name = $${idx++}`);
      values.push(updates.account_name.trim());
    }

    if (updates.bank_name !== undefined) {
      setClauses.push(`bank_name = $${idx++}`);
      values.push(updates.bank_name.trim());
    }

    if (updates.account_number !== undefined) {
      setClauses.push(`account_number = $${idx++}`);
      values.push(updates.account_number.trim());
    }

    if (updates.account_number_masked !== undefined) {
      setClauses.push(`account_number_masked = $${idx++}`);
      values.push(updates.account_number_masked.trim());
    }

    if (updates.ifsc_code !== undefined) {
      setClauses.push(`ifsc_code = $${idx++}`);
      values.push(updates.ifsc_code.trim().toUpperCase());
    }

    if (updates.account_type !== undefined) {
      setClauses.push(`account_type = $${idx++}`);
      values.push(updates.account_type);
    }

    if (updates.branch_name !== undefined) {
      setClauses.push(`branch_name = $${idx++}`);
      values.push(updates.branch_name?.trim() || null);
    }

    if (updates.gl_account_id !== undefined) {
      setClauses.push(`gl_account_id = $${idx++}`);
      values.push(updates.gl_account_id);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (updates.updated_by !== undefined) {
      setClauses.push(`updated_by = $${idx++}`);
      values.push(updates.updated_by);
    }

    const sql = `
      UPDATE public.bank_account
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    if (!res.rows[0]) {
      throw new BankAccountError("BANK_ACCOUNT_NOT_FOUND", `Bank account '${id}' not found.`);
    }

    // Return with joined GL account info
    return (await this.findById(id, client)) || res.rows[0];
  }

  /**
   * Sets bank account status.
   */
  static async setStatus(
    id: string,
    status: BankAccountStatus,
    updatedBy?: string,
    client?: PoolClient
  ): Promise<BankAccountRow> {
    return await this.update(id, { status, updated_by: updatedBy }, client);
  }
}
