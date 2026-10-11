/**
 * CakeToHome ERP — Phase C: Teller & Cash Custody Domain Types
 * Defines canonical data contracts for Teller, Teller Session, and Cash Custody Ledger.
 */

export type TellerStatus = "ACTIVE" | "INACTIVE";

export type TellerSessionStatus =
  | "OPEN"
  | "CLOSING"
  | "PENDING_VERIFICATION"
  | "SETTLED"
  | "CANCELLED";

export type TellerMovementDirection = "IN" | "OUT";

export type TellerMovementType =
  | "CASH_SALE"
  | "COD_HANDOVER"
  | "CUSTOMER_REFUND"
  | "EXPENSE_PAYMENT"
  | "BANK_DEPOSIT"
  | "ADJUSTMENT"
  | "SAFE_DROP"
  | "SAFE_TO_TILL";

export type TellerSourceType =
  | "ORDER"
  | "RIDER_SHIFT_SETTLEMENT"
  | "REFUND"
  | "EXPENSE"
  | "BANK_DEPOSIT_SLIP"
  | "SAFE_DROP"
  | "SAFE_TO_TILL"
  | "MANUAL";

export type TellerErrorCode =
  | "TELLER_NOT_FOUND"
  | "TELLER_INACTIVE"
  | "TELLER_DUPLICATE_ACTIVE_USER"
  | "TELLER_CODE_COLLISION"
  | "UNAUTHORIZED_BRANCH"
  | "ACTIVE_SESSION_EXISTS"
  | "SESSION_NOT_FOUND"
  | "INVALID_SESSION_STATE"
  | "INVALID_AMOUNT"
  | "DUPLICATE_SOURCE_MOVEMENT"
  | "MISSING_AUTHORITATIVE_SOURCE"
  | "SESSION_NOT_VERIFIED"
  | "SOD_VIOLATION"
  | "SESSION_ALREADY_SETTLED"
  | "SESSION_ALREADY_CANCELLED"
  | "CONCURRENT_STATE_TRANSITION"
  | "PERMISSION_DENIED"
  | "NO_OPEN_SESSION_FOUND"
  | "SETTLEMENT_POSTING_FAILED";

export class TellerDomainError extends Error {
  readonly code: TellerErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: TellerErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "TellerDomainError";
    this.code = code;
    this.details = details;
  }
}

// ── Database Row Models ──────────────────────────────────────────────────────

export interface TellerRow {
  id: string;
  branch_id: string;
  user_id: string;
  name: string;
  code: string;
  status: TellerStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  // Joins
  branch_name?: string;
  branch_code?: string;
  user_email?: string;
}

export interface TellerSessionRow {
  id: string;
  teller_id: string;
  branch_id: string;
  status: TellerSessionStatus;
  opening_float: number;
  expected_cash: number;
  closing_count: number | null;
  variance: number | null;
  opened_by: string;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  settled_by: string | null;
  settled_at: string | null;
  settlement_voucher_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  teller_name?: string;
  teller_code?: string;
  branch_name?: string;
  branch_code?: string;
}

export interface TellerMovementRow {
  id: string;
  teller_session_id: string;
  branch_id: string;
  direction: TellerMovementDirection;
  movement_type: TellerMovementType;
  amount: number;
  source_type: string | null;
  source_id: string | null;
  narration: string | null;
  created_by: string;
  created_at: string;
}

// ── Service Parameters & Return Models ──────────────────────────────────────

export interface CreateTellerParams {
  id?: string;
  branch_id: string;
  user_id: string;
  name: string;
  code: string;
  status?: TellerStatus;
  created_by?: string;
}

export interface UpdateTellerParams {
  name?: string;
  status?: TellerStatus;
  updated_by?: string;
}

export interface OpenSessionParams {
  teller_id?: string;
  branch_id?: string;
  opening_float: number;
  notes?: string | null;
}

export interface CloseSessionParams {
  session_id: string;
  closing_count: number;
  notes?: string | null;
}

export interface VerifySessionParams {
  session_id: string;
  notes?: string | null;
}

export interface PrepareSettlementParams {
  session_id: string;
}

export interface SettlementPreparationResult {
  session_id: string;
  branch_id: string;
  teller_id: string;
  status: TellerSessionStatus;
  opening_float: number;
  total_in: number;
  total_out: number;
  expected_cash: number;
  closing_count: number;
  variance: number;
  voucher_required: boolean;
  settlement_entry: {
    debit_account_code: string | null;
    debit_account_name: string | null;
    credit_account_code: string | null;
    credit_account_name: string | null;
    amount: number;
  } | null;
  sod_audit: {
    opened_by: string;
    closed_by: string | null;
    verified_by: string | null;
    settler_user_id: string;
  };
}

export interface SettleSessionParams {
  session_id?: string;
  sessionId?: string;
  notes?: string | null;
  settlement_date?: string;
  settlementDate?: string;
}

export interface SessionSettlementResult {
  session: TellerSessionRow;
  wasAlreadySettled: boolean;
  settlement_voucher_id: string | null;
  voucher?: any | null;
  journal_entry?: any | null;
}

export interface CreateMovementParams {
  session_id: string;
  branch_id: string;
  direction: TellerMovementDirection;
  movement_type: TellerMovementType;
  amount: number;
  source_type?: string | null;
  source_id?: string | null;
  narration?: string | null;
  created_by?: string;
}

export interface ProjectSystemMovementParams {
  branch_id: string;
  teller_session_id?: string;
  direction: TellerMovementDirection;
  movement_type: TellerMovementType;
  amount: number;
  source_type: string;
  source_id: string;
  narration?: string | null;
  created_by?: string;
}

export interface MovementProjectionResult {
  movement: TellerMovementRow;
  wasDuplicate: boolean;
}

export interface AuthenticatedActor {
  userId: string;
  email?: string;
  role?: string;
  branchId?: string | null;
  permissions?: string[];
}
