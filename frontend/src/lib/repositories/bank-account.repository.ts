/**
 * CakeToHome ERP — Bank Account Repository
 * Phase 4F Step 4.10 Substep 4.10.2: Bank Master & Multi-Branch Treasury Architecture
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - All operations execute direct parameterized SQL against public.bank_account.
 * 2. STRICT VALIDATION & CONSTRAINTS:
 *    - Bank name non-empty.
 *    - Masked account number length >= 4 (no plaintext account numbers stored).
 *    - IFSC regex: ^[A-Z]{4}0[A-Z0-9]{6}$.
 *    - Status IN ('ACTIVE', 'INACTIVE', 'FROZEN').
 * 3. BRANCH ISOLATION:
 *    - branch_id NULL represents enterprise-level accounts (Super Admin managed).
 *    - Branch-specific accounts strictly reference public.branch(id).
 * 4. PESSIMISTIC LOCKING:
 *    - Supports SELECT ... FOR UPDATE for atomic mutations and concurrency defense.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type { BankAccountRow, BankAccountStatus } from "../types/accounting.types";

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
      company_id?: string;
      branch_id?: string | null;
      bank_name: string;
      account_number_masked: string;
      ifsc_code: string;
      status?: BankAccountStatus;
      metadata?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const id = params.id || `ba_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const companyId = params.company_id || "company_default";
    const branchId = params.branch_id || null;
    const bankName = params.bank_name.trim();
    const maskedAcc = params.account_number_masked.trim();
    const ifsc = params.ifsc_code.trim().toUpperCase();
    const status = params.status || "ACTIVE";
    const metadata = params.metadata || {};

    const sql = `
      INSERT INTO public.bank_account (
        id, company_id, branch_id, bank_name, account_number_masked, ifsc_code, status, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *;
    `;
    const values = [id, companyId, branchId, bankName, maskedAcc, ifsc, status, JSON.stringify(metadata)];

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows[0];
  }

  /**
   * Finds a bank account by ID with optional pessimistic row lock.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<BankAccountRow | null> {
    const sql = `
      SELECT * FROM public.bank_account
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Lists bank accounts with optional branch, status, and company filtering.
   */
  static async list(
    filter: {
      branchId?: string | null;
      companyId?: string;
      status?: BankAccountStatus;
      includeEnterprise?: boolean;
    } = {},
    client?: PoolClient
  ): Promise<BankAccountRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.companyId) {
      conditions.push(`company_id = $${idx++}`);
      values.push(filter.companyId);
    }

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }

    if (filter.branchId !== undefined) {
      if (filter.branchId === null) {
        conditions.push(`branch_id IS NULL`);
      } else if (filter.includeEnterprise) {
        conditions.push(`(branch_id = $${idx++} OR branch_id IS NULL)`);
        values.push(filter.branchId);
      } else {
        conditions.push(`branch_id = $${idx++}`);
        values.push(filter.branchId);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT * FROM public.bank_account
      ${whereClause}
      ORDER BY created_at DESC;
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
      bank_name?: string;
      account_number_masked?: string;
      ifsc_code?: string;
      status?: BankAccountStatus;
      metadata?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [id];
    let idx = 2;

    if (updates.bank_name !== undefined) {
      setClauses.push(`bank_name = $${idx++}`);
      values.push(updates.bank_name.trim());
    }

    if (updates.account_number_masked !== undefined) {
      setClauses.push(`account_number_masked = $${idx++}`);
      values.push(updates.account_number_masked.trim());
    }

    if (updates.ifsc_code !== undefined) {
      setClauses.push(`ifsc_code = $${idx++}`);
      values.push(updates.ifsc_code.trim().toUpperCase());
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(updates.metadata));
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
    return res.rows[0];
  }

  /**
   * Sets bank account status.
   */
  static async setStatus(
    id: string,
    status: BankAccountStatus,
    client?: PoolClient
  ): Promise<BankAccountRow> {
    return await this.update(id, { status }, client);
  }
}
