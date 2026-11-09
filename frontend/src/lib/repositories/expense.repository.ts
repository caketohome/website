/**
 * CakeToHome ERP — Expense Repository
 * Phase 2: Database access layer for the expense table.
 *
 * ARCHITECTURE:
 * - Uses canonical dbQuery helper from lib/db
 * - branch_id always from the session (never from client input)
 * - Soft deletion only — never hard-deletes
 * - 6 report queries: register, category-wise, branch-wise, date-wise, payment-method, supplier-wise
 * - No accounting journal entries created
 */

import { dbQuery } from "../db";
import {
  ExpenseRow,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseListFilters,
  ExpenseListResult,
  ExpenseStatus,
  EXPENSE_TRANSITIONS,
  ExpenseRegisterRow,
  CategoryWiseExpenseRow,
  BranchWiseExpenseRow,
  DateWiseExpenseRow,
  PaymentMethodExpenseRow,
  SupplierWiseExpenseRow,
  ExpenseGstSummaryRow,
  ExpenseReportFilters,
} from "../types/expense.types";

// ─── ID Generation ────────────────────────────────────────────────────────────

function generateExpenseId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `exp_${ts}${rnd}`;
}

// ─── ExpenseRepository ────────────────────────────────────────────────────────

export class ExpenseRepository {
  // ── CREATE ──────────────────────────────────────────────────────────────────

  /** Create a new expense. Always starts as DRAFT. branchId from session only. */
  static async create(
    input: ExpenseCreateInput,
    branchId: string,
    createdBy: string
  ): Promise<ExpenseRow> {
    const id = generateExpenseId();
    const sql = `
      INSERT INTO public.expense
        (id, branch_id, category_id, supplier_id,
         expense_date, reference_no, description,
         subtotal, discount, taxable_value, cgst, sgst, igst, total,
         payment_method, settlement_type, bank_account_id, teller_session_id, company_id,
         itc_eligibility, rcm_applicable, hsn_sac_code, vendor_gstin,
         notes, status, created_by, metadata,
         created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'DRAFT',$25,$26,NOW(),NOW())
      RETURNING *
    `;
    const params = [
      id,
      branchId,
      input.category_id ?? null,
      input.supplier_id ?? null,
      input.expense_date,
      input.reference_no ?? null,
      input.description.trim(),
      input.subtotal ?? input.total ?? 0,
      input.discount ?? 0,
      input.taxable_value ?? input.subtotal ?? input.total ?? 0,
      input.cgst ?? 0,
      input.sgst ?? 0,
      input.igst ?? 0,
      input.total,
      input.payment_method ?? null,
      input.settlement_type ?? "DIRECT_PAYMENT",
      input.bank_account_id ?? null,
      input.teller_session_id ?? null,
      input.company_id ?? null,
      input.itc_eligibility ?? "ITC_ELIGIBLE",
      Boolean(input.rcm_applicable),
      input.hsn_sac_code ?? null,
      input.vendor_gstin ?? null,
      input.notes ?? null,
      createdBy,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ];
    const result = await dbQuery<ExpenseRow>(sql, params);
    return result.rows[0];
  }

  // ── READ ────────────────────────────────────────────────────────────────────

  /** Find an expense by ID, optionally scoping to a branch. */
  static async findById(
    id: string,
    branchId?: string
  ): Promise<ExpenseRow | null> {
    const conditions = ["e.id = $1", "e.deleted_at IS NULL"];
    const params: unknown[] = [id];
    if (branchId) {
      conditions.push("e.branch_id = $2");
      params.push(branchId);
    }
    const sql = `
      SELECT e.*,
             ec.name  AS category_name,
             ec.gl_account_code AS category_gl_code,
             s.name   AS supplier_name,
             b.name   AS branch_name,
             v.voucher_no AS voucher_no,
             rv.voucher_no AS reversal_voucher_no,
             ba.account_name AS bank_account_name
      FROM   public.expense          e
      LEFT JOIN public.expense_category ec ON ec.id = e.category_id
      LEFT JOIN public.supplier         s  ON s.id  = e.supplier_id
      LEFT JOIN public.branch           b  ON b.id  = e.branch_id
      LEFT JOIN public.accounting_voucher v ON v.id = e.voucher_id
      LEFT JOIN public.accounting_voucher rv ON rv.id = e.reversal_voucher_id
      LEFT JOIN public.bank_account     ba ON ba.id = e.bank_account_id
      WHERE  ${conditions.join(" AND ")}
    `;
    const result = await dbQuery<ExpenseRow>(sql, params as any[]);
    return result.rows[0] ?? null;
  }

