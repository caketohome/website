/**
 * CakeToHome ERP — Corporate Account Master & Employee Roster Repositories
 * Phase C7.9b: Data Access Layer for Corporate Accounts, Contacts, Members,
 * Employees, Audit Event Logs, and Import Batches.
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. TRANSACTION CONTEXT: All repository methods optionally accept an active PoolClient
 *    to participate seamlessly in atomic multi-table transactions.
 * 2. TENANT & ACCOUNT SCOPING: Enforces strict account-level scoping across queries.
 * 3. NO AUDIT MUTATION: Audit event tables corporate_account_event and
 *    corporate_employee_event have zero UPDATE or DELETE methods.
 * 4. NO HARD DELETE OF EMPLOYEES: corporate_employee has zero DELETE method.
 *    Only soft deactivation (status = 'INACTIVE') is supported.
 * 5. PARAMETERIZED QUERIES: All SQL queries strictly use parameterized $1, $2 placeholders.
 * 6. CONCURRENCY CONTROL: Provides advisory locking on account boundaries via
 *    pg_advisory_xact_lock(hashtext('corp_acct_' || accountId)).
 */

import { dbQuery } from "../db";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type {
  CorporateAccountRow,
  CorporateAccountContactRow,
  CorporateAccountMemberRow,
  CorporateEmployeeRow,
  CorporateEmployeeEventRow,
  CorporateAccountEventRow,
  CorporateEmployeeImportBatchRow,
  CorporateAccountStatus,
  CorporateEmployeeStatus,
  CorporateEmployeeImportBatchStatus,
  CreateCorporateAccountInput,
  UpdateCorporateAccountInput,
  CreateCorporateContactInput,
  UpdateCorporateContactInput,
  GrantCorporateMemberInput,
  CreateCorporateEmployeeInput,
  UpdateCorporateEmployeeInput,
  DeactivateCorporateEmployeeInput,
  ReactivateCorporateEmployeeInput,
  RecordAccountEventInput,
  RecordEmployeeEventInput,
  CreateEmployeeImportBatchInput,
  ListCorporateAccountsFilter,
  ListCorporateEmployeesFilter,
} from "../types/corporate-account.types";

/**
 * Execute a query with either the provided transactional PoolClient or the global connection pool.
 */
