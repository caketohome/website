/**
 * CakeToHome ERP — Corporate Account Master & Employee Roster Types
 * Phase C7.9b: Corporate Account, Contacts, Members, Employees, Audit Events, and Import Batches
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. 1:1 Corporate Account to Customer linkage with full UNIQUE on customer_id.
 * 2. Strict Employee Identity: UNIQUE (account_id, employee_code_key) across all statuses.
 * 3. Immutable audit logs for accounts and employees.
 * 4. Account-scoped roster delegation for ROSTER_MANAGER and ROSTER_VIEWER.
 * 5. Credit request metadata only (authoritative credit activation remains in BillsReceivableService).
 */

export type CorporateAccountStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "CLOSED";

export type CorporateContactType = "PRIMARY" | "SECONDARY" | "ACCOUNTS_PAYABLE" | "BILLING";

export type CorporateMemberRole = "ROSTER_MANAGER" | "ROSTER_VIEWER";

export type CorporateMemberStatus = "ACTIVE" | "REVOKED";

export type CorporateEmployeeStatus = "ACTIVE" | "INACTIVE";

export type CorporateCoordinateSource = "USER_SUPPLIED" | "GEOCODED" | "ADMIN_VERIFIED";

export type CorporateAccountEventType =
  | "CREATED"
  | "UPDATED"
  | "SUBMITTED"
  | "APPROVED"
  | "SUSPENDED"
  | "REACTIVATED"
  | "CLOSED"
  | "CUSTOMER_LINKED"
  | "CREDIT_REQUESTED"
  | "CREDIT_ACTIVATED"
  | "MEMBER_GRANTED"
  | "MEMBER_REVOKED";

export type CorporateEmployeeEventType =
  | "CREATED"
  | "UPDATED"
  | "DEACTIVATED"
  | "REACTIVATED"
  | "IMPORTED"
  | "COORDINATES_VERIFIED";

export type CorporateEmployeeImportBatchStatus =
  | "DRY_RUN_OK"
  | "DRY_RUN_FAILED"
  | "COMMITTED"
  | "FAILED";

// ─── Database Row Interfaces ──────────────────────────────────────────────────

