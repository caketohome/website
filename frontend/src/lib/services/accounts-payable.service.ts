/**
 * CakeToHome ERP — Accounts Payable (AP) Service
 * Phase 4F Step 3D.7-B: AP Subledger, Aging Schedule & Report Reconciliation.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Control Account 2111 (Accounts Payable) has a normal CREDIT balance.
 *    - Invoices & payment reversals: CREDIT (increases AP liability)
 *    - Payments, returns, & invoice reversals: DEBIT (decreases AP liability)
 * 2. Running balance on Supplier Statement:
 *    - Balance_i = Balance_{i-1} + Credit_i - Debit_i
 * 3. Aging Schedule:
 *    - Bill-wise balance = p.total - payments (deleted_at IS NULL) - debit notes (PURCHASE_RETURN)
 *    - Voided invoices (is_reversed = true) have balance_due = 0.00
 *    - Buckets: CURRENT (<= 0 days), DAYS_1_30, DAYS_31_60, DAYS_61_90, DAYS_90_PLUS
 * 4. AP ↔ GL Mathematical Identity:
 *    - sum(Bill-Wise Balances) === Net Credit Balance of Account 2111
 *    - Discrepancy === 0.00
 */

import { dbQuery } from "../db";
import type { PoolClient, QueryResultRow } from "pg";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  SupplierStatementFilters,
  SupplierStatementResult,
  SupplierStatementLine,
  ApAgingFilters,
  ApAgingScheduleResult,
  SupplierApAgingRow,
  ApAgingBillItem,
  ApGlReconciliationFilters,
  ApGlReconciliationResult,
  SupplierApGlVariance,
} from "../types/accounts-payable.types";

