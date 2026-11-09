const fs = require('fs');
const filePath = 'E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace BankAccountRow
const target = `export interface BankAccountRow {
  id: string;
  company_id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  account_number_masked: string;
  ifsc_code: string;
  account_type: BankAccountType;
  branch_name?: string | null;
  gl_account_id: string;
  status: BankAccountStatus;
  metadata?: Record<string, unknown> | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  // Optional joined GL account fields
  gl_account_code?: string;
  gl_account_name?: string;
}`;

const replacement = `export interface BankAccountRow {
  id: string;
  company_id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  account_number_masked: string;
  ifsc_code: string;
  account_type: BankAccountType;
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
  last_reconciled_date?: string | null;
  is_primary?: boolean;
  allow_payments?: boolean;
  allow_receipts?: boolean;
  reconciliation_required?: boolean;
  status: BankAccountStatus;
  metadata?: Record<string, unknown> | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Optional joined GL account fields
  gl_account_code?: string;
  gl_account_name?: string;
  branch_code?: string;
}

export interface BankTransactionRow {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  value_date?: string | null;
  transaction_type: string;
  reference_no?: string | null;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  reconciliation_status: string;
  reconciliation_id?: string | null;
  voucher_id?: string | null;
  journal_entry_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string;
  created_at?: string;
}

export interface BankTransferRow {
  id: string;
  source_bank_account_id: string;
  dest_bank_account_id: string;
  transfer_amount: number;
  transfer_date: string;
  reference_no: string;
  description: string;
  status: string;
  voucher_id?: string | null;
  journal_entry_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string;
  created_at?: string;
}

export interface CashAccountRow {
  id: string;
  company_id: string;
  branch_id?: string | null;
  account_name: string;
  account_type: string;
  currency?: string;
  gl_account_id: string;
  opening_balance: number;
  current_balance: number;
  status: string;
  metadata?: Record<string, unknown> | null;
  created_by?: string;
  created_at?: string;
  gl_account_code?: string;
  gl_account_name?: string;
  branch_name?: string;
}

export interface BankReconciliationRow {
  id: string;
  bank_account_id: string;
  statement_date: string;
  statement_closing_balance: number;
  book_closing_balance: number;
  reconciled_amount: number;
  unmatched_deposits: number;
  unmatched_withdrawals: number;
  difference: number;
  status: string;
  completed_at?: string | null;
  completed_by?: string | null;
  notes?: string | null;
  created_by?: string;
  created_at?: string;
}`;

// Normalize line endings to test match
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updated = normalizedContent.replace(normalizedTarget, replacement);
  fs.writeFileSync(filePath, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated accounting.types.ts!');
} else {
  console.log('Target not found in accounting.types.ts');
}
