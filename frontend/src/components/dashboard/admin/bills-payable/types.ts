export type BillPayableStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export interface BillPayableListItem {
  purchase_id: string;
  invoice_no: string | null;
  invoice_date: string;
  due_date: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_gstin?: string | null;
  branch_id: string;
  branch_name: string;
  total_amount: number;
  paid_amount: number;
  returns_amount: number;
  outstanding_amount: number;
  status: BillPayableStatus;
  payment_method: string;
  voucher_id: string | null;
  voucher_no: string | null;
  is_overdue: boolean;
  days_overdue: number;
}

export interface BillsPayableSummary {
  total_outstanding: number;
  overdue_amount: number;
  due_soon_amount: number;
  unpaid_count: number;
  partially_paid_count: number;
  overdue_count: number;
  paid_count: number;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  gl_account_id?: string;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export interface BranchOption {
  id: string;
  name: string;
}