export interface CorporateAccountRow {
  id: string;
  customer_id: string;
  legal_name: string;
  trade_name: string | null;
  legal_name_key: string;
  gstin: string | null;
  pan: string | null;
  billing_address: Record<string, unknown>;
  registered_address: Record<string, unknown>;
  status: CorporateAccountStatus;
  approved_by: string | null;
  approved_at: string | null;
  suspended_by: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  credit_requested_limit: number | null;
  credit_requested_terms_days: number | null;
  credit_requested_by: string | null;
  credit_requested_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CorporateAccountContactRow {
  id: string;
  account_id: string;
  contact_type: CorporateContactType;
  name: string;
  email: string;
  phone: string;
  designation: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CorporateAccountMemberRow {
  id: string;
  account_id: string;
  user_id: string;
  member_role: CorporateMemberRole;
  status: CorporateMemberStatus;
  granted_by: string;
  granted_at: string;
  revoked_by: string | null;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CorporateEmployeeRow {
  id: string;
  account_id: string;
  employee_code: string;
  employee_code_key: string;
  full_name: string;
  phone: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  default_address: Record<string, unknown>;
  city_key: string | null;
  default_latitude: number | null;
  default_longitude: number | null;
  coordinate_source: CorporateCoordinateSource | null;
  coordinate_verified: boolean;
  coordinate_verified_by: string | null;
  coordinate_verified_at: string | null;
  status: CorporateEmployeeStatus;
  deactivated_by: string | null;
  deactivated_at: string | null;
  deactivated_reason: string | null;
  reactivated_by: string | null;
  reactivated_at: string | null;
  reactivated_reason: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorporateEmployeeEventRow {
  id: string;
  employee_id: string;
  account_id: string;
  event_type: CorporateEmployeeEventType;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown>;
  created_at: string;
}

export interface CorporateAccountEventRow {
  id: string;
  account_id: string;
  event_type: CorporateAccountEventType;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown>;
  created_at: string;
}

export interface CorporateEmployeeImportBatchRow {
  id: string;
  account_id: string;
  file_hash: string;
  filename: string;
  status: CorporateEmployeeImportBatchStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  inserted_rows: number;
  row_errors: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  committed_by: string | null;
  created_at: string;
  committed_at: string | null;
}

// ─── Actor Context & Authorization ───────────────────────────────────────────

export interface CorporateActorContext {
  userId: string;
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  session?: Record<string, unknown>;
  accountRole?: CorporateMemberRole;
  scopedAccountId?: string;
}

// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface CreateCorporateAccountInput {
  customer_id?: string;
  legal_name: string;
  trade_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billing_address?: Record<string, unknown>;
  registered_address?: Record<string, unknown>;
  status?: CorporateAccountStatus;
  credit_requested_limit?: number | null;
  credit_requested_terms_days?: number | null;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
}

export interface UpdateCorporateAccountInput {
  legal_name?: string;
  trade_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billing_address?: Record<string, unknown>;
  registered_address?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  updated_by?: string | null;
}

export interface CreateCorporateContactInput {
  account_id: string;
  contact_type: CorporateContactType;
  name: string;
  email: string;
  phone: string;
  designation?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateCorporateContactInput {
  contact_type?: CorporateContactType;
  name?: string;
  email?: string;
  phone?: string;
  designation?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GrantCorporateMemberInput {
  account_id: string;
  user_id: string;
  member_role: CorporateMemberRole;
  granted_by: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCorporateEmployeeInput {
  account_id: string;
  employee_code: string;
  full_name: string;
  phone: string;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  default_address?: Record<string, unknown>;
  city_key?: string | null;
  default_latitude?: number | null;
  default_longitude?: number | null;
  coordinate_source?: CorporateCoordinateSource | null;
  coordinate_verified?: boolean;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
}

export interface UpdateCorporateEmployeeInput {
  employee_code?: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  default_address?: Record<string, unknown>;
  city_key?: string | null;
  default_latitude?: number | null;
  default_longitude?: number | null;
  coordinate_source?: CorporateCoordinateSource | null;
  metadata?: Record<string, unknown>;
  updated_by?: string | null;
  expectedVersion?: number;
}

export interface DeactivateCorporateEmployeeInput {
  deactivated_by: string;
  deactivated_reason?: string | null;
}

export interface ReactivateCorporateEmployeeInput {
  reactivated_by: string;
  reactivated_reason?: string | null;
}

export interface RecordAccountEventInput {
  account_id: string;
  event_type: CorporateAccountEventType;
  actor_id?: string | null;
  actor_role?: string | null;
  reason?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state: Record<string, unknown>;
}

export interface RecordEmployeeEventInput {
  employee_id: string;
  account_id: string;
  event_type: CorporateEmployeeEventType;
  actor_id?: string | null;
  actor_role?: string | null;
  reason?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state: Record<string, unknown>;
}

export interface CreateEmployeeImportBatchInput {
  account_id: string;
  file_hash: string;
  filename: string;
  status?: CorporateEmployeeImportBatchStatus;
  total_rows?: number;
  valid_rows?: number;
  invalid_rows?: number;
  inserted_rows?: number;
  row_errors?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  created_by?: string | null;
}

// ─── Filter & Query Interfaces ────────────────────────────────────────────────

export interface ListCorporateAccountsFilter {
  status?: CorporateAccountStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListCorporateEmployeesFilter {
  status?: CorporateEmployeeStatus;
  department?: string;
  city_key?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ─── Bulk Employee Roster Import DTOs ─────────────────────────────────────────

export interface ParsedEmployeeRow {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  phone: string;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  deliveryAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RosterImportRowError {
  rowNumber: number;
  employeeCode?: string;
  field: string;
  code: string;
  message: string;
}

export interface RosterImportRowWarning {
  rowNumber: number;
  employeeCode?: string;
  field: string;
  message: string;
}

export interface RosterImportValidationResult {
  isValid: boolean;
  fileHash: string;
  filename: string;
  fileSizeBytes: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RosterImportRowError[];
  warnings: RosterImportRowWarning[];
  rows: ParsedEmployeeRow[];
  batchId?: string;
}

export interface CommitRosterImportResult {
  success: boolean;
  batch: CorporateEmployeeImportBatchRow;
  totalRows: number;
  insertedRows: number;
  employees: CorporateEmployeeRow[];
}

