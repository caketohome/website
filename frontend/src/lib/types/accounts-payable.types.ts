/**
 * CakeToHome ERP — Accounts Payable (AP) Subledger & Aging Types
 * Phase 4F Step 3D.7-B: Canonical TypeScript DTOs for AP Subledger, Aging, and Reconciliation.
 */

// ─── Supplier Statement & AP Subledger ────────────────────────────────────────

export interface SupplierStatementFilters {
  supplier_id: string;
  branch_id?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  actorContext?: any;
}

export interface SupplierStatementLine {
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
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
}

export interface SupplierStatementResult {
  supplier: {
    id: string;
    name: string;
    gstin: string | null;
    state: string | null;
    phone?: string | null;
    email?: string | null;
  };
  branch_id?: string;
  startDate?: string;
  endDate?: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  transactions: SupplierStatementLine[];
}

// ─── AP Aging Schedule ─────────────────────────────────────────────────────────

export interface ApAgingFilters {
  as_of_date?: string; // YYYY-MM-DD, defaults to current date
  branch_id?: string;
  supplier_id?: string;
  actorContext?: any;
}

export interface ApAgingBillItem {
  purchase_id: string;
  invoice_no: string | null;
  invoice_date: string;
  due_date: string;
  days_overdue: number;
  invoice_total: number;
  paid_amount: number;
  returns_amount: number;
  balance_due: number;
  bucket: "CURRENT" | "DAYS_1_30" | "DAYS_31_60" | "DAYS_61_90" | "DAYS_90_PLUS";
}

export interface SupplierApAgingRow {
  supplier_id: string;
  supplier_name: string;
  current_amount: number; // <= 0 days past due
  days_1_30: number;     // 1 to 30 days overdue
  days_31_60: number;    // 31 to 60 days overdue
  days_61_90: number;    // 61 to 90 days overdue
  days_90_plus: number;  // > 90 days overdue
  total_outstanding: number;
  bill_count: number;
  bills?: ApAgingBillItem[];
}

export interface ApAgingScheduleResult {
  as_of_date: string;
  branch_id?: string;
  summary: {
    total_current: number;
    total_1_30: number;
    total_31_60: number;
    total_61_90: number;
    total_90_plus: number;
    grand_total: number;
    supplier_count: number;
    bill_count: number;
  };
  suppliers: SupplierApAgingRow[];
}

// ─── AP ↔ GL Reconciliation ───────────────────────────────────────────────────

export interface ApGlReconciliationFilters {
  as_of_date?: string;
  branch_id?: string;
  actorContext?: any;
}

export interface SupplierApGlVariance {
  supplier_id: string;
  supplier_name: string;
  operational_balance: number;
  gl_2111_balance: number;
  variance: number;
  is_reconciled: boolean;
}

export interface ApGlReconciliationResult {
  as_of_date: string;
  branch_id?: string;
  operational_ap_total: number;
  gl_2111_balance: number;
  discrepancy: number;
  is_reconciled: boolean;
  supplier_count: number;
  supplier_variances: SupplierApGlVariance[];
}