export class AccountsPayableService {
  /**
   * Retrieves the authoritative chronological Statement of Account (Subledger for Account 2111)
   * for a specific supplier, with exact opening balance and running balance.
   */
  static async getSupplierStatement(
    filters: SupplierStatementFilters,
    client?: PoolClient
  ): Promise<SupplierStatementResult> {
    // 0. Server-side RBAC & branch isolation validation
    if (filters.actorContext) {
      if (!hasEffectivePermission(filters.actorContext, "ACCOUNTING.VIEW")) {
        throw new Error("PERMISSION_DENIED: User lacks ACCOUNTING.VIEW permission.");
      }
      const actorBranch = filters.actorContext.branch_id || filters.actorContext.branchId;
      const isSuperAdmin = filters.actorContext.role === "SUPER_ADMIN";
      if (actorBranch && !isSuperAdmin) {
        if (filters.branch_id && filters.branch_id !== actorBranch) {
          throw new Error("BRANCH_ACCESS_DENIED: Cross-branch access denied.");
        }
        filters.branch_id = actorBranch;
      }
    }

    const queryFn = async <T extends QueryResultRow = any>(sql: string, params: any[]): Promise<{ rows: T[] }> => {
      return client ? client.query<T>(sql, params) : dbQuery<T>(sql, params);
    };

    // 1. Fetch Supplier details
    const supRes = await queryFn<{
      id: string;
      name: string;
      gstin: string | null;
      state: string | null;
      phone: string | null;
      email: string | null;
    }>(
      `SELECT id, name, gstin, state, phone, email
       FROM public.supplier
       WHERE id = $1 AND deleted_at IS NULL`,
      [filters.supplier_id]
    );

    const supplier = supRes.rows[0];
    if (!supplier) {
      throw new Error(`Supplier '${filters.supplier_id}' not found or deleted.`);
    }

    // 2. Resolve Account 2111
    const accRes = await queryFn<{ id: string }>(
      `SELECT id FROM public.accounting_account WHERE code = '2111' AND deleted_at IS NULL`,
      []
    );
    const apAccountId = accRes.rows[0]?.id;
    if (!apAccountId) {
      throw new Error("Accounts Payable control account '2111' is not configured.");
    }

    // 3. Compute Opening Balance (prior to startDate)
    let openingBalance = 0;
    if (filters.startDate) {
      const opConditions = [
        "jl.account_id = $1",
        "jl.supplier_id = $2",
        "je.entry_date < $3",
      ];
      const opParams: any[] = [apAccountId, filters.supplier_id, filters.startDate];
      let opIdx = 4;

      if (filters.branch_id) {
        opConditions.push(`jl.branch_id = $${opIdx++}`);
        opParams.push(filters.branch_id);
      }

      const opSql = `
        SELECT
          COALESCE(SUM(jl.credit_amount), 0) - COALESCE(SUM(jl.debit_amount), 0) AS opening_balance
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        WHERE ${opConditions.join(" AND ")}
      `;
      const opRes = await queryFn<{ opening_balance: string | number }>(opSql, opParams);
      openingBalance = Number(opRes.rows[0]?.opening_balance ?? 0);
    }

    // 4. Query Transactions in Period
    const txConditions = ["jl.account_id = $1", "jl.supplier_id = $2"];
    const txParams: any[] = [apAccountId, filters.supplier_id];
    let txIdx = 3;

    if (filters.startDate) {
      txConditions.push(`je.entry_date >= $${txIdx++}`);
      txParams.push(filters.startDate);
    }
    if (filters.endDate) {
      txConditions.push(`je.entry_date <= $${txIdx++}`);
      txParams.push(filters.endDate);
    }
    if (filters.branch_id) {
      txConditions.push(`jl.branch_id = $${txIdx++}`);
      txParams.push(filters.branch_id);
    }

    const txSql = `
      SELECT
        jl.id AS line_id,
        je.entry_date::TEXT,
        je.entry_no,
        v.id AS voucher_id,
        v.voucher_no,
        v.voucher_type,
        v.reference_type,
        v.reference_id,
        v.reference_event,
        COALESCE(jl.narration, v.narration) AS narration,
        jl.debit_amount,
        jl.credit_amount
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE ${txConditions.join(" AND ")}
      ORDER BY je.entry_date ASC, je.created_at ASC, jl.line_no ASC
    `;

    const txRes = await queryFn<{
      line_id: string;
      entry_date: string;
      entry_no: string;
      voucher_id: string;
      voucher_no: string;
      voucher_type: string;
      reference_type: string;
      reference_id: string | null;
      reference_event: string | null;
      narration: string | null;
      debit_amount: string | number;
      credit_amount: string | number;
    }>(txSql, txParams);

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactions: SupplierStatementLine[] = txRes.rows.map((row) => {
      const debit = Number(row.debit_amount);
      const credit = Number(row.credit_amount);

      totalDebit += debit;
      totalCredit += credit;
      runningBalance = runningBalance + credit - debit;

      return {
        line_id: row.line_id,
        entry_date: row.entry_date,
        entry_no: row.entry_no,
        voucher_id: row.voucher_id,
        voucher_no: row.voucher_no,
        voucher_type: row.voucher_type,
        reference_type: row.reference_type,
        reference_id: row.reference_id,
        reference_event: row.reference_event,
        narration: row.narration,
        debit_amount: Math.round(debit * 100) / 100,
        credit_amount: Math.round(credit * 100) / 100,
        running_balance: Math.round(runningBalance * 100) / 100,
      };
    });

    return {
      supplier,
      branch_id: filters.branch_id,
      startDate: filters.startDate,
      endDate: filters.endDate,
      opening_balance: Math.round(openingBalance * 100) / 100,
      total_debit: Math.round(totalDebit * 100) / 100,
      total_credit: Math.round(totalCredit * 100) / 100,
      closing_balance: Math.round(runningBalance * 100) / 100,
      transactions,
    };
  }

