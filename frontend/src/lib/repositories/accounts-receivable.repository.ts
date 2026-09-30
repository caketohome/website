/**
 * CakeToHome ERP — Accounts Receivable (AR) Repository
 * Phase 4F Step 4.8: Trade AR Statement & AR ↔ GL Reconciliation Data Access
 *
 * RESPONSIBILITIES:
 * - Direct parameterized SQL queries against PostgreSQL.
 * - Extracts posted accounting data for Account 1121 (Trade Accounts Receivable).
 * - Strictly excludes Account 1122 (Undeposited COD).
 * - Implements deterministic chronological tie-breaking.
 * - Implements systematic control exception queries.
 *
 * SOURCE OF TRUTH:
 * - public.accounting_journal_line
 * - public.accounting_journal_entry
 * - public.accounting_voucher
 * - public.accounting_account
 */

import { dbQuery } from "../db";
import type { PoolClient, QueryResultRow } from "pg";

export interface RawStatementLineRow {
  line_id: string;
  line_no: number;
  voucher_id: string;
  voucher_no: string;
  voucher_type: string;
  voucher_date: string | Date;
  reference_type: string | null;
  reference_id: string | null;
  reference_event: string | null;
  branch_id: string;
  branch_name: string | null;
  line_narration: string | null;
  voucher_narration: string | null;
  debit_amount: string | number;
  credit_amount: string | number;
  entry_created_at: string | Date;
}

export interface RawCustomerSubledgerBalanceRow {
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  total_debit: string | number;
  total_credit: string | number;
  balance: string | number;
}

export interface RawMissingCustomerDimensionRow {
  line_id: string;
  voucher_id: string;
  voucher_no: string;
  reference_type: string;
  reference_id: string;
  registered_customer_id: string;
  net_amount: string | number;
}

export interface RawInvalidCustomerReferenceRow {
  line_id: string;
  voucher_id: string;
  voucher_no: string;
  customer_id: string;
  net_amount: string | number;
}

export interface RawDuplicateSourceVoucherRow {
  reference_type: string;
  reference_id: string;
  count_vouchers: string | number;
}

export interface RawBranchMismatchRow {
  line_id: string;
  voucher_id: string;
  voucher_no: string;
  line_branch_id: string;
  voucher_branch_id: string;
}

export interface RawUnbalancedJournalEntryRow {
  entry_id: string;
  entry_no: string;
  voucher_no: string;
  total_debit: string | number;
  total_credit: string | number;
  lines_debit: string | number;
  lines_credit: string | number;
}

export interface RawAccountMisclassificationRow {
  line_id: string;
  voucher_id: string;
  voucher_no: string;
  net_amount: string | number;
}

export class AccountsReceivableRepository {
  private static async query<T extends QueryResultRow = any>(
    sql: string,
    params: any[],
    client?: PoolClient
  ): Promise<{ rows: T[] }> {
    return client ? client.query<T>(sql, params) : dbQuery<T>(sql, params);
  }

