/**
 * CakeToHome ERP — Phase C7.5: Branch Cash Control & Vault Custody Domain Types
 */

export type VaultMovementDirection = "IN" | "OUT";

export type VaultMovementType =
  | "SAFE_DROP"
  | "VAULT_INITIAL_FLOAT"
  | "SAFE_TO_TILL"
  | "BANK_DEPOSIT"
  | "MANUAL_ADJUSTMENT";

export type VaultSourceType =
  | "SAFE_DROP"
  | "SAFE_TO_TILL"
  | "BANK_DEPOSIT_SLIP"
  | "INITIAL_FLOAT"
  | "MANUAL_ADJUSTMENT";

export interface BranchVaultMovementRow {
  id: string;
  branch_id: string;
  direction: VaultMovementDirection;
  movement_type: VaultMovementType;
  amount: number;
  source_type: VaultSourceType;
  source_id: string;
  teller_session_id?: string | null;
  teller_movement_id?: string | null;
  performed_by: string;
  witnessed_by?: string | null;
  narration?: string | null;
  created_at: string;
  // Joins / display
  branch_name?: string;
  performed_by_name?: string;
  witnessed_by_name?: string;
}

export type PettyCashRequestType =
  | "INITIAL_FUNDING"
  | "EXPENSE_CLAIM"
  | "REIMBURSEMENT";

export type PettyCashRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "DISBURSED"
  | "CANCELLED";

export interface PettyCashRequestRow {
  id: string;
  request_number: string;
  branch_id: string;
  request_type: PettyCashRequestType;
  amount: number;
  purpose: string;
  status: PettyCashRequestStatus;
  expense_category_id?: string | null;
  tax_rate?: number;
  gst_amount?: number;
  net_expense_amount: number;
  input_gst_account_code?: string | null;
  expense_account_code?: string | null;
  voucher_id?: string | null;
  payment_voucher_id?: string | null;
  maker_id: string;
  made_at: string;
  checker_id?: string | null;
  checked_at?: string | null;
  checker_notes?: string | null;
  disburser_id?: string | null;
  disbursed_at?: string | null;
  disburser_notes?: string | null;
  bank_account_id?: string | null;
  receipt_reference?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joins
  branch_name?: string;
  maker_name?: string;
  checker_name?: string;
  disburser_name?: string;
}

export interface DrawerThresholdStatus {
  branch_id: string;
  branch_name: string;
  max_drawer_cash_limit: number;
  warning_threshold: number;
  critical_threshold: number;
  active_drawer_cash: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
  is_cash_tender_blocked: boolean;
}

export interface BranchCashReconciliationResult {
  branch_id: string;
  branch_name: string;
  gl_cash_1111: number;
  active_drawer_cash: number;
  vault_cash: number;
  total_physical_cash: number;
  variance: number;
  reconciliation_status: "RECONCILED" | "VARIANCE_DETECTED";
  requires_audit: boolean;
}

export interface SafeDropResult {
  safe_drop_id: string;
  branch_id: string;
  teller_session_id: string;
  amount: number;
  teller_movement: {
    id: string;
    direction: "OUT";
    movement_type: "SAFE_DROP";
    amount: number;
  };
  vault_movement: {
    id: string;
    direction: "IN";
    movement_type: "SAFE_DROP";
    amount: number;
  };
  drawer_cash_after: number;
  vault_cash_after: number;
  witness_id: string;
  performed_by: string;
  was_duplicate?: boolean;
}

export interface SafeToTillResult {
  replenishment_id: string;
  branch_id: string;
  teller_session_id: string;
  amount: number;
  teller_movement: {
    id: string;
    direction: "IN";
    movement_type: "SAFE_TO_TILL";
    amount: number;
  };
  vault_movement: {
    id: string;
    direction: "OUT";
    movement_type: "SAFE_TO_TILL";
    amount: number;
  };
  drawer_cash_after: number;
  vault_cash_after: number;
  performed_by: string;
  witness_id?: string | null;
  was_duplicate?: boolean;
}