  /**
   * Generates the AP Aging Schedule allocating outstanding purchase liabilities
   * into standard aging buckets (CURRENT, 1-30, 31-60, 61-90, 90+ days overdue).
   */
  static async getApAgingSchedule(
    filters: ApAgingFilters = {},
    client?: PoolClient
  ): Promise<ApAgingScheduleResult> {
    // 0. Server-side RBAC & branch isolation validation
    if (filters.actorContext) {
      if (!hasEffectivePermission(filters.actorContext, "ACCOUNTING.VIEW")) {
        throw new Error("PERMISSION_DENIED: User lacks ACCOUNTING.VIEW permission.");
      }
      const actorBranch = filters.actorContext.branch_id || filters.actorContext.branchId;
      const isSuperAdmin = filters.actorContext.role === "SUPER_ADMIN";
      if (actorBranch && !isSuperAdmin) {
        if (filters.branch_id && filters.branch_id !== actorBranch) {
          throw new Error("BRANCH_ACCESS_DENIED: Cross-branch access denied.");
        }
        filters.branch_id = actorBranch;
      }
    }

    const queryFn = async <T extends QueryResultRow = any>(sql: string, params: any[]): Promise<{ rows: T[] }> => {
      return client ? client.query<T>(sql, params) : dbQuery<T>(sql, params);
    };

    const asOfDate = filters.as_of_date || new Date().toISOString().slice(0, 10);

    const conditions = [
      "p.deleted_at IS NULL",
      "p.status = 'POSTED'",
      "p.invoice_date <= $1",
    ];
    const params: any[] = [asOfDate];
    let idx = 2;

    if (filters.supplier_id) {
      conditions.push(`p.supplier_id = $${idx++}`);
      params.push(filters.supplier_id);
    }
    if (filters.branch_id) {
      conditions.push(`p.branch_id = $${idx++}`);
      params.push(filters.branch_id);
    }

    const sql = `
      SELECT
        p.id AS purchase_id,
        p.invoice_no,
        p.invoice_date::TEXT,
        COALESCE(p.due_date, p.invoice_date)::TEXT AS due_date,
        p.supplier_id,
        s.name AS supplier_name,
        p.branch_id,
        b.name AS branch_name,
        p.total AS invoice_total,
        COALESCE(rev.is_reversed_as_of, false) AS is_reversed,
        COALESCE(pp.total_paid, 0) AS paid_amount,
        COALESCE(dn.total_returns, 0) AS returns_amount
      FROM public.purchase p
      JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
      LEFT JOIN public.branch b ON b.id = p.branch_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pp_inner.amount), 0) AS total_paid
        FROM public.purchase_payment pp_inner
        WHERE pp_inner.purchase_id = p.id
          AND pp_inner.payment_date <= $1
          AND NOT EXISTS (
            SELECT 1 FROM public.accounting_voucher v_rev
            WHERE v_rev.reference_type = 'PURCHASE_PAYMENT_REVERSAL'
              AND v_rev.reference_id = pp_inner.id
              AND v_rev.status = 'POSTED'
              AND v_rev.deleted_at IS NULL
              AND v_rev.voucher_date <= $1
          )
          AND (
            pp_inner.deleted_at IS NULL
            OR EXISTS (
              SELECT 1 FROM public.accounting_voucher v_rev_any
              WHERE v_rev_any.reference_type = 'PURCHASE_PAYMENT_REVERSAL'
                AND v_rev_any.reference_id = pp_inner.id
                AND v_rev_any.status = 'POSTED'
                AND v_rev_any.deleted_at IS NULL
            )
          )
      ) pp ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(total_amount), 0) AS total_returns
        FROM public.accounting_voucher
        WHERE reference_type = 'PURCHASE_RETURN'
          AND metadata->>'purchase_id' = p.id
          AND status = 'POSTED'
          AND deleted_at IS NULL
          AND voucher_date <= $1
      ) dn ON TRUE
      LEFT JOIN LATERAL (
        SELECT (
          COALESCE((p.metadata->>'is_reversed')::boolean, false) = true
          AND EXISTS (
            SELECT 1 FROM public.accounting_voucher v_inv_rev
            WHERE v_inv_rev.reference_type = 'PURCHASE_REVERSAL'
              AND v_inv_rev.reference_id = p.id
              AND v_inv_rev.status = 'POSTED'
              AND v_inv_rev.deleted_at IS NULL
              AND v_inv_rev.voucher_date <= $1
          )
        ) AS is_reversed_as_of
      ) rev ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.supplier_id ASC, p.invoice_date ASC, p.id ASC
    `;

    const res = await queryFn<{
      purchase_id: string;
      invoice_no: string | null;
      invoice_date: string;
      due_date: string;
      supplier_id: string;
      supplier_name: string;
      branch_id: string;
      branch_name: string | null;
      invoice_total: string | number;
      is_reversed: boolean;
      paid_amount: string | number;
      returns_amount: string | number;
    }>(sql, params);

    const asOfTime = new Date(asOfDate).getTime();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const supplierMap = new Map<string, SupplierApAgingRow>();

    let grandCurrent = 0;
    let grand1_30 = 0;
    let grand31_60 = 0;
    let grand61_90 = 0;
    let grand90Plus = 0;
    let grandTotal = 0;
    let totalBillCount = 0;

    for (const row of res.rows) {
      if (row.is_reversed) {
        continue; // Fully voided purchases as of asOfDate carry 0 AP liability
      }

      const invoiceTotal = Number(row.invoice_total);
      const paidAmount = Number(row.paid_amount);
      const returnsAmount = Number(row.returns_amount);
      const balanceDue = Math.max(0, Math.round((invoiceTotal - paidAmount - returnsAmount) * 100) / 100);

      if (balanceDue <= 0) {
        continue; // Fully settled purchases carry 0 AP liability
      }

      const dueTime = new Date(row.due_date).getTime();
      const daysOverdue = Math.floor((asOfTime - dueTime) / MS_PER_DAY);

      let bucket: "CURRENT" | "DAYS_1_30" | "DAYS_31_60" | "DAYS_61_90" | "DAYS_90_PLUS";
      if (daysOverdue <= 0) {
        bucket = "CURRENT";
      } else if (daysOverdue <= 30) {
        bucket = "DAYS_1_30";
      } else if (daysOverdue <= 60) {
        bucket = "DAYS_31_60";
      } else if (daysOverdue <= 90) {
        bucket = "DAYS_61_90";
      } else {
        bucket = "DAYS_90_PLUS";
      }

      const billItem: ApAgingBillItem = {
        purchase_id: row.purchase_id,
        invoice_no: row.invoice_no,
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        days_overdue: daysOverdue,
        invoice_total: invoiceTotal,
        paid_amount: paidAmount,
        returns_amount: returnsAmount,
        balance_due: balanceDue,
        bucket,
      };

      if (!supplierMap.has(row.supplier_id)) {
        supplierMap.set(row.supplier_id, {
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name,
          current_amount: 0,
          days_1_30: 0,
          days_31_60: 0,
          days_61_90: 0,
          days_90_plus: 0,
          total_outstanding: 0,
          bill_count: 0,
          bills: [],
        });
      }

      const supRow = supplierMap.get(row.supplier_id)!;
      supRow.bill_count += 1;
      supRow.total_outstanding = Math.round((supRow.total_outstanding + balanceDue) * 100) / 100;
      supRow.bills?.push(billItem);

      if (bucket === "CURRENT") {
        supRow.current_amount = Math.round((supRow.current_amount + balanceDue) * 100) / 100;
        grandCurrent += balanceDue;
      } else if (bucket === "DAYS_1_30") {
        supRow.days_1_30 = Math.round((supRow.days_1_30 + balanceDue) * 100) / 100;
        grand1_30 += balanceDue;
      } else if (bucket === "DAYS_31_60") {
        supRow.days_31_60 = Math.round((supRow.days_31_60 + balanceDue) * 100) / 100;
        grand31_60 += balanceDue;
      } else if (bucket === "DAYS_61_90") {
        supRow.days_61_90 = Math.round((supRow.days_61_90 + balanceDue) * 100) / 100;
        grand61_90 += balanceDue;
      } else {
        supRow.days_90_plus = Math.round((supRow.days_90_plus + balanceDue) * 100) / 100;
        grand90Plus += balanceDue;
      }

      grandTotal += balanceDue;
      totalBillCount += 1;
    }

    return {
      as_of_date: asOfDate,
      branch_id: filters.branch_id,
      summary: {
        total_current: Math.round(grandCurrent * 100) / 100,
        total_1_30: Math.round(grand1_30 * 100) / 100,
        total_31_60: Math.round(grand31_60 * 100) / 100,
        total_61_90: Math.round(grand61_90 * 100) / 100,
        total_90_plus: Math.round(grand90Plus * 100) / 100,
        grand_total: Math.round(grandTotal * 100) / 100,
        supplier_count: supplierMap.size,
        bill_count: totalBillCount,
      },
      suppliers: Array.from(supplierMap.values()),
    };
  }

