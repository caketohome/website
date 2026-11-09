const fs = require('fs');
const filePath = 'E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts';
let content = fs.readFileSync(filePath, 'utf8');

const target = `export interface CreateBankAccountParams {
  account_name: string;
  bank_name: string;
  account_number: string;
  account_number_masked?: string;
  ifsc_code: string;
  account_type?: BankAccountType;
  branch_name?: string | null;
  gl_account_id?: string;
  company_id?: string;
  status?: BankAccountStatus;
  metadata?: Record<string, unknown>;
  actorContext?: { id?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
}`;

const replacement = `export interface CreateBankAccountParams {
  account_name: string;
  bank_name: string;
  account_number: string;
  account_number_masked?: string;
  ifsc_code: string;
  account_type?: BankAccountType;
  branch_name?: string | null;
  branch_id?: string | null;
  gl_account_id?: string;
  bank_charges_gl_account_id?: string | null;
  interest_gl_account_id?: string | null;
  offset_gl_account_id?: string | null;
  opening_balance?: number;
  opening_balance_date?: string | null;
  is_primary?: boolean;
  allow_payments?: boolean;
  allow_receipts?: boolean;
  reconciliation_required?: boolean;
  company_id?: string;
  status?: BankAccountStatus;
  metadata?: Record<string, unknown>;
  actorContext?: { id?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
}`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updated = normalizedContent.replace(normalizedTarget, replacement);
  fs.writeFileSync(filePath, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated CreateBankAccountParams!');
} else {
  console.log('Target not found in accounting.types.ts');
}
