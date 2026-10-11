/**
 * CakeToHome ERP — Phase C7.4: Bills Receivable UI Types
 */

export type BillReceivableStatus = "UNPAID" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "OVERDUE";
export type ArAgeingBucket = "CURRENT" | "1_TO_30" | "31_TO_60" | "61_TO_90" | "OVER_90";

export interface BillReceivableListItem {
  invoice_id: string;
  invoice_number: string;
  order_id: string | null;
  customer_id: string;
  customer_name: string;
  customer_company: string | null;
  customer_gstin: string | null;
  customer_phone: string | null;
  branch_id: string;
  branch_name: string | null;
  invoice_date: string;
  due_date: string;
  payment_terms_days: number;
  total_amount: number;
  paid_amount: number;
  returns_amount: number;
  outstanding_amount: number;
  status: BillReceivableStatus;
  ageing_bucket: ArAgeingBucket;
  overdue_days: number;
  voucher_id: string | null;
  voucher_no: string | null;
  created_at: string;
}

export interface BillsReceivableSummary {
  total_receivables: number;
  total_received: number;
  total_outstanding: number;
  overdue_amount: number;
  total_bills_count: number;
  unpaid_count: number;
  partially_received_count: number;
  fully_received_count: number;
  overdue_count: number;
  ageing_breakdown: {
    current: number;
    bucket_1_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_over_90: number;
  };
}

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
}

export interface CorporateCustomerOption {
  id: string;
  company_name: string | null;
  first_name?: string;
  last_name?: string;
  gstin?: string | null;
  credit_limit?: number;
  credit_balance?: number;
  credit_status?: string;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  gl_account_id?: string;
  gl_code?: string;
  gl_name?: string;
}
