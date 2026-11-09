const fs = require('fs');
const { execSync } = require('child_process');

const gitExe = 'C:\\Users\\alexc\\.gemini\\mingit\\cmd\\git.exe';
const base = execSync(`"${gitExe}" show ac4762e:frontend/src/lib/types/accounting.types.ts`, {
  maxBuffer: 10 * 1024 * 1024
}).toString();

let updated = base;

// 1. Add cost_centre_id to AccountingVoucherRow
updated = updated.replace(
  '  reversal_of_voucher_id: string | null;\n  metadata: Record<string, unknown> | null;',
  '  reversal_of_voucher_id: string | null;\n  cost_centre_id?: string | null;\n  metadata: Record<string, unknown> | null;'
);

// 2. Add cost_centre_id to AccountingJournalLineRow
updated = updated.replace(
  '  supplier_id: string | null;\n  tax_rate: number | null;',
  '  supplier_id: string | null;\n  cost_centre_id?: string | null;\n  tax_rate: number | null;'
);

// 3. Add cost_centre_id to JournalLineInput
updated = updated.replace(
  '  supplier_id?: string | null;\n  tax_rate?: number | null;',
  '  supplier_id?: string | null;\n  cost_centre_id?: string | null;\n  tax_rate?: number | null;'
);

// 4. Add cost_centre_id to VoucherCreateInput
updated = updated.replace(
  '  reversal_of_voucher_id?: string | null;\n  metadata?: Record<string, unknown> | null;',
  '  reversal_of_voucher_id?: string | null;\n  cost_centre_id?: string | null;\n  metadata?: Record<string, unknown> | null;'
);

const typesToAdd = `
// ─── Cost Centre Governance Policy Types (Phase C7.6 Step 3) ───────────────────

export type CostCentrePolicy = "REQUIRED" | "OPTIONAL" | "PROHIBITED";

export type AccountGovernanceErrorCode =
  | "COST_CENTRE_PROHIBITED"
  | "COST_CENTRE_REQUIRED"
  | "COST_CENTRE_INVALID"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_GROUP_NON_POSTABLE";

export class AccountGovernanceError extends Error {
  readonly code: AccountGovernanceErrorCode;
  readonly accountCode?: string;
  readonly accountName?: string;

  constructor(
    code: AccountGovernanceErrorCode,
    message: string,
    details?: { accountCode?: string; accountName?: string }
  ) {
    super(message);
    this.name = "AccountGovernanceError";
    this.code = code;
    this.accountCode = details?.accountCode;
    this.accountName = details?.accountName;
  }
}

// ─── Phase C6: Manual Journal / Journal Voucher (JV) Types ───────────────────

export interface ManualJournalLineItem {
  line_no: number;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  branch_id?: string;
  customer_id?: string | null;
  supplier_id?: string | null;
  cost_centre_id?: string | null;
  narration?: string | null;
  tax_rate?: number | null;
  tax_class?: string | null;
  // Enriched presentation fields
  account_code?: string;
  account_name?: string;
  account_type?: AccountType;
  account_subtype?: AccountSubtype;
  cost_centre_code?: string;
  cost_centre_name?: string;
  customer_name?: string;
  supplier_name?: string;
}

export interface ManualJournalMetadata {
  is_manual_journal: true;
  lines: ManualJournalLineItem[];
  total_amount: number;
  idempotency_key?: string;
  reversal_reason?: string;
  source_device?: string;
  reversal_voucher_no?: string;
  [key: string]: unknown;
}

export interface ManualJournalDraftInput {
  voucher_date: string;
  branch_id: string;
  narration: string;
  lines: ManualJournalLineItem[];
  created_by: string;
  fiscal_year?: string;
  idempotency_key?: string;
  cost_centre_id?: string | null;
}

export interface ManualJournalUpdateDraftInput {
  voucher_id: string;
  voucher_date?: string;
  narration?: string;
  lines?: ManualJournalLineItem[];
  updated_by: string;
  branch_id?: string;
  cost_centre_id?: string | null;
}

export interface ManualJournalDetailResult {
  voucher: AccountingVoucherRow;
  proposed_lines: ManualJournalLineItem[];
  journal_entry: AccountingJournalEntryRow | null;
  posted_lines: AccountingJournalLineRow[];
  is_manual: boolean;
  reversal_voucher?: AccountingVoucherRow | null;
}

export interface ManualJournalListFilters {
  branch_id?: string;
  status?: VoucherStatus | "ALL";
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ManualJournalListResult {
  journals: (AccountingVoucherRow & {
    branch_name?: string;
    entry_no?: string;
    line_count?: number;
  })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
`;

updated = updated.trimEnd() + '\n' + typesToAdd;

fs.writeFileSync('scratch/clean_remediated_accounting_types.ts', updated);
console.log('Generated scratch/clean_remediated_accounting_types.ts successfully.');