  /** List expenses with filters, pagination, and joined category/supplier names. */
  static async list(filters: ExpenseListFilters = {}): Promise<ExpenseListResult> {
    const conditions: string[] = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id)    { conditions.push(`e.branch_id = $${idx++}`);    params.push(filters.branch_id); }
    if (filters.category_id)  { conditions.push(`e.category_id = $${idx++}`);  params.push(filters.category_id); }
    if (filters.supplier_id)  { conditions.push(`e.supplier_id = $${idx++}`);  params.push(filters.supplier_id); }
    if (filters.status)       { conditions.push(`e.status = $${idx++}`);        params.push(filters.status); }
    if (filters.settlement_type) { conditions.push(`e.settlement_type = $${idx++}`); params.push(filters.settlement_type); }
    if (filters.payment_method) { conditions.push(`e.payment_method = $${idx++}`); params.push(filters.payment_method); }
    if (filters.startDate)    { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)      { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    if (filters.search) {
      conditions.push(`(e.description ILIKE $${idx} OR e.reference_no ILIKE $${idx} OR ec.name ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.join(" AND ");
    const limit  = Math.min(filters.limit  ?? 50, 200);
    const offset = filters.offset ?? 0;

    const [dataResult, countResult] = await Promise.all([
      dbQuery<ExpenseRow>(
        `SELECT e.*, 
                ec.name AS category_name, 
                ec.gl_account_code AS category_gl_code,
                s.name AS supplier_name, 
                b.name AS branch_name,
                v.voucher_no AS voucher_no,
                rv.voucher_no AS reversal_voucher_no,
                ba.account_name AS bank_account_name
         FROM public.expense e
         LEFT JOIN public.expense_category ec ON ec.id = e.category_id
         LEFT JOIN public.supplier s ON s.id = e.supplier_id
         LEFT JOIN public.branch   b ON b.id = e.branch_id
         LEFT JOIN public.accounting_voucher v ON v.id = e.voucher_id
         LEFT JOIN public.accounting_voucher rv ON rv.id = e.reversal_voucher_id
         LEFT JOIN public.bank_account     ba ON ba.id = e.bank_account_id
         WHERE ${where}
         ORDER BY e.expense_date DESC, e.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
      dbQuery<{ count: string }>(
        `SELECT COUNT(*) FROM public.expense e
         LEFT JOIN public.expense_category ec ON ec.id = e.category_id
         WHERE ${where}`,
        params as any[]
      ),
    ]);

    return {
      expenses: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? "0"),
    };
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  /** Update an expense. Only allowed for DRAFT status (enforced by service). */
  static async update(
    id: string,
    input: ExpenseUpdateInput,
    branchId: string
  ): Promise<ExpenseRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };

    if (input.category_id  !== undefined) addField("category_id",  input.category_id  ?? null);
    if (input.supplier_id  !== undefined) addField("supplier_id",  input.supplier_id  ?? null);
    if (input.expense_date !== undefined) addField("expense_date",  input.expense_date);
    if (input.reference_no !== undefined) addField("reference_no",  input.reference_no ?? null);
    if (input.description  !== undefined) addField("description",   input.description.trim());
    if (input.subtotal     !== undefined) addField("subtotal",       input.subtotal);
    if (input.discount     !== undefined) addField("discount",       input.discount ?? 0);
    if (input.taxable_value !== undefined) addField("taxable_value", input.taxable_value);
    if (input.cgst         !== undefined) addField("cgst",           input.cgst ?? 0);
    if (input.sgst         !== undefined) addField("sgst",           input.sgst ?? 0);
    if (input.igst         !== undefined) addField("igst",           input.igst ?? 0);
    if (input.total        !== undefined) addField("total",          input.total);
    if (input.payment_method !== undefined) addField("payment_method", input.payment_method ?? null);
    if (input.settlement_type !== undefined) addField("settlement_type", input.settlement_type);
    if (input.bank_account_id !== undefined) addField("bank_account_id", input.bank_account_id ?? null);
    if (input.teller_session_id !== undefined) addField("teller_session_id", input.teller_session_id ?? null);
    if (input.company_id   !== undefined) addField("company_id",     input.company_id ?? null);
    if (input.itc_eligibility !== undefined) addField("itc_eligibility", input.itc_eligibility);
    if (input.rcm_applicable !== undefined) addField("rcm_applicable", Boolean(input.rcm_applicable));
    if (input.hsn_sac_code !== undefined) addField("hsn_sac_code", input.hsn_sac_code ?? null);
    if (input.vendor_gstin !== undefined) addField("vendor_gstin", input.vendor_gstin ?? null);
    if (input.notes        !== undefined) addField("notes",          input.notes ?? null);
    if (input.metadata     !== undefined) addField("metadata",       input.metadata ? JSON.stringify(input.metadata) : null);

    if (sets.length === 0) return this.findById(id, branchId);

    sets.push("updated_at = NOW()");
    params.push(id, branchId);

    const sql = `
      UPDATE public.expense SET ${sets.join(", ")}
      WHERE id = $${idx} AND branch_id = $${idx + 1} AND deleted_at IS NULL
      RETURNING *
    `;
    const result = await dbQuery<ExpenseRow>(sql, params as any[]);
    return result.rows[0] ?? null;
  }

  // ── STATUS TRANSITION ──────────────────────────────────────────────────────

  /** Transition expense status with lifecycle enforcement. */
  static async transitionStatus(
    id: string,
    newStatus: ExpenseStatus,
    userId: string,
    branchId?: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const conditions = ["id = $1", "deleted_at IS NULL"];
    const params: unknown[] = [id];
    if (branchId) { conditions.push("branch_id = $2"); params.push(branchId); }

    const existing = await dbQuery<{ id: string; status: ExpenseStatus }>(
      `SELECT id, status FROM public.expense WHERE ${conditions.join(" AND ")}`,
      params as any[]
    );
    if (!existing.rows[0]) {
      return { success: false, error: "Expense not found or access denied." };
    }

    const currentStatus = existing.rows[0].status;
    const allowed = EXPENSE_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(", ") || "none"}.`,
      };
    }

    const sets: string[] = ["status = $2", "updated_at = NOW()"];
    const updateParams: unknown[] = [id, newStatus];
    let pIdx = 3;

    if (newStatus === "APPROVED") {
      sets.push(`approved_by = $${pIdx++}`);
      updateParams.push(userId);
    }
    if (newStatus === "POSTED") {
      sets.push(`posted_at = $${pIdx++}`);
      updateParams.push(new Date().toISOString());
    }
    if (newStatus === "REJECTED") {
      sets.push(`reversal_reason = $${pIdx++}`);
      updateParams.push(reason || "Rejected during review");
    }

    await dbQuery(
      `UPDATE public.expense SET ${sets.join(", ")} WHERE id = $1`,
      updateParams as any[]
    );
    return { success: true };
  }

  // ── SOFT DELETE ────────────────────────────────────────────────────────────

  /** Soft-delete. Blocked for APPROVED/POSTED expenses. */
  static async softDelete(
    id: string,
    branchId: string
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await dbQuery<{ status: ExpenseStatus }>(
      "SELECT status FROM public.expense WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
      [id, branchId]
    );
    if (!existing.rows[0]) return { success: false, error: "Expense not found or access denied." };
    if (["APPROVED", "POSTED"].includes(existing.rows[0].status)) {
      return { success: false, error: `Cannot delete an expense with status '${existing.rows[0].status}'.` };
    }
    await dbQuery(
      "UPDATE public.expense SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1",
      [id]
    );
    return { success: true };
  }

  // ── REPORTS ────────────────────────────────────────────────────────────────

  /** Expense Register — full detail per expense. */
  static async getExpenseRegister(filters: ExpenseReportFilters): Promise<ExpenseRegisterRow[]> {
    const conditions = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.branch_id)   { conditions.push(`e.branch_id = $${idx++}`);   params.push(filters.branch_id); }
    if (filters.category_id) { conditions.push(`e.category_id = $${idx++}`); params.push(filters.category_id); }
    if (filters.supplier_id) { conditions.push(`e.supplier_id = $${idx++}`); params.push(filters.supplier_id); }
    if (filters.status)      { conditions.push(`e.status = $${idx++}`);       params.push(filters.status); }
    if (filters.startDate)   { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)     { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    const sql = `
      SELECT e.id AS expense_id, e.expense_date, e.category_id,
             ec.name AS category_name, s.name AS supplier_name,
             e.reference_no, e.description,
             e.subtotal, e.discount, e.taxable_value, e.cgst, e.sgst, e.igst, e.total,
             e.payment_method, e.status, b.name AS branch_name
      FROM   public.expense          e
      LEFT JOIN public.expense_category ec ON ec.id = e.category_id
      LEFT JOIN public.supplier         s  ON s.id  = e.supplier_id
      LEFT JOIN public.branch           b  ON b.id  = e.branch_id
      WHERE  ${conditions.join(" AND ")}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;
    const result = await dbQuery<ExpenseRegisterRow>(sql, params as any[]);
    return result.rows;
  }

  /** Category-wise expense summary. */
  static async getCategoryWiseSummary(filters: ExpenseReportFilters): Promise<CategoryWiseExpenseRow[]> {
    const conditions = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.branch_id) { conditions.push(`e.branch_id = $${idx++}`);  params.push(filters.branch_id); }
    if (filters.startDate) { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)   { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    if (filters.status)    { conditions.push(`e.status = $${idx++}`);        params.push(filters.status); }
    const sql = `
      SELECT e.category_id, ec.name AS category_name,
             COUNT(*)::int         AS expense_count,
             COALESCE(SUM(e.total), 0)          AS total_amount,
             COALESCE(SUM(e.taxable_value), 0)  AS taxable_value,
             COALESCE(SUM(e.cgst), 0)           AS total_cgst,
             COALESCE(SUM(e.sgst), 0)           AS total_sgst,
             COALESCE(SUM(e.igst), 0)           AS total_igst
      FROM   public.expense e
      LEFT JOIN public.expense_category ec ON ec.id = e.category_id
      WHERE  ${conditions.join(" AND ")}
      GROUP BY e.category_id, ec.name
      ORDER BY total_amount DESC
    `;
    const result = await dbQuery<CategoryWiseExpenseRow>(sql, params as any[]);
    return result.rows;
  }

  /** Branch-wise expense summary (super admin only). */
  static async getBranchWiseSummary(filters: ExpenseReportFilters): Promise<BranchWiseExpenseRow[]> {
    const conditions = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.startDate) { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)   { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    if (filters.status)    { conditions.push(`e.status = $${idx++}`);        params.push(filters.status); }
    const sql = `
      SELECT e.branch_id, b.name AS branch_name,
             COUNT(*)::int         AS expense_count,
             COALESCE(SUM(e.total), 0)         AS total_amount,
             COALESCE(SUM(e.taxable_value), 0) AS taxable_value,
             COALESCE(SUM(e.cgst), 0)          AS total_cgst,
             COALESCE(SUM(e.sgst), 0)          AS total_sgst,
             COALESCE(SUM(e.igst), 0)          AS total_igst
      FROM   public.expense e
      LEFT JOIN public.branch b ON b.id = e.branch_id
      WHERE  ${conditions.join(" AND ")}
      GROUP BY e.branch_id, b.name
      ORDER BY total_amount DESC
    `;
    const result = await dbQuery<BranchWiseExpenseRow>(sql, params as any[]);
    return result.rows;
  }

  /** Date-wise expense summary. */
  static async getDateWiseSummary(filters: ExpenseReportFilters): Promise<DateWiseExpenseRow[]> {
    const conditions = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.branch_id) { conditions.push(`e.branch_id = $${idx++}`);  params.push(filters.branch_id); }
    if (filters.startDate) { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)   { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    if (filters.status)    { conditions.push(`e.status = $${idx++}`);        params.push(filters.status); }
    const sql = `
      SELECT e.expense_date::text,
             COUNT(*)::int           AS expense_count,
             COALESCE(SUM(e.total), 0) AS total_amount
      FROM   public.expense e
      WHERE  ${conditions.join(" AND ")}
      GROUP BY e.expense_date
      ORDER BY e.expense_date DESC
    `;
    const result = await dbQuery<DateWiseExpenseRow>(sql, params as any[]);
    return result.rows;
  }

  /** Payment-method expense summary. */
  static async getPaymentMethodSummary(filters: ExpenseReportFilters): Promise<PaymentMethodExpenseRow[]> {
    const conditions = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.branch_id) { conditions.push(`e.branch_id = $${idx++}`);    params.push(filters.branch_id); }
    if (filters.startDate) { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)   { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    if (filters.status)    { conditions.push(`e.status = $${idx++}`);         params.push(filters.status); }
    const sql = `
      SELECT e.payment_method,
             COUNT(*)::int           AS expense_count,
             COALESCE(SUM(e.total), 0) AS total_amount
      FROM   public.expense e
      WHERE  ${conditions.join(" AND ")}
      GROUP BY e.payment_method
      ORDER BY total_amount DESC
    `;
    const result = await dbQuery<PaymentMethodExpenseRow>(sql, params as any[]);
    return result.rows;
  }

  /** Supplier-wise expense summary (where supplier_id IS NOT NULL). */
  static async getSupplierWiseSummary(filters: ExpenseReportFilters): Promise<SupplierWiseExpenseRow[]> {
    const conditions = ["e.deleted_at IS NULL", "e.supplier_id IS NOT NULL"];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.branch_id) { conditions.push(`e.branch_id = $${idx++}`);    params.push(filters.branch_id); }
    if (filters.startDate) { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)   { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    if (filters.status)    { conditions.push(`e.status = $${idx++}`);         params.push(filters.status); }
    const sql = `
      SELECT e.supplier_id, s.name AS supplier_name,
             COUNT(*)::int           AS expense_count,
             COALESCE(SUM(e.total), 0)         AS total_amount,
             COALESCE(SUM(e.taxable_value), 0) AS taxable_value,
             COALESCE(SUM(e.cgst), 0)          AS total_cgst,
             COALESCE(SUM(e.sgst), 0)          AS total_sgst,
             COALESCE(SUM(e.igst), 0)          AS total_igst
      FROM   public.expense e
      LEFT JOIN public.supplier s ON s.id = e.supplier_id
      WHERE  ${conditions.join(" AND ")}
      GROUP BY e.supplier_id, s.name
      ORDER BY total_amount DESC
    `;
    const result = await dbQuery<SupplierWiseExpenseRow>(sql, params as any[]);
    return result.rows;
  }

  /** GST/Tax summary — where taxable_value > 0. */
  static async getGstSummary(filters: ExpenseReportFilters): Promise<ExpenseGstSummaryRow[]> {
    const conditions = ["e.deleted_at IS NULL", "e.taxable_value > 0"];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.branch_id) { conditions.push(`e.branch_id = $${idx++}`);    params.push(filters.branch_id); }
    if (filters.startDate) { conditions.push(`e.expense_date >= $${idx++}`); params.push(filters.startDate); }
    if (filters.endDate)   { conditions.push(`e.expense_date <= $${idx++}`); params.push(filters.endDate); }
    if (filters.status)    { conditions.push(`e.status = $${idx++}`);         params.push(filters.status); }
    const sql = `
      SELECT ec.name AS category_name,
             COALESCE(SUM(e.taxable_value), 0)      AS taxable_value,
             NULL::NUMERIC                           AS cgst_rate,
             NULL::NUMERIC                           AS sgst_rate,
             NULL::NUMERIC                           AS igst_rate,
             COALESCE(SUM(e.cgst), 0)               AS total_cgst,
             COALESCE(SUM(e.sgst), 0)               AS total_sgst,
             COALESCE(SUM(e.igst), 0)               AS total_igst,
             COALESCE(SUM(e.cgst + e.sgst + e.igst), 0) AS total_tax
      FROM   public.expense e
      LEFT JOIN public.expense_category ec ON ec.id = e.category_id
      WHERE  ${conditions.join(" AND ")}
      GROUP BY ec.name
      ORDER BY total_tax DESC
    `;
    const result = await dbQuery<ExpenseGstSummaryRow>(sql, params as any[]);
    return result.rows;
  }
}