async function execQuery<T extends QueryResultRow = any>(
  text: string,
  params: any[] = [],
  client?: PoolClient
): Promise<QueryResult<T>> {
  if (client) {
    return client.query<T>(text, params);
  }
  return dbQuery<T>(text, params);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Corporate Account Repository
// ─────────────────────────────────────────────────────────────────────────────

export class CorporateAccountRepository {
  /**
   * Acquire a transaction-level advisory lock on the corporate account.
   */
  static async acquireAccountLock(accountId: string, client: PoolClient): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('corp_acct_' || $1))", [accountId]);
  }

  /**
   * Find a corporate account by primary key ID.
   */
  static async findById(id: string, client?: PoolClient): Promise<CorporateAccountRow | null> {
    const res = await execQuery<CorporateAccountRow>(
      `SELECT * FROM public.corporate_account WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
      client
    );
    return res.rows[0] || null;
  }

  /**
   * Find a corporate account by linked customer_id.
   */
  static async findByCustomerId(customerId: string, client?: PoolClient): Promise<CorporateAccountRow | null> {
    const res = await execQuery<CorporateAccountRow>(
      `SELECT * FROM public.corporate_account WHERE customer_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [customerId],
      client
    );
    return res.rows[0] || null;
  }

  /**
   * Find an active corporate account by GSTIN.
   */
  static async findByGstin(gstin: string, client?: PoolClient): Promise<CorporateAccountRow | null> {
    const normalizedGstin = gstin.trim().toUpperCase();
    const res = await execQuery<CorporateAccountRow>(
      `SELECT * FROM public.corporate_account WHERE gstin = $1 AND deleted_at IS NULL LIMIT 1`,
      [normalizedGstin],
      client
    );
    return res.rows[0] || null;
  }

  /**
   * List corporate accounts with filtering and pagination.
   */
  static async list(
    filter: ListCorporateAccountsFilter = {},
    client?: PoolClient
  ): Promise<{ items: CorporateAccountRow[]; total: number }> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: any[] = [];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filter.search) {
      params.push(`%${filter.search.toLowerCase().trim()}%`);
      const idx = params.length;
      conditions.push(`(LOWER(legal_name) LIKE $${idx} OR LOWER(trade_name) LIKE $${idx} OR gstin LIKE $${idx} OR pan LIKE $${idx})`);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await execQuery<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM public.corporate_account WHERE ${whereClause}`,
      params,
      client
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const limit = Math.min(Math.max(filter.limit || 50, 1), 100);
    const offset = Math.max(filter.offset || 0, 0);

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await execQuery<CorporateAccountRow>(
      `SELECT * FROM public.corporate_account
       WHERE ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
      client
    );

    return {
      items: dataRes.rows,
      total,
    };
  }

  /**
   * Create a new corporate account master record.
   */
  static async create(
    data: CreateCorporateAccountInput & { legal_name_key: string },
    client?: PoolClient
  ): Promise<CorporateAccountRow> {
    const res = await execQuery<CorporateAccountRow>(
      `INSERT INTO public.corporate_account (
        customer_id,
        legal_name,
        trade_name,
        legal_name_key,
        gstin,
        pan,
        billing_address,
        registered_address,
        status,
        credit_requested_limit,
        credit_requested_terms_days,
        metadata,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.customer_id,
        data.legal_name.trim(),
        data.trade_name ? data.trade_name.trim() : null,
        data.legal_name_key,
        data.gstin ? data.gstin.trim().toUpperCase() : null,
        data.pan ? data.pan.trim().toUpperCase() : null,
        JSON.stringify(data.billing_address || {}),
        JSON.stringify(data.registered_address || {}),
        data.status || "PENDING",
        data.credit_requested_limit ?? null,
        data.credit_requested_terms_days ?? null,
        JSON.stringify(data.metadata || {}),
        data.created_by || null,
      ],
      client
    );
    return res.rows[0];
  }

  /**
   * Update profile fields on a corporate account.
   */
  static async update(
    id: string,
    data: UpdateCorporateAccountInput & { legal_name_key?: string },
    client?: PoolClient
  ): Promise<CorporateAccountRow> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const params: any[] = [id];

    if (data.legal_name !== undefined) {
      params.push(data.legal_name.trim());
      setClauses.push(`legal_name = $${params.length}`);
    }
    if (data.trade_name !== undefined) {
      params.push(data.trade_name ? data.trade_name.trim() : null);
      setClauses.push(`trade_name = $${params.length}`);
    }
    if (data.legal_name_key !== undefined) {
      params.push(data.legal_name_key);
      setClauses.push(`legal_name_key = $${params.length}`);
    }
    if (data.gstin !== undefined) {
      params.push(data.gstin ? data.gstin.trim().toUpperCase() : null);
      setClauses.push(`gstin = $${params.length}`);
    }
    if (data.pan !== undefined) {
      params.push(data.pan ? data.pan.trim().toUpperCase() : null);
      setClauses.push(`pan = $${params.length}`);
    }
    if (data.billing_address !== undefined) {
      params.push(JSON.stringify(data.billing_address));
      setClauses.push(`billing_address = $${params.length}`);
    }
    if (data.registered_address !== undefined) {
      params.push(JSON.stringify(data.registered_address));
      setClauses.push(`registered_address = $${params.length}`);
    }
    if (data.metadata !== undefined) {
      params.push(JSON.stringify(data.metadata));
      setClauses.push(`metadata = $${params.length}`);
    }
    if (data.updated_by !== undefined) {
      params.push(data.updated_by);
      setClauses.push(`updated_by = $${params.length}`);
    }

    const res = await execQuery<CorporateAccountRow>(
      `UPDATE public.corporate_account
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      params,
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Corporate account '${id}' not found or deleted.`);
    }
    return res.rows[0];
  }

  /**
   * Update lifecycle status of a corporate account.
   */
  static async updateStatus(
    id: string,
    status: CorporateAccountStatus,
    fields: {
      approved_by?: string | null;
      approved_at?: string | null;
      suspended_by?: string | null;
      suspended_at?: string | null;
      suspended_reason?: string | null;
      closed_by?: string | null;
      closed_at?: string | null;
      closed_reason?: string | null;
      updated_by?: string | null;
    },
    client?: PoolClient
  ): Promise<CorporateAccountRow> {
    const setClauses: string[] = ["status = $2", "updated_at = NOW()"];
    const params: any[] = [id, status];

    if (fields.approved_by !== undefined) {
      params.push(fields.approved_by);
      setClauses.push(`approved_by = $${params.length}`);
    }
    if (fields.approved_at !== undefined) {
      params.push(fields.approved_at);
      setClauses.push(`approved_at = $${params.length}`);
    }
    if (fields.suspended_by !== undefined) {
      params.push(fields.suspended_by);
      setClauses.push(`suspended_by = $${params.length}`);
    }
    if (fields.suspended_at !== undefined) {
      params.push(fields.suspended_at);
      setClauses.push(`suspended_at = $${params.length}`);
    }
    if (fields.suspended_reason !== undefined) {
      params.push(fields.suspended_reason);
      setClauses.push(`suspended_reason = $${params.length}`);
    }
    if (fields.closed_by !== undefined) {
      params.push(fields.closed_by);
      setClauses.push(`closed_by = $${params.length}`);
    }
    if (fields.closed_at !== undefined) {
      params.push(fields.closed_at);
      setClauses.push(`closed_at = $${params.length}`);
    }
    if (fields.closed_reason !== undefined) {
      params.push(fields.closed_reason);
      setClauses.push(`closed_reason = $${params.length}`);
    }
    if (fields.updated_by !== undefined) {
      params.push(fields.updated_by);
      setClauses.push(`updated_by = $${params.length}`);
    }

    const res = await execQuery<CorporateAccountRow>(
      `UPDATE public.corporate_account
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      params,
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Corporate account '${id}' not found or deleted.`);
    }
    return res.rows[0];
  }

  /**
   * Explicit Super Admin customer linkage update.
   */
  static async linkCustomer(
    id: string,
    customerId: string,
    updatedBy: string,
    client?: PoolClient
  ): Promise<CorporateAccountRow> {
    const res = await execQuery<CorporateAccountRow>(
      `UPDATE public.corporate_account
       SET customer_id = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, customerId, updatedBy],
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Corporate account '${id}' not found or deleted.`);
    }
    return res.rows[0];
  }

  /**
   * Record credit requested parameters on the corporate account.
   */
  static async updateCreditRequest(
    id: string,
    creditLimit: number,
    termsDays: number,
    requestedBy: string,
    client?: PoolClient
  ): Promise<CorporateAccountRow> {
    const res = await execQuery<CorporateAccountRow>(
      `UPDATE public.corporate_account
       SET credit_requested_limit = $2,
           credit_requested_terms_days = $3,
           credit_requested_by = $4,
           credit_requested_at = NOW(),
           updated_by = $4,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, creditLimit, termsDays, requestedBy],
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Corporate account '${id}' not found or deleted.`);
    }
    return res.rows[0];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Corporate Account Contact Repository
// ─────────────────────────────────────────────────────────────────────────────

export class CorporateAccountContactRepository {
  static async findById(id: string, client?: PoolClient): Promise<CorporateAccountContactRow | null> {
    const res = await execQuery<CorporateAccountContactRow>(
      `SELECT * FROM public.corporate_account_contact WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
      client
    );
    return res.rows[0] || null;
  }

  static async listByAccountId(
    accountId: string,
    activeOnly: boolean = false,
    client?: PoolClient
  ): Promise<CorporateAccountContactRow[]> {
    const conditions = ["account_id = $1", "deleted_at IS NULL"];
    if (activeOnly) {
      conditions.push("is_active = true");
    }
    const res = await execQuery<CorporateAccountContactRow>(
      `SELECT * FROM public.corporate_account_contact
       WHERE ${conditions.join(" AND ")}
       ORDER BY contact_type = 'PRIMARY' DESC, created_at ASC`,
      [accountId],
      client
    );
    return res.rows;
  }

  static async findPrimaryContact(accountId: string, client?: PoolClient): Promise<CorporateAccountContactRow | null> {
    const res = await execQuery<CorporateAccountContactRow>(
      `SELECT * FROM public.corporate_account_contact
       WHERE account_id = $1 AND contact_type = 'PRIMARY' AND is_active = true AND deleted_at IS NULL
       LIMIT 1`,
      [accountId],
      client
    );
    return res.rows[0] || null;
  }

  static async create(
    data: CreateCorporateContactInput,
    client?: PoolClient
  ): Promise<CorporateAccountContactRow> {
    const res = await execQuery<CorporateAccountContactRow>(
      `INSERT INTO public.corporate_account_contact (
        account_id,
        contact_type,
        name,
        email,
        phone,
        designation,
        is_active,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.account_id,
        data.contact_type,
        data.name.trim(),
        data.email.trim().toLowerCase(),
        data.phone.trim(),
        data.designation ? data.designation.trim() : null,
        data.is_active ?? true,
        JSON.stringify(data.metadata || {}),
      ],
      client
    );
    return res.rows[0];
  }

  static async update(
    id: string,
    accountId: string,
    data: UpdateCorporateContactInput,
    client?: PoolClient
  ): Promise<CorporateAccountContactRow> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const params: any[] = [id, accountId];

    if (data.contact_type !== undefined) {
      params.push(data.contact_type);
      setClauses.push(`contact_type = $${params.length}`);
    }
    if (data.name !== undefined) {
      params.push(data.name.trim());
      setClauses.push(`name = $${params.length}`);
    }
    if (data.email !== undefined) {
      params.push(data.email.trim().toLowerCase());
      setClauses.push(`email = $${params.length}`);
    }
    if (data.phone !== undefined) {
      params.push(data.phone.trim());
      setClauses.push(`phone = $${params.length}`);
    }
    if (data.designation !== undefined) {
      params.push(data.designation ? data.designation.trim() : null);
      setClauses.push(`designation = $${params.length}`);
    }
    if (data.is_active !== undefined) {
      params.push(data.is_active);
      setClauses.push(`is_active = $${params.length}`);
    }
    if (data.metadata !== undefined) {
      params.push(JSON.stringify(data.metadata));
      setClauses.push(`metadata = $${params.length}`);
    }

    const res = await execQuery<CorporateAccountContactRow>(
      `UPDATE public.corporate_account_contact
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      params,
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Contact '${id}' not found for account '${accountId}'.`);
    }
    return res.rows[0];
  }

  static async deactivate(
    id: string,
    accountId: string,
    client?: PoolClient
  ): Promise<CorporateAccountContactRow> {
    const res = await execQuery<CorporateAccountContactRow>(
      `UPDATE public.corporate_account_contact
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [id, accountId],
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Contact '${id}' not found for account '${accountId}'.`);
    }
    return res.rows[0];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Corporate Account Member Repository
// ─────────────────────────────────────────────────────────────────────────────

export class CorporateAccountMemberRepository {
  static async findById(id: string, client?: PoolClient): Promise<CorporateAccountMemberRow | null> {
    const res = await execQuery<CorporateAccountMemberRow>(
      `SELECT * FROM public.corporate_account_member WHERE id = $1 LIMIT 1`,
      [id],
      client
    );
    return res.rows[0] || null;
  }

  static async findByAccountAndUser(
    accountId: string,
    userId: string,
    client?: PoolClient
  ): Promise<CorporateAccountMemberRow | null> {
    const res = await execQuery<CorporateAccountMemberRow>(
      `SELECT * FROM public.corporate_account_member
       WHERE account_id = $1 AND user_id = $2 AND status = 'ACTIVE'
       LIMIT 1`,
      [accountId, userId],
      client
    );
    return res.rows[0] || null;
  }

  static async listByAccountId(
    accountId: string,
    activeOnly: boolean = true,
    client?: PoolClient
  ): Promise<CorporateAccountMemberRow[]> {
    const conditions = ["account_id = $1"];
    if (activeOnly) {
      conditions.push("status = 'ACTIVE'");
    }
    const res = await execQuery<CorporateAccountMemberRow>(
      `SELECT * FROM public.corporate_account_member
       WHERE ${conditions.join(" AND ")}
       ORDER BY granted_at DESC`,
      [accountId],
      client
    );
    return res.rows;
  }

  static async listByUserId(
    userId: string,
    activeOnly: boolean = true,
    client?: PoolClient
  ): Promise<CorporateAccountMemberRow[]> {
    const conditions = ["user_id = $1"];
    if (activeOnly) {
      conditions.push("status = 'ACTIVE'");
    }
    const res = await execQuery<CorporateAccountMemberRow>(
      `SELECT * FROM public.corporate_account_member
       WHERE ${conditions.join(" AND ")}
       ORDER BY granted_at DESC`,
      [userId],
      client
    );
    return res.rows;
  }

  static async grant(
    data: GrantCorporateMemberInput,
    client?: PoolClient
  ): Promise<CorporateAccountMemberRow> {
    const res = await execQuery<CorporateAccountMemberRow>(
      `INSERT INTO public.corporate_account_member (
        account_id,
        user_id,
        member_role,
        status,
        granted_by,
        granted_at,
        metadata
      ) VALUES ($1, $2, $3, 'ACTIVE', $4, NOW(), $5)
      RETURNING *`,
      [
        data.account_id,
        data.user_id,
        data.member_role,
        data.granted_by,
        JSON.stringify(data.metadata || {}),
      ],
      client
    );
    return res.rows[0];
  }

  static async revoke(
    id: string,
    accountId: string,
    revokedBy: string,
    client?: PoolClient
  ): Promise<CorporateAccountMemberRow> {
    const res = await execQuery<CorporateAccountMemberRow>(
      `UPDATE public.corporate_account_member
       SET status = 'REVOKED', revoked_by = $3, revoked_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, accountId, revokedBy],
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Member '${id}' not found for account '${accountId}'.`);
    }
    return res.rows[0];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Corporate Employee Repository
// ─────────────────────────────────────────────────────────────────────────────

export class CorporateEmployeeRepository {
  static async findById(
    id: string,
    accountId?: string,
    client?: PoolClient
  ): Promise<CorporateEmployeeRow | null> {
    const conditions = ["id = $1"];
    const params: any[] = [id];
    if (accountId) {
      params.push(accountId);
      conditions.push(`account_id = $${params.length}`);
    }
    const res = await execQuery<CorporateEmployeeRow>(
      `SELECT * FROM public.corporate_employee WHERE ${conditions.join(" AND ")} LIMIT 1`,
      params,
      client
    );
    return res.rows[0] || null;
  }

  static async findByCode(
    accountId: string,
    employeeCodeKey: string,
    client?: PoolClient
  ): Promise<CorporateEmployeeRow | null> {
    const res = await execQuery<CorporateEmployeeRow>(
      `SELECT * FROM public.corporate_employee
       WHERE account_id = $1 AND employee_code_key = $2
       LIMIT 1`,
      [accountId, employeeCodeKey],
      client
    );
    return res.rows[0] || null;
  }

  static async findEmployeesByPhone(
    accountId: string,
    phone: string,
    excludeEmployeeId?: string,
    client?: PoolClient
  ): Promise<CorporateEmployeeRow[]> {
    const conditions = ["account_id = $1", "phone = $2"];
    const params: any[] = [accountId, phone];
    if (excludeEmployeeId) {
      params.push(excludeEmployeeId);
      conditions.push(`id != $${params.length}`);
    }
    const res = await execQuery<CorporateEmployeeRow>(
      `SELECT * FROM public.corporate_employee
       WHERE ${conditions.join(" AND ")}`,
      params,
      client
    );
    return res.rows;
  }

  static async listByAccountId(
    accountId: string,
    filter: ListCorporateEmployeesFilter = {},
    client?: PoolClient
  ): Promise<{ items: CorporateEmployeeRow[]; total: number }> {
    const conditions: string[] = ["account_id = $1"];
    const params: any[] = [accountId];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter.department) {
      params.push(filter.department);
      conditions.push(`department = $${params.length}`);
    }
    if (filter.city_key) {
      params.push(filter.city_key);
      conditions.push(`city_key = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase().trim()}%`);
      const idx = params.length;
      conditions.push(`(LOWER(full_name) LIKE $${idx} OR LOWER(employee_code) LIKE $${idx} OR phone LIKE $${idx} OR LOWER(email) LIKE $${idx})`);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await execQuery<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM public.corporate_employee WHERE ${whereClause}`,
      params,
      client
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
    const offset = Math.max(filter.offset || 0, 0);

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await execQuery<CorporateEmployeeRow>(
      `SELECT * FROM public.corporate_employee
       WHERE ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
      client
    );

    return {
      items: dataRes.rows,
      total,
    };
  }

  static async create(
    data: CreateCorporateEmployeeInput & { employee_code_key: string },
    client?: PoolClient
  ): Promise<CorporateEmployeeRow> {
    const res = await execQuery<CorporateEmployeeRow>(
      `INSERT INTO public.corporate_employee (
        account_id,
        employee_code,
        employee_code_key,
        full_name,
        phone,
        email,
        department,
        designation,
        default_address,
        city_key,
        default_latitude,
        default_longitude,
        coordinate_source,
        coordinate_verified,
        metadata,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        data.account_id,
        data.employee_code.trim(),
        data.employee_code_key,
        data.full_name.trim(),
        data.phone.trim(),
        data.email ? data.email.trim().toLowerCase() : null,
        data.department ? data.department.trim() : null,
        data.designation ? data.designation.trim() : null,
        JSON.stringify(data.default_address || {}),
        data.city_key || null,
        data.default_latitude ?? null,
        data.default_longitude ?? null,
        data.coordinate_source || null,
        data.coordinate_verified ?? false,
        JSON.stringify(data.metadata || {}),
        data.created_by || null,
      ],
      client
    );
    return res.rows[0];
  }

  static async update(
    id: string,
    accountId: string,
    data: UpdateCorporateEmployeeInput & { employee_code_key?: string },
    client?: PoolClient
  ): Promise<CorporateEmployeeRow> {
    const setClauses: string[] = ["updated_at = NOW()", "version = version + 1"];
    const params: any[] = [id, accountId];

    if (data.employee_code !== undefined) {
      params.push(data.employee_code.trim());
      setClauses.push(`employee_code = $${params.length}`);
    }
    if (data.employee_code_key !== undefined) {
      params.push(data.employee_code_key);
      setClauses.push(`employee_code_key = $${params.length}`);
    }
    if (data.full_name !== undefined) {
      params.push(data.full_name.trim());
      setClauses.push(`full_name = $${params.length}`);
    }
    if (data.phone !== undefined) {
      params.push(data.phone.trim());
      setClauses.push(`phone = $${params.length}`);
    }
    if (data.email !== undefined) {
      params.push(data.email ? data.email.trim().toLowerCase() : null);
      setClauses.push(`email = $${params.length}`);
    }
    if (data.department !== undefined) {
      params.push(data.department ? data.department.trim() : null);
      setClauses.push(`department = $${params.length}`);
    }
    if (data.designation !== undefined) {
      params.push(data.designation ? data.designation.trim() : null);
      setClauses.push(`designation = $${params.length}`);
    }
    if (data.default_address !== undefined) {
      params.push(JSON.stringify(data.default_address));
      setClauses.push(`default_address = $${params.length}`);
    }
    if (data.city_key !== undefined) {
      params.push(data.city_key);
      setClauses.push(`city_key = $${params.length}`);
    }
    if (data.default_latitude !== undefined) {
      params.push(data.default_latitude);
      setClauses.push(`default_latitude = $${params.length}`);
    }
    if (data.default_longitude !== undefined) {
      params.push(data.default_longitude);
      setClauses.push(`default_longitude = $${params.length}`);
    }
    if (data.coordinate_source !== undefined) {
      params.push(data.coordinate_source);
      setClauses.push(`coordinate_source = $${params.length}`);
    }
    if (data.metadata !== undefined) {
      params.push(JSON.stringify(data.metadata));
      setClauses.push(`metadata = $${params.length}`);
    }
    if (data.updated_by !== undefined) {
      params.push(data.updated_by);
      setClauses.push(`updated_by = $${params.length}`);
    }

    let versionCondition = "";
    if (data.expectedVersion !== undefined) {
      params.push(data.expectedVersion);
      versionCondition = ` AND version = $${params.length}`;
    }

    const res = await execQuery<CorporateEmployeeRow>(
      `UPDATE public.corporate_employee
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND account_id = $2${versionCondition}
       RETURNING *`,
      params,
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Employee '${id}' not found for account '${accountId}' or concurrent version mismatch.`);
    }
    return res.rows[0];
  }

  static async deactivate(
    id: string,
    accountId: string,
    data: DeactivateCorporateEmployeeInput,
    client?: PoolClient
  ): Promise<CorporateEmployeeRow> {
    const res = await execQuery<CorporateEmployeeRow>(
      `UPDATE public.corporate_employee
       SET status = 'INACTIVE',
           deactivated_by = $3,
           deactivated_at = NOW(),
           deactivated_reason = $4,
           version = version + 1,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1 AND account_id = $2 AND status = 'ACTIVE'
       RETURNING *`,
      [id, accountId, data.deactivated_by, data.deactivated_reason || null],
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Active employee '${id}' not found for account '${accountId}'.`);
    }
    return res.rows[0];
  }

  static async reactivate(
    id: string,
    accountId: string,
    data: ReactivateCorporateEmployeeInput,
    client?: PoolClient
  ): Promise<CorporateEmployeeRow> {
    const res = await execQuery<CorporateEmployeeRow>(
      `UPDATE public.corporate_employee
       SET status = 'ACTIVE',
           reactivated_by = $3,
           reactivated_at = NOW(),
           reactivated_reason = $4,
           version = version + 1,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1 AND account_id = $2 AND status = 'INACTIVE'
       RETURNING *`,
      [id, accountId, data.reactivated_by, data.reactivated_reason || null],
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Inactive employee '${id}' not found for account '${accountId}'.`);
    }
    return res.rows[0];
  }

  static async verifyCoordinates(
    id: string,
    accountId: string,
    verifiedBy: string,
    client?: PoolClient
  ): Promise<CorporateEmployeeRow> {
    const res = await execQuery<CorporateEmployeeRow>(
      `UPDATE public.corporate_employee
       SET coordinate_verified = true,
           coordinate_verified_by = $3,
           coordinate_verified_at = NOW(),
           coordinate_source = 'ADMIN_VERIFIED',
           version = version + 1,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1 AND account_id = $2 AND default_latitude IS NOT NULL
       RETURNING *`,
      [id, accountId, verifiedBy],
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Employee '${id}' with valid coordinates not found for account '${accountId}'.`);
    }
    return res.rows[0];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Append-Only Corporate Event Repository
