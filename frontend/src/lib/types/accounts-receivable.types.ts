/**
 * CakeToHome ERP — Accounts Receivable (AR) Types
 * Phase 4F Step 4.8: Canonical TypeScript DTOs for Trade AR Statement, GL Reconciliation, and Blocked Aging.
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Account 1121 (Accounts Receivable) is the SOLE control account for commercial Trade AR.
 * 2. Account 1122 (Undeposited COD) is a separate collection-control clearing account and is strictly EXCLUDED.
 * 3. AR Aging is FEATURE-BLOCKED pending authoritative business/accounting policy approval.
 */

// ─── Trade AR Statement & Subledger ───────────────────────────────────────────

export interface CustomerStatementFilters {
  customer_id: string;
  branch_id?: string;
  startDate?: string; // YYYY-MM-DD (inclusive)
  endDate?: string;   // YYYY-MM-DD (inclusive)
  actorContext?: any;
}

export interface CustomerStatementLine {
  line_id: string;
  voucher_date: string;     // ISO YYYY-MM-DD from accounting_voucher.voucher_date
  created_at: string;       // ISO timestamp from accounting_journal_entry.created_at
  entry_no: string;         // JE-FY2026-XXXXXX
  voucher_id: string;
  voucher_no: string;       // VCH-SALES-FY2026-XXXXXX
  voucher_type: string;     // SALES, RECEIPT, CREDIT_NOTE, PAYMENT, JOURNAL
  reference_type: string;   // ORDER, ORDER_RETURN, CUSTOMER_REFUND, SALES_REVERSAL
  reference_id: string | null;
  reference_event: string | null;
  description: string;
  branch_id: string;
  branch_name: string;
  debit_amount: number;     // Increases Trade AR
  credit_amount: number;    // Decreases Trade AR
  running_balance: number;  // Debit-normal running balance
  customer_id: string | null;
}

export interface CustomerStatementResult {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    status: "ACTIVE" | "ARCHIVED";
  };
  control_account: {
    code: "1121";
    name: string;
  };
  branch_id?: string;
  startDate?: string;
  endDate?: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  net_movement: number;
  closing_balance: number;
  transactions: CustomerStatementLine[];
}

// ─── Trade AR ↔ GL Reconciliation ────────────────────────────────────────────

export interface ArGlReconciliationFilters {
  as_of_date?: string; // YYYY-MM-DD (inclusive)
  branch_id?: string;
  actorContext?: any;
}

export type ArReconciliationExceptionType =
  | "MISSING_CUSTOMER_DIMENSION"
  | "INVALID_CUSTOMER_REFERENCE"
  | "DUPLICATE_SOURCE_IDENTITY"
  | "BRANCH_MISMATCH"
  | "UNBALANCED_JOURNAL"
  | "ACCOUNT_MISCLASSIFICATION";

export interface ArReconciliationException {
  exception_type: ArReconciliationExceptionType;
  severity: "WARNING" | "CRITICAL";
  voucher_id?: string;
  voucher_no?: string;
  journal_line_id?: string;
  customer_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  description: string;
  amount?: number;
}

export interface CustomerArBalanceRow {
  customer_id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  debit_total: number;
  credit_total: number;
  balance: number; // debit - credit (normal debit balance)
}

export interface ArGlReconciliationResult {
  as_of_date: string;
  branch_id?: string;
  control_account: {
    code: "1121";
    name: string;
    gl_balance: number;
  };
  subledger: {
    identified_customer_total: number;
    guest_unassigned_total: number;
    total_control_amount: number; // identified_customer_total + guest_unassigned_total
    customer_count: number;
  };
  reconciliation: {
    difference: number; // total_control_amount - gl_balance
    is_reconciled: boolean;
  };
  customer_balances: CustomerArBalanceRow[];
  exceptions: ArReconciliationException[];
}

// ─── AR Aging Schedule ─────────────────────────────────────────────────────────

export interface ArAgingFilters {
  as_of_date?: string; // YYYY-MM-DD
  branch_id?: string;
  customer_id?: string;
  actorContext?: any;
}

export type ArAgingBucket = "CURRENT" | "DAYS_1_30" | "DAYS_31_60" | "DAYS_61_90" | "DAYS_90_PLUS";

export interface ArAgingInvoiceItem {
  invoice_id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  branch_id?: string | null;
  branch_name?: string | null;
  invoice_date: string;
  due_date: string;
  days_overdue: number;
  invoice_total: number;
  paid_amount: number;
  returns_amount: number;
  balance_due: number;
  bucket: ArAgingBucket;
}

export interface CustomerArAgingRow {
  customer_id: string;
  customer_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  current_amount: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total_outstanding: number;
  invoice_count: number;
  invoices?: ArAgingInvoiceItem[];
}

export interface ArAgingSummary {
  total_current: number;
  total_1_30: number;
  total_31_60: number;
  total_61_90: number;
  total_90_plus: number;
  grand_total: number;
  customer_count: number;
  invoice_count: number;
}

export interface ArAgingScheduleResult {
  as_of_date: string;
  branch_id?: string;
  summary: ArAgingSummary;
  customers: CustomerArAgingRow[];
  reconciliation?: {
    gl_trade_ar_balance: number;
    subledger_invoiced_balance: number;
    unassigned_journal_adjustments: number;
    net_difference: number;
    is_reconciled: boolean;
  };
}

export interface ArAgingScheduleBlockedResult {
  status: "FEATURE_BLOCKED";
  message: "AR AGING: NOT AVAILABLE — DUE-DATE POLICY NOT APPROVED";
  as_of_date?: string;
  branch_id?: string;
  summary: null;
  customers: [];
}