  /**
   * Reconciles operational accounts payable against General Ledger Control Account 2111,
   * verifying mathematical identity across all suppliers.
   */
  static async getApGlReconciliation(
    filters: ApGlReconciliationFilters = {},
    client?: PoolClient
  ): Promise<ApGlReconciliationResult> {
    // 0. Server-side RBAC & branch isolation validation
    if (filters.actorContext) {
      if (!hasEffectivePermission(filters.actorContext, "ACCOUNTING.VIEW")) {
        throw new Error("PERMISSION_DENIED: User lacks ACCOUNTING.VIEW permission.");
      }
      const actorBranch = filters.actorContext.branch_id || filters.actorContext.branchId;
      const isSuperAdmin = filters.actorContext.role === "SUPER_ADMIN";
      if (actorBranch && !isSuperAdmin) {
        if (filters.branch_id && filters.branch_id !== actorBranch) {
          throw new Error("BRANCH_ACCESS_DENIED: Cross-branch access denied.");
        }
        filters.branch_id = actorBranch;
      }
    }

    const queryFn = async <T extends QueryResultRow = any>(sql: string, params: any[]): Promise<{ rows: T[] }> => {
      return client ? client.query<T>(sql, params) : dbQuery<T>(sql, params);
    };

    const asOfDate = filters.as_of_date || new Date().toISOString().slice(0, 10);

    // 1. Resolve Account 2111
    const accRes = await queryFn<{ id: string }>(
      `SELECT id FROM public.accounting_account WHERE code = '2111' AND deleted_at IS NULL`,
      []
    );
    const apAccountId = accRes.rows[0]?.id;
    if (!apAccountId) {
      throw new Error("Accounts Payable control account '2111' is not configured.");
    }

    // 2. Query Operational Balances per Supplier
    const opConditions = [
      "p.deleted_at IS NULL",
      "p.status = 'POSTED'",
      "p.invoice_date <= $1",
    ];
    const opParams: any[] = [asOfDate];
    let opIdx = 2;
    if (filters.branch_id) {
      opConditions.push(`p.branch_id = $${opIdx++}`);
      opParams.push(filters.branch_id);
    }

    const opSql = `
      SELECT
        p.supplier_id,
        s.name AS supplier_name,
        SUM(
          CASE
            WHEN rev.is_reversed_as_of = true THEN 0.00
            ELSE GREATEST(0, p.total - COALESCE(pp.total_paid, 0) - COALESCE(dn.total_returns, 0))
          END
        ) AS operational_balance
      FROM public.purchase p
      JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pp_inner.amount), 0) AS total_paid
        FROM public.purchase_payment pp_inner
        WHERE pp_inner.purchase_id = p.id
          AND pp_inner.payment_date <= $1
          AND NOT EXISTS (
            SELECT 1 FROM public.accounting_voucher v_rev
            WHERE v_rev.reference_type = 'PURCHASE_PAYMENT_REVERSAL'
              AND v_rev.reference_id = pp_inner.id
              AND v_rev.status = 'POSTED'
              AND v_rev.deleted_at IS NULL
              AND v_rev.voucher_date <= $1
          )
          AND (
            pp_inner.deleted_at IS NULL
            OR EXISTS (
              SELECT 1 FROM public.accounting_voucher v_rev_any
              WHERE v_rev_any.reference_type = 'PURCHASE_PAYMENT_REVERSAL'
                AND v_rev_any.reference_id = pp_inner.id
                AND v_rev_any.status = 'POSTED'
                AND v_rev_any.deleted_at IS NULL
            )
          )
      ) pp ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(total_amount), 0) AS total_returns
        FROM public.accounting_voucher
        WHERE reference_type = 'PURCHASE_RETURN'
          AND metadata->>'purchase_id' = p.id
          AND status = 'POSTED'
          AND deleted_at IS NULL
          AND voucher_date <= $1
      ) dn ON TRUE
      LEFT JOIN LATERAL (
        SELECT (
          COALESCE((p.metadata->>'is_reversed')::boolean, false) = true
          AND EXISTS (
            SELECT 1 FROM public.accounting_voucher v_inv_rev
            WHERE v_inv_rev.reference_type = 'PURCHASE_REVERSAL'
              AND v_inv_rev.reference_id = p.id
              AND v_inv_rev.status = 'POSTED'
              AND v_inv_rev.deleted_at IS NULL
              AND v_inv_rev.voucher_date <= $1
          )
        ) AS is_reversed_as_of
      ) rev ON TRUE
      WHERE ${opConditions.join(" AND ")}
      GROUP BY p.supplier_id, s.name
    `;

    const opRes = await queryFn<{
      supplier_id: string;
      supplier_name: string;
      operational_balance: string | number;
    }>(opSql, opParams);

    // 3. Query General Ledger 2111 Balances per Supplier
    const glConditions = [
      "jl.account_id = $1",
      "je.entry_date <= $2",
    ];
    const glParams: any[] = [apAccountId, asOfDate];
    let glIdx = 3;
    if (filters.branch_id) {
      glConditions.push(`jl.branch_id = $${glIdx++}`);
      glParams.push(filters.branch_id);
    }

    const glSql = `
      SELECT
        jl.supplier_id,
        COALESCE(s.name, 'Unknown Supplier') AS supplier_name,
        COALESCE(SUM(jl.credit_amount), 0) - COALESCE(SUM(jl.debit_amount), 0) AS gl_balance
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      LEFT JOIN public.supplier s ON s.id = jl.supplier_id
      WHERE ${glConditions.join(" AND ")}
      GROUP BY jl.supplier_id, s.name
    `;

    const glRes = await queryFn<{
      supplier_id: string | null;
      supplier_name: string;
      gl_balance: string | number;
    }>(glSql, glParams);

    // 4. Combine and compute variances
    const map = new Map<string, SupplierApGlVariance>();

    for (const op of opRes.rows) {
      const opBal = Math.round(Number(op.operational_balance) * 100) / 100;
      map.set(op.supplier_id, {
        supplier_id: op.supplier_id,
        supplier_name: op.supplier_name,
        operational_balance: opBal,
        gl_2111_balance: 0,
        variance: opBal,
        is_reconciled: opBal === 0,
      });
    }

    for (const gl of glRes.rows) {
      const supId = gl.supplier_id || "unassigned";
      const glBal = Math.round(Number(gl.gl_balance) * 100) / 100;

      if (!map.has(supId)) {
        map.set(supId, {
          supplier_id: supId,
          supplier_name: gl.supplier_name,
          operational_balance: 0,
          gl_2111_balance: glBal,
          variance: Math.round((0 - glBal) * 100) / 100,
          is_reconciled: glBal === 0,
        });
      } else {
        const item = map.get(supId)!;
        item.gl_2111_balance = glBal;
        item.variance = Math.round((item.operational_balance - glBal) * 100) / 100;
        item.is_reconciled = item.variance === 0;
      }
    }

    const supplierVariances = Array.from(map.values());
    const operationalTotal = supplierVariances.reduce((acc, v) => acc + v.operational_balance, 0);
    const glTotal = supplierVariances.reduce((acc, v) => acc + v.gl_2111_balance, 0);
    const discrepancy = Math.round((operationalTotal - glTotal) * 100) / 100;
    const allReconciled = discrepancy === 0 && supplierVariances.every((v) => v.is_reconciled);

    return {
      as_of_date: asOfDate,
      branch_id: filters.branch_id,
      operational_ap_total: Math.round(operationalTotal * 100) / 100,
      gl_2111_balance: Math.round(glTotal * 100) / 100,
      discrepancy,
      is_reconciled: allReconciled,
      supplier_count: supplierVariances.length,
      supplier_variances: supplierVariances,
    };
  }
}