// ─────────────────────────────────────────────────────────────────────────────

export class CorporateEventRepository {
  /**
   * Append an account lifecycle audit event.
   * Trigger prevents any UPDATE or DELETE operations.
   */
  static async recordAccountEvent(
    data: RecordAccountEventInput,
    client?: PoolClient
  ): Promise<CorporateAccountEventRow> {
    const res = await execQuery<CorporateAccountEventRow>(
      `INSERT INTO public.corporate_account_event (
        account_id,
        event_type,
        actor_id,
        actor_role,
        reason,
        before_state,
        after_state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.account_id,
        data.event_type,
        data.actor_id || null,
        data.actor_role || null,
        data.reason || null,
        data.before_state ? JSON.stringify(data.before_state) : null,
        JSON.stringify(data.after_state || {}),
      ],
      client
    );
    return res.rows[0];
  }

  /**
   * Append an employee lifecycle audit event.
   * Trigger prevents any UPDATE or DELETE operations.
   */
  static async recordEmployeeEvent(
    data: RecordEmployeeEventInput,
    client?: PoolClient
  ): Promise<CorporateEmployeeEventRow> {
    const res = await execQuery<CorporateEmployeeEventRow>(
      `INSERT INTO public.corporate_employee_event (
        employee_id,
        account_id,
        event_type,
        actor_id,
        actor_role,
        reason,
        before_state,
        after_state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.employee_id,
        data.account_id,
        data.event_type,
        data.actor_id || null,
        data.actor_role || null,
        data.reason || null,
        data.before_state ? JSON.stringify(data.before_state) : null,
        JSON.stringify(data.after_state || {}),
      ],
      client
    );
    return res.rows[0];
  }

