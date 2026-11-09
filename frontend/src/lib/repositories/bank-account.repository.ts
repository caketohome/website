/**
 * CakeToHome ERP — Bank Account Repository
 * Enterprise Company Bank Account Master & Cash Management
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - All operations execute direct parameterized SQL against public.bank_account.
 * 2. STRICT VALIDATION & CONSTRAINTS:
 *    - Bank accounts belong strictly to the COMPANY (no branch ownership).
 *    - Strict 1:1 foreign key mapping to public.accounting_account (gl_account_id).
 *    - Composite unique constraint on (company_id, ifsc_code, account_number).
 *    - IFSC regex: ^[A-Z]{4}0[A-Z0-9]{6}$.
 *    - Status IN ('ACTIVE', 'INACTIVE', 'FROZEN').
 * 3. ENTERPRISE GL LINKAGE:
 *    - Bank accounts join with public.accounting_account to surface gl_account_code and gl_account_name.
 * 4. PESSIMISTIC LOCKING:
 *    - Supports SELECT ... FOR UPDATE for atomic mutations and concurrency defense.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  BankAccountRow,
  BankAccountStatus,
  BankAccountType,
  BankTransactionRow,
  BankTransferRow,
  CashAccountRow,
  BankReconciliationRow,
} from "../types/accounting.types";

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
      branch_id?: string | null;
      currency?: string;
      gl_account_id: string;
      bank_charges_gl_account_id?: string | null;
      interest_gl_account_id?: string | null;
      offset_gl_account_id?: string | null;
      opening_balance?: number;
      opening_balance_date?: string | null;
      current_balance?: number;
      statement_balance?: number;
      is_primary?: boolean;
      allow_payments?: boolean;
      allow_receipts?: boolean;
      reconciliation_required?: boolean;
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
    const branchId = params.branch_id || null;
    const currency = params.currency || "INR";
    const glAccountId = params.gl_account_id;
    const bankChargesGlId = params.bank_charges_gl_account_id || null;
    const interestGlId = params.interest_gl_account_id || null;
    const offsetGlId = params.offset_gl_account_id || null;
    const openingBalance = Number(params.opening_balance) || 0;
    const openingDate = params.opening_balance_date || null;
    const currentBalance = Number(params.current_balance !== undefined ? params.current_balance : openingBalance);
    const statementBalance = Number(params.statement_balance !== undefined ? params.statement_balance : openingBalance);
    const isPrimary = Boolean(params.is_primary);
    const allowPayments = params.allow_payments !== false;
    const allowReceipts = params.allow_receipts !== false;
    const reconRequired = params.reconciliation_required !== false;
    const status = params.status || "ACTIVE";
    const metadata = params.metadata || {};
    const createdBy = params.created_by || "system";

    const sql = `
      INSERT INTO public.bank_account (
        id, company_id, account_name, bank_name, account_number, account_number_masked,
        ifsc_code, account_type, branch_name, branch_id, currency, gl_account_id,
        bank_charges_gl_account_id, interest_gl_account_id, offset_gl_account_id,
        opening_balance, opening_balance_date, current_balance, statement_balance,
        is_primary, allow_payments, allow_receipts, reconciliation_required,
        status, metadata, created_by, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26, $26, NOW(), NOW()
      )
      RETURNING *;
    `;
    const values = [
      id, companyId, accountName, bankName, accountNumber, maskedAcc,
      ifsc, accountType, branchName, branchId, currency, glAccountId,
      bankChargesGlId, interestGlId, offsetGlId,
      openingBalance, openingDate, currentBalance, statementBalance,
      isPrimary, allowPayments, allowReceipts, reconRequired,
      status, JSON.stringify(metadata), createdBy
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
        aa.name AS gl_account_name,
        br.code AS branch_code
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      LEFT JOIN public.branch br ON ba.branch_id = br.id
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

    if (filter.status && filter.status !== ("ALL" as any)) {
      conditions.push(`ba.status = $${idx++}`);
      values.push(filter.status);
    }

    if (filter.branchId) {
      conditions.push(`ba.branch_id = $${idx++}`);
      values.push(filter.branchId);
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
        aa.name AS gl_account_name,
        br.code AS branch_code
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      LEFT JOIN public.branch br ON ba.branch_id = br.id
      ${whereClause}
      ORDER BY ba.is_primary DESC, ba.created_at DESC;
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  /**
   * Updates an existing bank account.
   */
  static async update(
    params: {
      id: string;
      account_name?: string;
      bank_name?: string;
      account_number?: string;
      account_number_masked?: string;
      ifsc_code?: string;
      account_type?: BankAccountType;
      branch_name?: string | null;
      branch_id?: string | null;
      gl_account_id?: string;
      is_primary?: boolean;
      allow_payments?: boolean;
      allow_receipts?: boolean;
      reconciliation_required?: boolean;
      status?: BankAccountStatus;
      metadata?: Record<string, unknown>;
      updated_by?: string;
    },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const fields: string[] = [];
    const values: unknown[] = [params.id];
    let idx = 2;

    if (params.account_name !== undefined) {
      fields.push(`account_name = $${idx++}`);
      values.push(params.account_name.trim());
    }
    if (params.bank_name !== undefined) {
      fields.push(`bank_name = $${idx++}`);
      values.push(params.bank_name.trim());
    }
    if (params.account_number !== undefined) {
      fields.push(`account_number = $${idx++}`);
      values.push(params.account_number.trim());
    }
    if (params.account_number_masked !== undefined) {
      fields.push(`account_number_masked = $${idx++}`);
      values.push(params.account_number_masked.trim());
    }
    if (params.ifsc_code !== undefined) {
      fields.push(`ifsc_code = $${idx++}`);
      values.push(params.ifsc_code.trim().toUpperCase());
    }
    if (params.account_type !== undefined) {
      fields.push(`account_type = $${idx++}`);
      values.push(params.account_type);
    }
    if (params.branch_name !== undefined) {
      fields.push(`branch_name = $${idx++}`);
      values.push(params.branch_name ? params.branch_name.trim() : null);
    }
    if (params.branch_id !== undefined) {
      fields.push(`branch_id = $${idx++}`);
      values.push(params.branch_id);
    }
    if (params.gl_account_id !== undefined) {
      fields.push(`gl_account_id = $${idx++}`);
      values.push(params.gl_account_id);
    }
    if (params.is_primary !== undefined) {
      fields.push(`is_primary = $${idx++}`);
      values.push(params.is_primary);
    }
    if (params.allow_payments !== undefined) {
      fields.push(`allow_payments = $${idx++}`);
      values.push(params.allow_payments);
    }
    if (params.allow_receipts !== undefined) {
      fields.push(`allow_receipts = $${idx++}`);
      values.push(params.allow_receipts);
    }
    if (params.reconciliation_required !== undefined) {
      fields.push(`reconciliation_required = $${idx++}`);
      values.push(params.reconciliation_required);
    }
    if (params.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(params.status);
    }
    if (params.metadata !== undefined) {
      fields.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(params.metadata));
    }
    if (params.updated_by !== undefined) {
      fields.push(`updated_by = $${idx++}`);
      values.push(params.updated_by);
    }

    fields.push("updated_at = NOW()");

    const sql = `
      UPDATE public.bank_account
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows[0];
  }

  /**
   * Sets bank account status (ACTIVE, INACTIVE, FROZEN).
   */
  static async updateStatus(
    id: string,
    status: BankAccountStatus,
    updatedBy: string = "system",
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const sql = `
      UPDATE public.bank_account
      SET status = $2, updated_by = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client ? await client.query(sql, [id, status, updatedBy]) : await dbQuery(sql, [id, status, updatedBy]);
    return res.rows[0];
  }

  /**
   * Queries bank transactions for a specific bank account.
   */
  static async getTransactions(
    bankAccountId: string,
    client?: PoolClient
  ): Promise<BankTransactionRow[]> {
    const sql = `
      SELECT * FROM public.bank_transaction
      WHERE bank_account_id = $1
      ORDER BY transaction_date DESC, created_at DESC;
    `;
    const res = client ? await client.query(sql, [bankAccountId]) : await dbQuery(sql, [bankAccountId]);
    return res.rows;
  }

  /**
   * Records a bank transaction with running balance calculation.
   */
  static async recordTransaction(
    params: {
      bank_account_id: string;
      transaction_date: string;
      value_date?: string | null;
      transaction_type: string;
      reference_no?: string | null;
      description: string;
      debit_amount?: number;
      credit_amount?: number;
      reconciliation_status?: string;
      voucher_id?: string | null;
      journal_entry_id?: string | null;
      created_by?: string;
    },
    client?: PoolClient
  ): Promise<BankTransactionRow> {
    const id = `bt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const debit = Number(params.debit_amount) || 0;
    const credit = Number(params.credit_amount) || 0;

    // Fetch account to update current balance
    const bank = await this.findById(params.bank_account_id, client, true);
    if (!bank) throw new BankAccountError("NOT_FOUND", "Bank account not found");

    // In bank accounting:
    // Deposit / Inflow is Credit to bank ledger in Indian passbook, or Debit to Asset in company ledger.
    // For standard display: credit increases balance, debit decreases balance.
    const newBalance = Number(bank.current_balance || 0) + credit - debit;

    const sql = `
      INSERT INTO public.bank_transaction (
        id, bank_account_id, transaction_date, value_date, transaction_type,
        reference_no, description, debit_amount, credit_amount, running_balance,
        reconciliation_status, voucher_id, journal_entry_id, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING *;
    `;
    const values = [
      id, params.bank_account_id, params.transaction_date, params.value_date || null,
      params.transaction_type, params.reference_no || null, params.description,
      debit, credit, newBalance, params.reconciliation_status || 'UNRECONCILED',
      params.voucher_id || null, params.journal_entry_id || null, params.created_by || 'system'
    ];

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);

    // Update bank balance (on the transaction client when provided, so it commits atomically)
    const balanceSql = `UPDATE public.bank_account SET current_balance = $2, updated_at = NOW() WHERE id = $1;`;
    const balanceValues = [params.bank_account_id, newBalance];
    if (client) {
      await client.query(balanceSql, balanceValues);
    } else {
      await dbQuery(balanceSql, balanceValues);
    }

    return res.rows[0];
  }

  /**
   * Lists cash accounts.
   */
  static async listCashAccounts(
    filter: { companyId?: string; branchId?: string } = {},
    client?: PoolClient
  ): Promise<CashAccountRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.companyId) {
      conditions.push(`ca.company_id = $${idx++}`);
      values.push(filter.companyId);
    }
    if (filter.branchId) {
      conditions.push(`ca.branch_id = $${idx++}`);
      values.push(filter.branchId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT
        ca.*,
        aa.code AS gl_account_code,
        aa.name AS gl_account_name,
        br.name AS branch_name
      FROM public.cash_account ca
      LEFT JOIN public.accounting_account aa ON ca.gl_account_id = aa.id
      LEFT JOIN public.branch br ON ca.branch_id = br.id
      ${where}
      ORDER BY ca.created_at ASC;
    `;
    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  /**
   * Creates a cash account.
   */
  static async createCashAccount(
    params: {
      company_id: string;
      branch_id?: string | null;
      account_name: string;
      account_type?: string;
      gl_account_id: string;
      opening_balance?: number;
      created_by?: string;
    },
    client?: PoolClient
  ): Promise<CashAccountRow> {
    const id = `cash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const openBal = Number(params.opening_balance) || 0;
    const sql = `
      INSERT INTO public.cash_account (
        id, company_id, branch_id, account_name, account_type, gl_account_id,
        opening_balance, current_balance, status, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 'ACTIVE', $8, $8, NOW(), NOW())
      RETURNING *;
    `;
    const res = client
      ? await client.query(sql, [id, params.company_id, params.branch_id || null, params.account_name, params.account_type || 'MAIN_CASH', params.gl_account_id, openBal, params.created_by || 'system'])
      : await dbQuery(sql, [id, params.company_id, params.branch_id || null, params.account_name, params.account_type || 'MAIN_CASH', params.gl_account_id, openBal, params.created_by || 'system']);
    return res.rows[0];
  }

  /**
   * Retrieves summary metrics for Bank & Cash Management Dashboard.
   */
  static async getDashboardSummary(client?: PoolClient): Promise<{
    totalBankAccounts: number;
    activeBankAccounts: number;
    totalBankBalance: number;
    totalCashBalance: number;
    pendingReconciliations: number;
    unmatchedTransactions: number;
  }> {
    const q1 = `
      SELECT
        COUNT(*) AS total_banks,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_banks,
        COALESCE(SUM(current_balance), 0) AS total_bank_balance
      FROM public.bank_account
      WHERE deleted_at IS NULL;
    `;
    const q2 = `
      SELECT COALESCE(SUM(current_balance), 0) AS total_cash_balance
      FROM public.cash_account
      WHERE deleted_at IS NULL AND status = 'ACTIVE';
    `;
    const q3 = `
      SELECT COUNT(*) AS unmatched
      FROM public.bank_transaction
      WHERE reconciliation_status = 'UNRECONCILED';
    `;
    const q4 = `
      SELECT COUNT(*) AS pending_recon
      FROM public.bank_reconciliation
      WHERE status = 'IN_PROGRESS';
    `;

    const runner = client ? client.query.bind(client) : dbQuery;
    const [r1, r2, r3, r4] = await Promise.all([
      runner(q1), runner(q2), runner(q3), runner(q4)
    ]);

    return {
      totalBankAccounts: parseInt(r1.rows[0]?.total_banks || "0", 10),
      activeBankAccounts: parseInt(r1.rows[0]?.active_banks || "0", 10),
      totalBankBalance: parseFloat(r1.rows[0]?.total_bank_balance || "0"),
      totalCashBalance: parseFloat(r2.rows[0]?.total_cash_balance || "0"),
      pendingReconciliations: parseInt(r4.rows[0]?.pending_recon || "0", 10),
      unmatchedTransactions: parseInt(r3.rows[0]?.unmatched || "0", 10),
    };
  }
}
