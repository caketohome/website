/**
 * CakeToHome ERP — Phase C6.4: Manual Journal UI Types
 */

import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  ManualJournalLineItem,
  ManualJournalDetailResult,
  VoucherStatus,
} from "@frontend/lib/types/accounting.types";

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  is_group: boolean;
}

export interface CustomerOption {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface SupplierOption {
  id: string;
  name: string;
  code?: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
}

export interface JournalFormLine {
  id: string; // temporary client key
  line_no: number;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit_amount: string; // string for input control
  credit_amount: string;
  customer_id: string;
  supplier_id: string;
  narration: string;
}

export interface ManualJournalListItem extends AccountingVoucherRow {
  branch_name?: string;
  entry_no?: string;
  line_count?: number;
}