  static async listAccountEvents(
    accountId: string,
    limit: number = 100,
    client?: PoolClient
  ): Promise<CorporateAccountEventRow[]> {
    const res = await execQuery<CorporateAccountEventRow>(
      `SELECT * FROM public.corporate_account_event
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [accountId, limit],
      client
    );
    return res.rows;
  }

  static async listEmployeeEvents(
    employeeId: string,
    accountId: string,
    limit: number = 100,
    client?: PoolClient
  ): Promise<CorporateEmployeeEventRow[]> {
    const res = await execQuery<CorporateEmployeeEventRow>(
      `SELECT * FROM public.corporate_employee_event
       WHERE employee_id = $1 AND account_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [employeeId, accountId, limit],
      client
    );
    return res.rows;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Corporate Employee Import Batch Repository
// ─────────────────────────────────────────────────────────────────────────────

export class CorporateEmployeeImportBatchRepository {
  static async findById(
    id: string,
    accountId?: string,
    client?: PoolClient
  ): Promise<CorporateEmployeeImportBatchRow | null> {
    const conditions = ["id = $1"];
    const params: any[] = [id];
    if (accountId) {
      params.push(accountId);
      conditions.push(`account_id = $${params.length}`);
    }
    const res = await execQuery<CorporateEmployeeImportBatchRow>(
      `SELECT * FROM public.corporate_employee_import_batch WHERE ${conditions.join(" AND ")} LIMIT 1`,
      params,
      client
    );
    return res.rows[0] || null;
  }

  static async findByHash(
    accountId: string,
    fileHash: string,
    committedOnly: boolean = false,
    client?: PoolClient
  ): Promise<CorporateEmployeeImportBatchRow | null> {
    const conditions = ["account_id = $1", "file_hash = $2"];
    if (committedOnly) {
      conditions.push("status = 'COMMITTED'");
    }
    const res = await execQuery<CorporateEmployeeImportBatchRow>(
      `SELECT * FROM public.corporate_employee_import_batch
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT 1`,
      [accountId, fileHash],
      client
    );
    return res.rows[0] || null;
  }

  static async listByAccountId(
    accountId: string,
    limit: number = 50,
    client?: PoolClient
  ): Promise<CorporateEmployeeImportBatchRow[]> {
    const res = await execQuery<CorporateEmployeeImportBatchRow>(
      `SELECT * FROM public.corporate_employee_import_batch
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [accountId, limit],
      client
    );
    return res.rows;
  }

  static async create(
    data: CreateEmployeeImportBatchInput,
    client?: PoolClient
  ): Promise<CorporateEmployeeImportBatchRow> {
    const res = await execQuery<CorporateEmployeeImportBatchRow>(
      `INSERT INTO public.corporate_employee_import_batch (
        account_id,
        file_hash,
        filename,
        status,
        total_rows,
        valid_rows,
        invalid_rows,
        inserted_rows,
        row_errors,
        metadata,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.account_id,
        data.file_hash,
        data.filename,
        data.status || "DRY_RUN_OK",
        data.total_rows || 0,
        data.valid_rows || 0,
        data.invalid_rows || 0,
        data.inserted_rows || 0,
        JSON.stringify(data.row_errors || []),
        JSON.stringify(data.metadata || {}),
        data.created_by || null,
      ],
      client
    );
    return res.rows[0];
  }

  static async updateStatus(
    id: string,
    accountId: string,
    status: CorporateEmployeeImportBatchStatus,
    fields: {
      valid_rows?: number;
      invalid_rows?: number;
      inserted_rows?: number;
      row_errors?: Record<string, unknown>[];
      committed_by?: string;
      committed_at?: string;
    } = {},
    client?: PoolClient
  ): Promise<CorporateEmployeeImportBatchRow> {
    const setClauses: string[] = ["status = $3"];
    const params: any[] = [id, accountId, status];

    if (fields.valid_rows !== undefined) {
      params.push(fields.valid_rows);
      setClauses.push(`valid_rows = $${params.length}`);
    }
    if (fields.invalid_rows !== undefined) {
      params.push(fields.invalid_rows);
      setClauses.push(`invalid_rows = $${params.length}`);
    }
    if (fields.inserted_rows !== undefined) {
      params.push(fields.inserted_rows);
      setClauses.push(`inserted_rows = $${params.length}`);
    }
    if (fields.row_errors !== undefined) {
      params.push(JSON.stringify(fields.row_errors));
      setClauses.push(`row_errors = $${params.length}`);
    }
    if (fields.committed_by !== undefined) {
      params.push(fields.committed_by);
      setClauses.push(`committed_by = $${params.length}`);
    }
    if (fields.committed_at !== undefined) {
      params.push(fields.committed_at);
      setClauses.push(`committed_at = $${params.length}`);
    }

    const res = await execQuery<CorporateEmployeeImportBatchRow>(
      `UPDATE public.corporate_employee_import_batch
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      params,
      client
    );
    if (!res.rows[0]) {
      throw new Error(`Import batch '${id}' not found for account '${accountId}'.`);
    }
    return res.rows[0];
  }
}
