const fs = require('fs');
const { execSync } = require('child_process');

const gitExe = 'C:\\Users\\alexc\\.gemini\\mingit\\cmd\\git.exe';

// 1. Get 39d1981:frontend/src/lib/types/accounting.types.ts
const typesBase = execSync(`"${gitExe}" show 39d1981:frontend/src/lib/types/accounting.types.ts`, {
  maxBuffer: 10 * 1024 * 1024
}).toString();

let types = typesBase;

// Add cost_centre_code and cost_centre_name to AccountingJournalLineRow
types = types.replace(
  '  account_type?: AccountType;\n}',
  '  account_type?: AccountType;\n  cost_centre_code?: string;\n  cost_centre_name?: string;\n}'
);

// Replace BankAccountRow
const oldBankAccountRow = `export interface BankAccountRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  bank_name: string;
  account_number_masked: string;
  ifsc_code: string;
  status: BankAccountStatus;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}`;

const newBankAccountRow = `export interface BankAccountRow {
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

if (!types.includes(oldBankAccountRow)) {
  console.error("Could not find oldBankAccountRow in 39d1981 types!");
  process.exit(1);
}
types = types.replace(oldBankAccountRow, newBankAccountRow);

// Replace BankMasterErrorCode
const oldBankMasterErrorCode = `export type BankMasterErrorCode =
  | "BANK_ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_INACTIVE"
  | "BANK_ACCOUNT_FROZEN"
  | "INVALID_IFSC_CODE"
  | "INVALID_MASKED_ACCOUNT"
  | "INVALID_BANK_NAME"
  | "BRANCH_ACCESS_DENIED"
  | "COMPANY_ACCESS_DENIED"
  | "PERMISSION_DENIED"
  | "ARBITRARY_GL_ACCOUNT_FORBIDDEN"
  | "BANK_MASTER_ERROR";`;

const newBankMasterErrorCode = `export type BankMasterErrorCode =
  | "BANK_ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_INACTIVE"
  | "BANK_ACCOUNT_FROZEN"
  | "DUPLICATE_BANK_ACCOUNT"
  | "INVALID_IFSC_CODE"
  | "INVALID_MASKED_ACCOUNT"
  | "INVALID_BANK_NAME"
  | "INVALID_ACCOUNT_NAME"
  | "INVALID_ACCOUNT_NUMBER"
  | "INVALID_ACCOUNT_TYPE"
  | "GL_ACCOUNT_NOT_FOUND"
  | "GL_ACCOUNT_INACTIVE"
  | "GL_ACCOUNT_IS_GROUP"
  | "INVALID_GL_ACCOUNT_TYPE"
  | "GL_ACCOUNT_ALREADY_MAPPED"
  | "BRANCH_OWNERSHIP_FORBIDDEN"
  | "BRANCH_ACCESS_DENIED"
  | "COMPANY_ACCESS_DENIED"
  | "PERMISSION_DENIED"
  | "UNAUTHORIZED"
  | "ARBITRARY_GL_ACCOUNT_FORBIDDEN"
  | "BANK_MASTER_ERROR";`;

if (!types.includes(oldBankMasterErrorCode)) {
  console.error("Could not find oldBankMasterErrorCode in 39d1981 types!");
  process.exit(1);
}
types = types.replace(oldBankMasterErrorCode, newBankMasterErrorCode);

// Replace CreateBankAccountParams
const oldCreateParams = `export interface CreateBankAccountParams {
  bank_name: string;
  account_number_masked: string;
  ifsc_code: string;
  branch_id?: string | null;
  company_id?: string;
  status?: BankAccountStatus;
  metadata?: Record<string, unknown>;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
}`;

const newCreateParams = `export interface CreateBankAccountParams {
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

if (!types.includes(oldCreateParams)) {
  console.error("Could not find oldCreateParams in 39d1981 types!");
  process.exit(1);
}
types = types.replace(oldCreateParams, newCreateParams);

// Replace UpdateBankAccountParams
const oldUpdateParams = `export interface UpdateBankAccountParams {
  id: string;
  bank_name?: string;
  account_number_masked?: string;
  ifsc_code?: string;
  status?: BankAccountStatus;
  metadata?: Record<string, unknown>;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
}`;

const newUpdateParams = `export interface UpdateBankAccountParams {
  id: string;
  account_name?: string;
  bank_name?: string;
  account_number?: string;
  account_number_masked?: string;
  ifsc_code?: string;
  account_type?: BankAccountType;
  branch_name?: string | null;
  gl_account_id?: string;
  status?: BankAccountStatus;
  metadata?: Record<string, unknown>;
  actorContext?: { id?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
}`;

if (!types.includes(oldUpdateParams)) {
  console.error("Could not find oldUpdateParams in 39d1981 types!");
  process.exit(1);
}
types = types.replace(oldUpdateParams, newUpdateParams);

// Replace ListBankAccountsFilter
const oldFilter = `export interface ListBankAccountsFilter {
  branchId?: string | null;
  companyId?: string;
  status?: BankAccountStatus;
  includeEnterprise?: boolean;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
}`;

const newFilter = `export interface ListBankAccountsFilter {
  companyId?: string;
  status?: BankAccountStatus;
  search?: string;
  branchId?: string | null; // Ignored for company accounts, kept for backwards compatibility
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
}`;

if (!types.includes(oldFilter)) {
  console.error("Could not find oldFilter in 39d1981 types!");
  process.exit(1);
}
types = types.replace(oldFilter, newFilter);

fs.writeFileSync('scratch/test_candidate2_accounting_types.ts', types);
console.log("Successfully created scratch/test_candidate2_accounting_types.ts with branch_id?: string | null on BankAccountRow");