  /**
   * Resolves GL Account by account code (e.g. '1121').
   */
  static async findAccountByCode(
    code: string,
    client?: PoolClient
  ): Promise<{ id: string; code: string; name: string } | null> {
    const res = await this.query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name
       FROM public.accounting_account
       WHERE code = $1 AND is_active = true
       LIMIT 1`,
      [code],
      client
    );
    return res.rows[0] || null;
  }

  /**
   * Resolves registered Customer by ID.
   */
  static async findCustomerById(
    customerId: string,
    client?: PoolClient
  ): Promise<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null> {
    const res = await this.query<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
    }>(
      `SELECT id, first_name, last_name, email, phone
       FROM public.customer
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [customerId],
      client
    );
    return res.rows[0] || null;
  }

  /**
   * Calculates opening balance strictly from posted journal lines before startDate.
   * Opening = SUM(debit) - SUM(credit)
   */
  static async getOpeningBalance(
    params: {
      accountId: string;
      customerId: string;
      startDate: string;
      branchId?: string;
    },
    client?: PoolClient
  ): Promise<number> {
    const conditions: string[] = [
      "jl.account_id = $1",
      "jl.customer_id = $2",
      "v.status = 'POSTED'",
      "v.deleted_at IS NULL",
      "v.voucher_date < $3",
    ];
    const sqlParams: any[] = [params.accountId, params.customerId, params.startDate];

    if (params.branchId) {
      conditions.push(`jl.branch_id = $${sqlParams.length + 1}`);
      sqlParams.push(params.branchId);
    }

    const sql = `
      SELECT
        COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS opening_balance
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE ${conditions.join(" AND ")}
    `;

    const res = await this.query<{ opening_balance: string | number }>(sql, sqlParams, client);
    return Math.round(Number(res.rows[0]?.opening_balance ?? 0) * 100) / 100;
  }

  /**
   * Retrieves chronological posted transaction rows within the date window.
   * Deterministic ordering:
   *   voucher_date ASC,
   *   je.created_at ASC,
   *   voucher_no ASC,
   *   line_no ASC,
   *   id ASC
   */
  static async getStatementLines(
    params: {
      accountId: string;
      customerId: string;
      startDate: string;
      endDate: string;
      branchId?: string;
    },
    client?: PoolClient
  ): Promise<RawStatementLineRow[]> {
    const conditions: string[] = [
      "jl.account_id = $1",
      "jl.customer_id = $2",
      "v.status = 'POSTED'",
      "v.deleted_at IS NULL",
      "v.voucher_date >= $3",
      "v.voucher_date <= $4",
    ];
    const sqlParams: any[] = [params.accountId, params.customerId, params.startDate, params.endDate];

    if (params.branchId) {
      conditions.push(`jl.branch_id = $${sqlParams.length + 1}`);
      sqlParams.push(params.branchId);
    }

    const sql = `
      SELECT
        jl.id AS line_id,
        jl.line_no,
        v.id AS voucher_id,
        v.voucher_no,
        v.voucher_type,
        v.voucher_date,
        v.reference_type,
        v.reference_id,
        v.reference_event,
        jl.branch_id,
        b.name AS branch_name,
        jl.narration AS line_narration,
        v.narration AS voucher_narration,
        jl.debit_amount,
        jl.credit_amount,
        je.created_at AS entry_created_at
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      LEFT JOIN public.branch b ON b.id = jl.branch_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        v.voucher_date ASC,
        je.created_at ASC,
        v.voucher_no ASC,
        jl.line_no ASC,
        jl.id ASC
    `;

    const res = await this.query<RawStatementLineRow>(sql, sqlParams, client);
    return res.rows;
  }

  /**
   * Retrieves GL Control Account Net Debit Balance as of a specific date.
   */
  static async getGlAccountBalance(
    params: {
      accountId: string;
      asOfDate: string;
      branchId?: string;
    },
    client?: PoolClient
  ): Promise<number> {
    const conditions: string[] = [
      "jl.account_id = $1",
      "v.status = 'POSTED'",
      "v.deleted_at IS NULL",
      "v.voucher_date <= $2",
    ];
    const sqlParams: any[] = [params.accountId, params.asOfDate];

    if (params.branchId) {
      conditions.push(`jl.branch_id = $${sqlParams.length + 1}`);
      sqlParams.push(params.branchId);
    }

    const sql = `
      SELECT
        COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS gl_balance
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE ${conditions.join(" AND ")}
    `;

    const res = await this.query<{ gl_balance: string | number }>(sql, sqlParams, client);
    return Math.round(Number(res.rows[0]?.gl_balance ?? 0) * 100) / 100;
  }

  /**
   * Retrieves aggregated subledger balances for all identified customers on Account 1121.
   */
  static async getCustomerSubledgerBalances(
    params: {
      accountId: string;
      asOfDate: string;
      branchId?: string;
    },
    client?: PoolClient
  ): Promise<RawCustomerSubledgerBalanceRow[]> {
    const conditions: string[] = [
      "jl.account_id = $1",
      "jl.customer_id IS NOT NULL",
      "v.status = 'POSTED'",
      "v.deleted_at IS NULL",
      "v.voucher_date <= $2",
    ];
    const sqlParams: any[] = [params.accountId, params.asOfDate];

    if (params.branchId) {
      conditions.push(`jl.branch_id = $${sqlParams.length + 1}`);
      sqlParams.push(params.branchId);
    }

    const sql = `
      SELECT
        jl.customer_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        COALESCE(SUM(jl.debit_amount), 0) AS total_debit,
        COALESCE(SUM(jl.credit_amount), 0) AS total_credit,
        COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS balance
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      LEFT JOIN public.customer c ON c.id = jl.customer_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY jl.customer_id, c.first_name, c.last_name, c.email, c.phone
      ORDER BY balance DESC, jl.customer_id ASC
    `;

    const res = await this.query<RawCustomerSubledgerBalanceRow>(sql, sqlParams, client);
    return res.rows;
  }

  /**
   * Retrieves net balance for legitimate guest / unassigned transactions (customer_id IS NULL).
   */
  static async getGuestUnassignedBalance(
    params: {
      accountId: string;
      asOfDate: string;
      branchId?: string;
    },
    client?: PoolClient
  ): Promise<number> {
    const conditions: string[] = [
      "jl.account_id = $1",
      "jl.customer_id IS NULL",
      "v.status = 'POSTED'",
      "v.deleted_at IS NULL",
      "v.voucher_date <= $2",
    ];
    const sqlParams: any[] = [params.accountId, params.asOfDate];

    if (params.branchId) {
      conditions.push(`jl.branch_id = $${sqlParams.length + 1}`);
      sqlParams.push(params.branchId);
    }

    const sql = `
      SELECT
        COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS guest_balance
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE ${conditions.join(" AND ")}
    `;

    const res = await this.query<{ guest_balance: string | number }>(sql, sqlParams, client);
    return Math.round(Number(res.rows[0]?.guest_balance ?? 0) * 100) / 100;
  }

  /**
   * Finds journal lines where customer dimension is NULL, but the originating
   * order was registered to an authenticated customer.
   */
  static async findMissingCustomerDimensionLines(
    params: {
      accountId: string;
      asOfDate: string;
    },
    client?: PoolClient
  ): Promise<RawMissingCustomerDimensionRow[]> {
    const sql = `
      SELECT 
        jl.id AS line_id,
        v.id AS voucher_id,
        v.voucher_no,
        v.reference_type,
        v.reference_id,
        o.customer_id AS registered_customer_id,
        (jl.debit_amount - jl.credit_amount) AS net_amount
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      JOIN public."order" o ON o.id = v.reference_id AND v.reference_type = 'ORDER'
      WHERE jl.account_id = $1
        AND jl.customer_id IS NULL
        AND o.customer_id IS NOT NULL
        AND v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND v.voucher_date <= $2
    `;

    const res = await this.query<RawMissingCustomerDimensionRow>(sql, [params.accountId, params.asOfDate], client);
    return res.rows;
  }

  /**
   * Finds journal lines referencing customer IDs that do not exist in public.customer.
   * Note: Database foreign key constraints proactively prevent this; this query serves
   * as a secondary defense against raw/bypassed mutations.
   */
  static async findInvalidCustomerReferenceLines(
    params: {
      accountId: string;
      asOfDate: string;
    },
    client?: PoolClient
  ): Promise<RawInvalidCustomerReferenceRow[]> {
    const sql = `
      SELECT 
        jl.id AS line_id,
        v.id AS voucher_id,
        v.voucher_no,
        jl.customer_id,
        (jl.debit_amount - jl.credit_amount) AS net_amount
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      LEFT JOIN public.customer c ON c.id = jl.customer_id
      WHERE jl.account_id = $1
        AND jl.customer_id IS NOT NULL
        AND c.id IS NULL
        AND v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND v.voucher_date <= $2
    `;

    const res = await this.query<RawInvalidCustomerReferenceRow>(sql, [params.accountId, params.asOfDate], client);
    return res.rows;
  }

  /**
   * Finds duplicate active PRIMARY vouchers on the same reference source.
   */
  static async findDuplicateSourceVouchers(
    params: {
      asOfDate: string;
    },
    client?: PoolClient
  ): Promise<RawDuplicateSourceVoucherRow[]> {
    const sql = `
      SELECT 
        v.reference_type,
        v.reference_id,
        COUNT(*) AS count_vouchers
      FROM public.accounting_voucher v
      WHERE v.reference_type IS NOT NULL
        AND v.reference_id IS NOT NULL
        AND v.reference_event = 'PRIMARY'
        AND v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND v.voucher_date <= $1
      GROUP BY v.reference_type, v.reference_id
      HAVING COUNT(*) > 1
    `;

    const res = await this.query<RawDuplicateSourceVoucherRow>(sql, [params.asOfDate], client);
    return res.rows;
  }

  /**
   * Finds journal lines where the line branch differs from the voucher header branch.
   */
  static async findBranchMismatchLines(
    params: {
      accountId: string;
      asOfDate: string;
    },
    client?: PoolClient
  ): Promise<RawBranchMismatchRow[]> {
    const sql = `
      SELECT 
        jl.id AS line_id,
        v.id AS voucher_id,
        v.voucher_no,
        jl.branch_id AS line_branch_id,
        v.branch_id AS voucher_branch_id
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE jl.account_id = $1
        AND jl.branch_id != v.branch_id
        AND v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND v.voucher_date <= $2
    `;

    const res = await this.query<RawBranchMismatchRow>(sql, [params.accountId, params.asOfDate], client);
    return res.rows;
  }

  /**
   * Finds unbalanced journal entries (header debit != credit, lines sum != header, or line debits != credits).
   */
  static async findUnbalancedJournalEntries(
    params: {
      asOfDate: string;
    },
    client?: PoolClient
  ): Promise<RawUnbalancedJournalEntryRow[]> {
    const sql = `
      SELECT 
        je.id AS entry_id,
        je.entry_no,
        v.voucher_no,
        je.total_debit,
        je.total_credit,
        COALESCE(SUM(jl.debit_amount), 0) AS lines_debit,
        COALESCE(SUM(jl.credit_amount), 0) AS lines_credit
      FROM public.accounting_journal_entry je
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      LEFT JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
      WHERE v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND v.voucher_date <= $1
      GROUP BY je.id, je.entry_no, v.voucher_no, je.total_debit, je.total_credit
      HAVING je.total_debit != je.total_credit
         OR COALESCE(SUM(jl.debit_amount), 0) != COALESCE(SUM(jl.credit_amount), 0)
         OR COALESCE(SUM(jl.debit_amount), 0) != je.total_debit
    `;

    const res = await this.query<RawUnbalancedJournalEntryRow>(sql, [params.asOfDate], client);
    return res.rows;
  }

  /**
   * Finds postings mistakenly made to parent group account '1120' instead of leaf '1121'.
   */
  static async findAccountMisclassificationLines(
    params: {
      asOfDate: string;
    },
    client?: PoolClient
  ): Promise<RawAccountMisclassificationRow[]> {
    const sql = `
      SELECT 
        jl.id AS line_id,
        v.id AS voucher_id,
        v.voucher_no,
        (jl.debit_amount - jl.credit_amount) AS net_amount
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      JOIN public.accounting_account acc ON acc.id = jl.account_id
      WHERE acc.code = '1120'
        AND v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND v.voucher_date <= $1
    `;

    const res = await this.query<RawAccountMisclassificationRow>(sql, [params.asOfDate], client);
    return res.rows;
  }
}
