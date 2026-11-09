/**
 * CakeToHome ERP — Accounting Types & Schemas
 * Phase 4F: Double-entry posting engine, general ledger, and voucher lifecycle types.
 *
 * NOTE: This project does not have zod installed.
 * Validation schemas are expressed as TypeScript interfaces and type guards.
 * Runtime validation is performed in service/API layers using these types.
 */

// ─── Branded Identifier Types ──────────────────────────────────────────────────

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type AccountId = Brand<string, "AccountId">;
export type VoucherId = Brand<string, "VoucherId">;
export type JournalEntryId = Brand<string, "JournalEntryId">;
export type JournalLineId = Brand<string, "JournalLineId">;

// ─── Enums & Domain Unions ─────────────────────────────────────────────────────

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE";

export type AccountSubtype =
  | "CURRENT_ASSET"
  | "CASH"
  | "BANK"
  | "GATEWAY_CLEARING"
  | "RECEIVABLE"
  | "INVENTORY"
  | "INPUT_TAX"
  | "FIXED_ASSET"
  | "CURRENT_LIABILITY"
  | "PAYABLE"
  | "OUTPUT_TAX"
  | "STAFF_PAYABLE"
  | "CUSTOMER_ADVANCE"
  | "LONG_TERM_LIABILITY"
  | "CAPITAL"
  | "RETAINED_EARNINGS"
  | "OPENING_OFFSET"
  | "DIRECT_REVENUE"
  | "INDIRECT_REVENUE"
  | "DELIVERY_REVENUE"
  | "COGS"
  | "OPERATING_EXPENSE"
  | "FINANCIAL_EXPENSE";

export type VoucherType =
  | "SALES"
  | "PURCHASE"
  | "PAYMENT"
  | "RECEIPT"
  | "EXPENSE"
  | "JOURNAL"
  | "CONTRA"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "OPENING_BALANCE";

export type VoucherStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "POSTED"
  | "CANCELLED";

export type CostState =
  | "COST_AVAILABLE"
  | "COST_PENDING"
  | "COST_UNAVAILABLE"
  | "COST_EXCEPTION";

export type LotStatus =
  | "ACTIVE"
  | "DEPLETED"
  | "REVERSED";

export type InventoryItemType =
  | "CAKE"
  | "ACCESSORY"
  | "PACKAGING";

export type MerchandiseType = InventoryItemType;

export type InventoryMovementType =
  | "PURCHASE_RECEIPT"
  | "SALES_FULFILLMENT"
  | "PURCHASE_RETURN"
  | "SALES_RETURN"
  | "STOCK_ADJUSTMENT_UP"
  | "STOCK_ADJUSTMENT_DOWN"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "DAMAGE_WRITEOFF"
  | "INVOICE_REVERSAL";

export type InventoryMovementDirection = "IN" | "OUT";

// ─── Database Row Interfaces ───────────────────────────────────────────────────

export interface AccountingAccountRow {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  parent_id: string | null;
  level: number;
  is_group: boolean;
  is_system: boolean;
  is_active: boolean;
  tax_rate: number | null;
  tax_class: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AccountingVoucherRow {
  id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  voucher_date: string;
  branch_id: string;
  fiscal_year: string;
  status: VoucherStatus;
  total_amount: number;
  currency: string;
  reference_type: string | null;
  reference_id: string | null;
  reference_event: string;
  narration: string;
  created_by: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  reversed_by_voucher_id: string | null;
  reversal_of_voucher_id: string | null;
  cost_centre_id?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AccountingJournalEntryRow {
  id: string;
  entry_no: string;
  voucher_id: string;
  entry_date: string;
  branch_id: string;
  fiscal_year: string;
  total_debit: number;
  total_credit: number;
  is_reversed: boolean;
  reversed_at: string | null;
  narration: string | null;
  created_by: string;
  created_at: string;
}

export interface AccountingJournalLineRow {
  id: string;
  journal_entry_id: string;
  line_no: number;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  branch_id: string;
  customer_id: string | null;
  supplier_id: string | null;
  cost_centre_id?: string | null;
  tax_rate: number | null;
  tax_class: string | null;
  narration: string | null;
  metadata: Record<string, unknown> | null;
  // Augmented join fields
  account_code?: string;
  account_name?: string;
  account_type?: AccountType;
  cost_centre_code?: string;
  cost_centre_name?: string;
}

export interface AccountingFiscalPeriodRow {
  id: string;
  fiscal_year: string;
  period_name: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
}

export interface CostCentreRow {
  id: string;
  code: string;
  name: string;
  department: string;
  parent_id: string | null;
  company_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CostCentreInput {
  code: string;
  name: string;
  department: string;
  parent_id?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface CostCentreUpdateInput {
  name?: string;
  department?: string;
  parent_id?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface CostCentreListFilters {
  department?: string;
  parent_id?: string | null;
  branch_id?: string | null;
  company_id?: string | null;
  is_active?: boolean;
  include_deleted?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CostCentreTreeNode extends CostCentreRow {
  children?: CostCentreTreeNode[];
}

export interface CostCentreActor {
  userId: string;
  email?: string;
  role?: string;
  branchId?: string | null;
  branch_id?: string | null;
  permissions?: string[];
  isSuperAdmin?: boolean;
}

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


export interface CustomerReceiptAllocationRow {
  id: string;
  invoice_id: string;
  voucher_id: string | null;
  payment_transaction_id: string | null;
  allocated_amount: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  order_id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  subtotal: number;
  tax_total: number;
  delivery_fee: number;
  discount_total: number;
  grand_total: number;
  currency_code: string;
  payment_method?: string | null;
  payment_status?: string | null;
  status: string;
  voucher_id?: string | null;
  due_date?: string | null;
  paid_amount: number;
  outstanding_amount: number;
  is_corporate: boolean;
  delivered_at?: string | null;
  delivered_by?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface InventoryCostLotRow {
  id: string;
  branch_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_type: InventoryItemType;
  purchase_id: string;
  purchase_item_id: string;
  supplier_id: string;
  received_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  total_cost: number;
  currency: string;
  received_at: string;
  status: LotStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovementRow {
  id: string;
  branch_id: string;
  product_id: string | null;
  variant_id: string | null;
  movement_type: InventoryMovementType;
  quantity: number;
  direction: InventoryMovementDirection;
  order_id: string | null;
  purchase_id: string | null;
  voucher_id: string | null;
  reference_no: string | null;
  narration: string | null;
  created_by: string;
  created_at: string;
}

export interface InventoryCostConsumptionRow {
  id: string;
  movement_id: string;
  lot_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
}

// ─── DTOs & Input Types ────────────────────────────────────────────────────────

export interface JournalLineInput {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  branch_id?: string; // defaults to voucher branch_id if omitted
  customer_id?: string | null;
  supplier_id?: string | null;
  cost_centre_id?: string | null;
  tax_rate?: number | null;
  tax_class?: string | null;
  narration?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VoucherCreateInput {
  voucher_type: VoucherType;
  voucher_date: string;
  branch_id: string;
  narration: string;
  reference_type?: string | null;
  reference_id?: string | null;
  reference_event?: string;
  reversal_of_voucher_id?: string | null;
  cost_centre_id?: string | null;
  metadata?: Record<string, unknown> | null;
  lines?: JournalLineInput[];
}

export interface VoucherListFilters {
  branch_id?: string;
  status?: VoucherStatus;
  voucher_type?: VoucherType;
  reference_type?: string;
  reference_id?: string;
  fiscal_year?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  /** Server-side pagination: 1-based page number (default: 1) */
  page?: number;
  /** Server-side pagination: rows per page, max 500 (default: 50) */
  limit?: number;
}

export interface VoucherListResult {
  vouchers: (AccountingVoucherRow & {
    branch_name?: string;
    entry_no?: string;
  })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VoucherDetailResult {
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow | null;
  lines: AccountingJournalLineRow[];
}

export interface GeneralLedgerFilters {
  account_id?: string;
  branch_id?: string;
  customer_id?: string;
  supplier_id?: string;
  startDate?: string;
  endDate?: string;
  /** Server-side pagination: 1-based page number (default: 1) */
  page?: number;
  /** Server-side pagination: rows per page, max 500 (default: 50) */
  limit?: number;
}

export interface GeneralLedgerRow {
  line_id: string;
  entry_date: string;
  entry_no: string;
  voucher_id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  account_id: string;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  branch_id: string;
  customer_id: string | null;
  supplier_id: string | null;
  narration: string | null;
}

export interface GeneralLedgerResult {
  lines: GeneralLedgerRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  opening_balance?: number;
  closing_balance?: number;
}

export interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  level: number;
  is_group: boolean;
  total_debit: number;
  total_credit: number;
  net_balance: number;
}

// ─── GL Account Ledger Types (Phase 5A.1) ─────────────────────────────────────

export type NormalBalance = "DEBIT" | "CREDIT";

/**
 * Determines the normal balance direction for an account type.
 * ASSET and EXPENSE accounts have DEBIT normal balances.
 * LIABILITY, REVENUE, and EQUITY accounts have CREDIT normal balances.
 */
export function getNormalBalance(type: AccountType): NormalBalance {
  switch (type) {
    case "ASSET":
    case "EXPENSE":
      return "DEBIT";
    case "LIABILITY":
    case "REVENUE":
    case "EQUITY":
      return "CREDIT";
    default:
      return "DEBIT";
  }
}

export interface AccountLedgerParams {
  account_id: string;
  branch_id?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AccountLedgerLine {
  line_id: string;
  entry_date: string;
  entry_no: string;
  voucher_id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  narration: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  branch_id: string;
  customer_id: string | null;
  supplier_id: string | null;
}

export interface AccountLedgerResult {
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    subtype: AccountSubtype;
    normal_balance: NormalBalance;
  };
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
  lines: AccountLedgerLine[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TrialBalanceParams {
  branch_id?: string;
  startDate?: string;
  endDate?: string;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  summary: {
    total_debit: number;
    total_credit: number;
    is_balanced: boolean;
    imbalance: number;
  };
  filters: {
    branch_id: string | null;
    startDate: string | null;
    endDate: string | null;
  };
}

// ─── Validation Type Guards ───────────────────────────────────────────────────
// Pure TypeScript type guards — no zod dependency required.

export const VALID_VOUCHER_TYPES: VoucherType[] = [
  "SALES",
  "PURCHASE",
  "PAYMENT",
  "RECEIPT",
  "EXPENSE",
  "JOURNAL",
  "CONTRA",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "OPENING_BALANCE",
];

export const VALID_VOUCHER_STATUSES: VoucherStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "POSTED",
  "CANCELLED",
];

export function isValidVoucherType(v: unknown): v is VoucherType {
  return typeof v === "string" && VALID_VOUCHER_TYPES.includes(v as VoucherType);
}

export function isValidVoucherStatus(v: unknown): v is VoucherStatus {
  return typeof v === "string" && VALID_VOUCHER_STATUSES.includes(v as VoucherStatus);
}

/**
 * Validate a JournalLineInput at runtime.
 * Each line must be strictly single-sided: either debit > 0 (and credit = 0),
 * or credit > 0 (and debit = 0). Both zero or both non-zero are invalid.
 */
export function validateJournalLine(line: unknown): line is JournalLineInput {
  if (!line || typeof line !== "object") return false;
  const l = line as Record<string, unknown>;
  if (typeof l.account_id !== "string" || l.account_id.length === 0) return false;
  if (typeof l.debit_amount !== "number" || l.debit_amount < 0) return false;
  if (typeof l.credit_amount !== "number" || l.credit_amount < 0) return false;
  // Single-sided: exactly one side must be positive
  const debitPos = l.debit_amount > 0;
  const creditPos = l.credit_amount > 0;
  return (debitPos && !creditPos) || (!debitPos && creditPos);
}

/**
 * Validate a VoucherCreateInput at runtime.
 */
export function validateVoucherCreateInput(input: unknown): input is VoucherCreateInput {
  if (!input || typeof input !== "object") return false;
  const v = input as Record<string, unknown>;
  if (!isValidVoucherType(v.voucher_type)) return false;
  if (typeof v.voucher_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.voucher_date)) return false;
  if (typeof v.branch_id !== "string" || v.branch_id.length === 0) return false;
  if (typeof v.narration !== "string" || v.narration.length < 3) return false;
  return true;
}

// ─── Phase 4F Step 4.5: Customer Receipts & AR Settlement Types ─────────────────

export interface CustomerReceiptDraftParams {
  orderId: string;
  amount: number;
  voucherDate?: string;
  paymentMethod?: "card" | "upi" | "cod" | string;
  paymentTxnId?: string;
  branchId?: string;
  createdBy: string;
  narration?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface SubmitCustomerReceiptParams {
  voucherId: string;
  submittedBy: string;
  branchId?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface ApproveCustomerReceiptParams {
  voucherId: string;
  approvedBy: string;
  branchId?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface PostCustomerReceiptParams {
  voucherId: string;
  postedBy: string;
  branchId?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface PostCodCashRemittanceParams {
  orderId: string;
  amount: number;
  branchId: string;
  remittedByStaffId: string; // Staff accepting cash / cashier
  approvedBySupervisorId: string; // Supervisor verifying cash drawer
  postedByGlAccountantId: string; // GL accountant posting to ledger
  paymentTxnId?: string;
  voucherDate?: string;
  notes?: string;
  supervisorActorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  accountantActorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface PostGatewaySettlementParams {
  branchId: string;
  voucherDate: string;
  grossAmount: number;
  mdrFeeAmount: number;
  netBankAmount: number;
  payoutRef: string;
  provider: string; // 'razorpay', 'stripe', 'card', 'upi', etc.
  paymentTxnIds?: string[];
  postedBy: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  narration?: string;
  client?: import("pg").PoolClient;
}

export interface CustomerReceiptResult {
  voucher: AccountingVoucherRow;
  journalEntry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  orderId: string;
  receiptAmount: number;
  remainingAr: number;
  paymentTransaction?: Record<string, unknown>;
}

export interface GatewaySettlementResult {
  voucher: AccountingVoucherRow;
  journalEntry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  payoutRef: string;
  grossAmount: number;
  mdrFeeAmount: number;
  netBankAmount: number;
  settledTxnCount: number;
}

export interface OrderOutstandingArResult {
  orderId: string;
  isLedgerEligible: boolean;
  salesVoucherId: string | null;
  invoiceTotal: number;
  totalReceived: number;
  outstandingAr: number;
  isFullySettled: boolean;
  paymentClassification: "PREPAID" | "COD";
  controlAccountCode: "1121" | "1122";
  totalCreditNotes?: number;
  totalRefunded?: number;
  maxRefundable?: number;
  netInvoiced?: number;
  netPaid?: number;
}

// ─── Step 4.6: Sales Return, Credit Note & Customer Refund Types ───────────────

export interface SalesReturnItemInput {
  productId?: string;
  variantId?: string | null;
  quantity: number;
  reason?: string;
  isResalable?: boolean;
}

export interface CreateSalesReturnDraftParams {
  orderId: string;
  branchId?: string;
  createdBy: string;
  items: SalesReturnItemInput[];
  reason?: string;
  returnSequence?: number;
  refundDeliveryFee?: boolean;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface SubmitSalesReturnParams {
  voucherId: string;
  submittedBy: string;
  branchId?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface ApproveSalesReturnParams {
  voucherId: string;
  approvedBy: string;
  branchId?: string;
  approvalNotes?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface PostCreditNoteParams {
  voucherId: string;
  postedBy: string;
  branchId?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface PostCustomerRefundParams {
  orderId: string;
  amount: number;
  refundMethod: "GATEWAY" | "CASH" | "BANK";
  bankAccountId?: string;
  postedBy?: string;
  disbursedBy?: string;
  creditNoteVoucherId?: string;
  branchId?: string;
  providerRef?: string;
  payoutRef?: string;
  gatewayReference?: string;
  idempotencyKey?: string;
  refundSequence?: number;
  reason?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface SalesReturnResult {
  voucher: AccountingVoucherRow;
  journalEntry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  lines: AccountingJournalLineRow[];
  orderId: string;
  creditNoteAmount: number;
  returnedItems: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    restocked: boolean;
    restoredCost: number;
  }>;
  movements: InventoryMovementRow[];
  remainingAr: number;
  eligibleRefundAmount: number;
}

export interface CustomerRefundResult {
  voucher: AccountingVoucherRow;
  journalEntry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  lines: AccountingJournalLineRow[];
  orderId: string;
  refundAmount: number;
  refundMethod: "GATEWAY" | "CASH" | "BANK";
  paymentTransaction?: Record<string, unknown>;
  remainingRefundable: number;
  wasDuplicate: boolean;
}

// ─── Step 4.7: Full Sales Invoice Reversal & Void Types ─────────────────────────

export type SalesInvoiceReversalErrorCode =
  | "ORDER_NOT_FOUND"
  | "ORIGINAL_VOUCHER_NOT_FOUND"
  | "ORIGINAL_JOURNAL_NOT_FOUND"
  | "ORIGINAL_JOURNAL_EMPTY"
  | "INVALID_ORDER_STATUS"
  | "INVALID_VOUCHER_STATE"
  | "BRANCH_ACCESS_DENIED"
  | "COMPANY_ACCESS_DENIED"
  | "ORDER_ALREADY_REVERSED"
  | "CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES"
  | "PERISHABLE_CAKE_RESTOCK_PROHIBITED"
  | "PACKAGING_RESTOCK_PROHIBITED"
  | "INSUFFICIENT_COST_LOT_TRACEABILITY"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "PERMISSION_DENIED"
  | "DUPLICATE_SOURCE_EVENT"
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "POSTING_BEFORE_ACCOUNTING_START_DATE"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "FISCAL_PERIOD_LOCKED"
  | "LEGACY_PROTOTYPE_ORDER_REJECTED"
  | "SALES_REVERSAL_FAILED";

export interface VoidPrePostingSalesVoucherParams {
  voucherId: string;
  cancelledBy: string;
  reason: string;
  branchId?: string;
  actorContext?: { id: string; user_id: string; role: string; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface ReversePostedSalesInvoiceParams {
  orderId?: string;
  voucherId?: string;
  reversedBy: string;
  reversalInitiatorId?: string;
  reversalApproverId?: string;
  voucherPreparerId?: string;
  voucherApproverId?: string;
  reason: string;
  reversalDate?: string;
  branchId?: string;
  companyId?: string;
  actorContext?: { id: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
  reversalInitiatorContext?: { id: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
  reversalApproverContext?: { id: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
  actorRole?: string;
  actorSession?: any;
  client?: import("pg").PoolClient;
}

export interface RestoredAccessorySummary {
  productId: string;
  variantId?: string | null;
  quantity: number;
  restoredCost: number;
  lotId: string;
}

export interface SalesInvoiceReversalResult {
  reversalVoucher: AccountingVoucherRow;
  reversalJournalEntry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  originalVoucher: AccountingVoucherRow;
  orderId: string;
  reversedTotal: number;
  restoredAccessories: RestoredAccessorySummary[];
  movements: InventoryMovementRow[];
  postReversalArBalance: number;
  maxCustomerRefundable: number;
  wasDuplicate: boolean;
}

// ─── Step 4.9: COD Collection Control & Delivery Rider Remittance Types ─────

export type CodCustodyStatus =
  | "PRE_DELIVERY_UNCOLLECTED"
  | "DELIVERED_PENDING_COLLECTION"
  | "IDENTIFIED_RIDER_CUSTODY"
  | "UNASSIGNED_DELIVERED_COD"
  | "OTHER_VALID_UNCLEARED_STATES"
  | "REMITTED_CLEARED";

export interface CodCustodySnapshot {
  custody_id: string;
  order_id: string;
  order_display_id: number;
  delivery_partner_id: string | null;
  partner_name: string | null;
  branch_id: string;
  collected_amount: number;
  custody_status: CodCustodyStatus;
  collected_at: string;
  source_event_id: string;
  settlement_voucher_id: string | null;
  settled_at: string | null;
}

export interface ConfirmCodCollectionParams {
  orderId: string;
  deliveryPartnerId?: string;
  amount?: number;
  collectedAt?: string;
  branchId?: string;
  actorContext?: { id?: string; user_id?: string; userId?: string; role?: string; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface SettlementLineInput {
  orderId: string;
  amount: number;
}

export interface PostCodShiftSettlementParams {
  shiftId: string;
  deliveryPartnerId: string;
  branchId: string;
  settlementLines: SettlementLineInput[];
  totalCashReceived: number;
  remittedByStaffId: string; // Teller / Cashier accepting cash
  approvedBySupervisorId: string; // Cash Drawer Supervisor
  postedByGlAccountantId: string; // GL Accountant
  voucherDate?: string;
  notes?: string;
  supervisorActorContext?: { id: string; user_id: string; role: string; permissions?: string[]; [key: string]: unknown };
  accountantActorContext?: { id: string; user_id: string; role: string; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface CodShiftSettlementResult {
  voucher: AccountingVoucherRow;
  journalEntry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  shiftId: string;
  deliveryPartnerId: string;
  totalSettled: number;
  settledOrdersCount: number;
  settlementLines: Array<{ orderId: string; amount: number; voucherLineId?: string }>;
}

export interface RiderCodCustodySummary {
  deliveryPartnerId: string;
  partnerName: string;
  branchId: string;
  totalCollected: number;
  totalRemitted: number;
  outstandingCustody: number;
  activeOrdersCount: number;
  orders: Array<{
    orderId: string;
    displayId: number;
    collectedAmount: number;
    collectedAt: string;
    custodyStatus: CodCustodyStatus;
  }>;
}

export interface CodExceptionItem {
  type:
    | "COD_WITHOUT_DELIVERY_ASSIGNMENT"
    | "COD_DELIVERED_WITHOUT_COLLECTION"
    | "COD_DISPUTE_WITHOUT_1122_BALANCE"
    | "REMITTANCE_EXCEEDING_CUSTODY"
    | "PARTIAL_SHIFT_SETTLEMENT_REJECTED"
    | "CASH_SHORTAGE_DETECTED"
    | "DUPLICATE_COLLECTION_EVENT"
    | "BRANCH_MISMATCH_SETTLEMENT"
    | "RIDER_MISMATCH_SETTLEMENT"
    | "GL_CONTROL_DISCREPANCY";
  severity: "HIGH" | "MEDIUM" | "CRITICAL";
  orderId?: string;
  details: string;
}

export interface CodReconciliationResult {
  branchId?: string;
  asOfDate: string;
  stateA_preDeliveryUncollected: number;
  stateA1_deliveredPendingCollection: number;
  stateB_identifiedRiderCustody: number;
  stateC_unassignedDeliveredCod: number;
  stateD_otherValidUncleared: number;
  stateE_remittedClearedTotal: number;
  totalOperationalUnclearedControl: number;
  gl1122Balance: number;
  discrepancy: number;
  isReconciled: boolean;
  exceptions: CodExceptionItem[];
}

// ─── Step 4.10: Bank & Gateway Settlement Foundation Types ────────────────────

export type BankAccountId = Brand<string, "BankAccountId">;
export type BankDepositSlipId = Brand<string, "BankDepositSlipId">;
export type GatewayPayoutBatchId = Brand<string, "GatewayPayoutBatchId">;
export type GatewaySettlementOrderId = Brand<string, "GatewaySettlementOrderId">;

export type BankAccountStatus = "ACTIVE" | "INACTIVE" | "FROZEN";
export type BankAccountType = "CURRENT" | "SAVINGS" | "OVERDRAFT" | "VIRTUAL";

export interface BankAccountRow {
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
}

export type BankDepositStatus =
  | "DRAFT"
  | "DISPATCHED"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED";

export interface BankDepositDenominations {
  notes_2000?: number;
  notes_500?: number;
  notes_200?: number;
  notes_100?: number;
  notes_50?: number;
  notes_20?: number;
  notes_10?: number;
  coins?: number;
  [key: string]: number | undefined;
}

export interface BankDepositSlipRow {
  id: string;
  slip_number: string;
  company_id: string;
  branch_id: string;
  bank_account_id: string;
  deposit_date: string;
  amount: number;
  denominations: BankDepositDenominations;
  status: BankDepositStatus;
  prepared_by: string;
  approved_by: string | null;
  posted_by: string | null;
  bank_ref_number: string | null;
  bank_value_date: string | null;
  transit_voucher_id: string | null;
  credit_voucher_id: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type GatewayPayoutStatus =
  | "INGESTED"
  | "APPROVED"
  | "PARTITIONED"
  | "POSTED"
  | "EXCEPTION"
  | "CANCELLED";

export interface GatewayPayoutBatchRow {
  id: string;
  company_id: string;
  provider: string;
  payout_reference: string;
  settlement_reference: string | null;
  bank_account_id: string;
  settlement_date: string;
  bank_value_date: string | null;
  gross_amount: number;
  identified_fee_amount: number;
  reported_tax_amount: number;
  other_deductions_amount: number;
  net_amount: number;
  rounding_variance: number;
  currency: string;
  status: GatewayPayoutStatus;
  unreconciled_exception_count: number;
  ingestion_source: string;
  prepared_by: string;
  approved_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type GatewayAllocationStatus =
  | "PENDING"
  | "VALIDATED"
  | "POSTED"
  | "EXCEPTION";

export interface GatewaySettlementOrderRow {
  id: string;
  payout_batch_id: string;
  payment_transaction_id: string;
  order_id: string;
  settlement_branch_id: string;
  allocated_gross_amount: number;
  identified_fee_amount: number;
  reported_tax_amount: number;
  other_deductions_amount: number;
  allocated_net_amount: number;
  allocation_status: GatewayAllocationStatus;
  exception_reason: string | null;
  provider_payment_id: string | null;
  voucher_id: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── Substep 4.10.2: Bank Master & Cash Deposit DTOs & Error Types ────────────

export type BankMasterErrorCode =
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
  | "INVALID_TRANSFER"
  | "INVALID_TRANSFER_AMOUNT"
  | "ACCOUNT_INACTIVE"
  | "INSUFFICIENT_FUNDS"
  | "BANK_MASTER_ERROR";

export interface CreateBankAccountParams {
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
}

export interface UpdateBankAccountParams {
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
}

export interface ListBankAccountsFilter {
  companyId?: string;
  status?: BankAccountStatus;
  search?: string;
  branchId?: string | null; // Ignored for company accounts, kept for backwards compatibility
  includeEnterprise?: boolean;
  actorContext?: { id?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
}

export type BankDepositErrorCode =
  | "DEPOSIT_SLIP_NOT_FOUND"
  | "DEPOSIT_SLIP_ALREADY_EXISTS"
  | "INVALID_DEPOSIT_STATUS"
  | "INVALID_DEPOSIT_AMOUNT"
  | "INVALID_DEPOSIT_DATE"
  | "DEPOSIT_DENOMINATION_MISMATCH"
  | "INVALID_DENOMINATIONS"
  | "BANK_ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_INACTIVE"
  | "BANK_ACCOUNT_FROZEN"
  | "BANK_ACCOUNT_BRANCH_MISMATCH"
  | "BRANCH_ACCESS_DENIED"
  | "COMPANY_ACCESS_DENIED"
  | "PERMISSION_DENIED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "SELF_APPROVAL_FORBIDDEN"
  | "POSTED_DEPOSIT_IMMUTABLE"
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "FISCAL_PERIOD_LOCKED"
  | "CONTROL_ACCOUNT_INACTIVE"
  | "DUPLICATE_SOURCE_EVENT"
  | "BANK_DEPOSIT_ERROR";

export interface PrepareBankDepositSlipParams {
  slipNumber?: string;
  branchId: string;
  bankAccountId: string;
  depositDate: string;
  amount: number;
  denominations?: BankDepositDenominations;
  preparedBy: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface ApproveBankDepositSlipParams {
  depositSlipId: string;
  approvedBy: string;
  branchId?: string;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface PostBankDepositSlipParams {
  depositSlipId: string;
  postedBy: string;
  branchId?: string;
  voucherDate?: string;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface CancelBankDepositSlipParams {
  depositSlipId: string;
  cancelledBy: string;
  reason?: string;
  branchId?: string;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface RejectBankDepositSlipParams {
  depositSlipId: string;
  rejectedBy: string;
  reason?: string;
  branchId?: string;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface BankDepositSlipResult {
  depositSlip: BankDepositSlipRow;
  voucher?: AccountingVoucherRow;
  journalEntry?: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  wasDuplicate?: boolean;
}

// ─── Substep 4.10.3: Gateway Payout & Settlement Allocation DTOs & Error Types ─

export type GatewaySettlementErrorCode =
  | "DUPLICATE_PAYOUT_REFERENCE"
  | "SETTLEMENT_MATH_MISMATCH"
  | "SETTLEMENT_VARIANCE_MISMATCH"
  | "PAYMENT_TRANSACTION_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "ORDER_ALREADY_SETTLED"
  | "BRANCH_RELATIONSHIP_MISMATCH"
  | "SETTLEMENT_ORDER_BRANCH_UNVERIFIED"
  | "BANK_ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_INACTIVE"
  | "BANK_ACCOUNT_FROZEN"
  | "BRANCH_ACCESS_DENIED"
  | "PERMISSION_DENIED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "SELF_APPROVAL_FORBIDDEN"
  | "UNRECONCILED_SETTLEMENT_EXCEPTION"
  | "INVALID_PAYOUT_STATUS"
  | "POSTED_PAYOUT_IMMUTABLE"
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "FISCAL_PERIOD_LOCKED"
  | "CONTROL_ACCOUNT_INACTIVE"
  | "SETTLEMENT_ALLOCATION_MISMATCH"
  | "GATEWAY_SETTLEMENT_ERROR";

export interface IngestGatewaySettlementOrderInput {
  payment_transaction_id: string;
  order_id: string;
  allocated_gross_amount: number;
  identified_fee_amount?: number;
  reported_tax_amount?: number;
  other_deductions_amount?: number;
  provider_payment_id?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestGatewayPayoutBatchParams {
  provider: string;
  payout_reference: string;
  settlement_reference?: string;
  bank_account_id: string;
  settlement_date: string;
  bank_value_date?: string;
  gross_amount: number;
  identified_fee_amount?: number;
  reported_tax_amount?: number;
  other_deductions_amount?: number;
  net_amount: number;
  rounding_variance?: number;
  currency?: string;
  ingestion_source?: string;
  prepared_by: string;
  company_id?: string;
  orders: IngestGatewaySettlementOrderInput[];
  metadata?: Record<string, unknown>;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface ApproveGatewayPayoutBatchParams {
  payoutBatchId: string;
  approvedBy: string;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface PostGatewayPayoutSettlementParams {
  payoutBatchId: string;
  postedBy: string;
  voucherDate?: string;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface CancelGatewayPayoutBatchParams {
  payoutBatchId: string;
  cancelledBy: string;
  reason?: string;
  actorContext?: { id?: string; user_id?: string; role?: string; branch_id?: string | null; branchId?: string | null; permissions?: string[]; [key: string]: unknown };
  client?: import("pg").PoolClient;
}

export interface GatewayPayoutBatchResult {
  payoutBatch: GatewayPayoutBatchRow;
  settlementOrders: GatewaySettlementOrderRow[];
  vouchers?: AccountingVoucherRow[];
  journalEntries?: (AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] })[];
  wasDuplicate?: boolean;
}

export interface ListGatewayPayoutBatchesFilter {
  provider?: string;
  status?: GatewayPayoutStatus;
  startDate?: string;
  endDate?: string;
  bankAccountId?: string;
  limit?: number;
  offset?: number;
}

// ─── Step 4.10.5-A: Bank Statement Reconciliation — Schema Foundation Types ───

// Branded identifier types
export type BankStatementImportId = Brand<string, "BankStatementImportId">;
export type BankStatementLineId = Brand<string, "BankStatementLineId">;
export type BankReconciliationSessionId = Brand<string, "BankReconciliationSessionId">;
export type BankReconciliationMatchId = Brand<string, "BankReconciliationMatchId">;

// ─── Status Enums ───────────────────────────────────────────────────────────────

/**
 * Lifecycle status for a bank statement import.
 * IMPORTED → PROCESSING → COMPLETED | FAILED | SUPERSEDED
 * An import represents immutable source evidence; it does NOT create accounting entries.
 */
export type BankStatementImportStatus =
  | "IMPORTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "SUPERSEDED";

/**
 * Source format of the bank statement file.
 * Provider-specific adapters (HDFC, ICICI, etc.) are NOT part of this enum —
 * they implement a common statement-adapter contract outside the generic engine.
 */
export type BankStatementSourceFormat =
  | "CSV"
  | "OFX"
  | "MT940"
  | "CUSTOM"
  | "MANUAL";

/**
 * Reconciliation status for an individual bank statement line.
 * UNMATCHED = no match found yet.
 * MATCHED = fully reconciled against one internal source.
 * PARTIALLY_MATCHED = partial match (amount split or partial allocation).
 * EXCEPTION = flagged for manual review.
 */
export type BankStatementLineReconciliationStatus =
  | "UNMATCHED"
  | "MATCHED"
  | "PARTIALLY_MATCHED"
  | "EXCEPTION";

/**
 * Lifecycle status for a bank reconciliation session.
 * DRAFT → IN_PROGRESS → REVIEWED → APPROVED → CLOSED | CANCELLED
 * SoD enforcement: preparer ≠ reviewer ≠ approver (database-level constraints).
 */
export type BankReconciliationSessionStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "REVIEWED"
  | "APPROVED"
  | "CLOSED"
  | "CANCELLED";

/**
 * Source type for a reconciliation match.
 * Identifies the type of internal document the bank statement line is matched against.
 * This is the polymorphic discriminator for match_source_id.
 */
export type ReconciliationMatchSourceType =
  | "BANK_DEPOSIT_SLIP"
  | "GATEWAY_PAYOUT_BATCH"
  | "PURCHASE_PAYMENT"
  | "CUSTOMER_REFUND"
  | "DIRECT_BANK_ENTRY"
  | "OTHER";

/**
 * Type of match applied between a statement line and an internal source.
 * EXACT = amounts match precisely.
 * PARTIAL = partial amount allocation.
 * MANUAL = manually matched by an operator.
 * RULE_BASED = matched by an automated rule engine.
 */
export type ReconciliationMatchType =
  | "EXACT"
  | "PARTIAL"
  | "MANUAL"
  | "RULE_BASED";

/**
 * Status of a reconciliation match.
 * PROPOSED = auto-suggested or operator-created, awaiting confirmation.
 * CONFIRMED = verified and accepted.
 * REJECTED = match was rejected.
 * REVERSED = previously confirmed match was undone.
 */
export type ReconciliationMatchStatus =
  | "PROPOSED"
  | "CONFIRMED"
  | "REJECTED"
  | "REVERSED";

// ─── Database Row Interfaces ────────────────────────────────────────────────────

/**
 * Row interface for public.bank_statement_import.
 * Represents immutable source-evidence metadata for an imported bank statement.
 * An import record is evidence ingestion — it does NOT create accounting postings.
 */
export interface BankStatementImportRow {
  id: string;
  bank_account_id: string;
  company_id: string;
  source_filename: string;
  source_format: BankStatementSourceFormat;
  file_sha256: string;
  file_size_bytes: number | null;
  statement_period_start: string;
  statement_period_end: string;
  total_lines_imported: number;
  total_debit_amount: number;
  total_credit_amount: number;
  status: BankStatementImportStatus;
  imported_by: string;
  imported_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row interface for public.bank_statement_line.
 * Represents an individual immutable bank statement transaction.
 * The source evidence is preserved faithfully — missing bank fields are not fabricated.
 * value_date is preserved separately from transaction_date per design requirement.
 */
export interface BankStatementLineRow {
  id: string;
  import_id: string;
  bank_account_id: string;
  line_number: number;
  transaction_date: string;
  value_date: string | null;
  description: string;
  bank_reference: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number | null;
  line_hash: string;
  reconciliation_status: BankStatementLineReconciliationStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row interface for public.bank_reconciliation_session.
 * Represents a controlled reconciliation session for a bank account and period.
 * SoD: preparer ≠ reviewer ≠ approver (enforced at DB level).
 */
export interface BankReconciliationSessionRow {
  id: string;
  bank_account_id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  opening_balance_per_bank: number | null;
  closing_balance_per_bank: number | null;
  status: BankReconciliationSessionStatus;
  prepared_by: string;
  reviewed_by: string | null;
  approved_by: string | null;
  prepared_at: string;
  reviewed_at: string | null;
  approved_at: string | null;
  total_matched_count: number;
  total_unmatched_count: number;
  total_exception_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row interface for public.bank_reconciliation_match.
 * Represents an explicit match between a statement line and an internal source document.
 * A match is auditable and does NOT mutate the source accounting evidence.
 * SoD: matched_by ≠ confirmed_by (enforced at DB level).
 */
export interface BankReconciliationMatchRow {
  id: string;
  session_id: string;
  statement_line_id: string;
  match_source_type: ReconciliationMatchSourceType;
  match_source_id: string;
  match_type: ReconciliationMatchType;
  matched_amount: number;
  match_status: ReconciliationMatchStatus;
  variance_amount: number;
  matched_by: string;
  matched_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── Validation Constants ───────────────────────────────────────────────────────

export const VALID_BANK_STATEMENT_IMPORT_STATUSES: BankStatementImportStatus[] = [
  "IMPORTED", "PROCESSING", "COMPLETED", "FAILED", "SUPERSEDED",
];

export const VALID_BANK_STATEMENT_SOURCE_FORMATS: BankStatementSourceFormat[] = [
  "CSV", "OFX", "MT940", "CUSTOM", "MANUAL",
];

export const VALID_BANK_STATEMENT_LINE_RECONCILIATION_STATUSES: BankStatementLineReconciliationStatus[] = [
  "UNMATCHED", "MATCHED", "PARTIALLY_MATCHED", "EXCEPTION",
];

export const VALID_BANK_RECONCILIATION_SESSION_STATUSES: BankReconciliationSessionStatus[] = [
  "DRAFT", "IN_PROGRESS", "REVIEWED", "APPROVED", "CLOSED", "CANCELLED",
];

export const VALID_RECONCILIATION_MATCH_SOURCE_TYPES: ReconciliationMatchSourceType[] = [
  "BANK_DEPOSIT_SLIP", "GATEWAY_PAYOUT_BATCH", "PURCHASE_PAYMENT",
  "CUSTOMER_REFUND", "DIRECT_BANK_ENTRY", "OTHER",
];

export const VALID_RECONCILIATION_MATCH_TYPES: ReconciliationMatchType[] = [
  "EXACT", "PARTIAL", "MANUAL", "RULE_BASED",
];

export const VALID_RECONCILIATION_MATCH_STATUSES: ReconciliationMatchStatus[] = [
  "PROPOSED", "CONFIRMED", "REJECTED", "REVERSED",
];

// ─── Type Guards ────────────────────────────────────────────────────────────────

export function isValidBankStatementImportStatus(v: unknown): v is BankStatementImportStatus {
  return typeof v === "string" && VALID_BANK_STATEMENT_IMPORT_STATUSES.includes(v as BankStatementImportStatus);
}

export function isValidBankStatementSourceFormat(v: unknown): v is BankStatementSourceFormat {
  return typeof v === "string" && VALID_BANK_STATEMENT_SOURCE_FORMATS.includes(v as BankStatementSourceFormat);
}

export function isValidBankStatementLineReconciliationStatus(v: unknown): v is BankStatementLineReconciliationStatus {
  return typeof v === "string" && VALID_BANK_STATEMENT_LINE_RECONCILIATION_STATUSES.includes(v as BankStatementLineReconciliationStatus);
}

export function isValidBankReconciliationSessionStatus(v: unknown): v is BankReconciliationSessionStatus {
  return typeof v === "string" && VALID_BANK_RECONCILIATION_SESSION_STATUSES.includes(v as BankReconciliationSessionStatus);
}

export function isValidReconciliationMatchSourceType(v: unknown): v is ReconciliationMatchSourceType {
  return typeof v === "string" && VALID_RECONCILIATION_MATCH_SOURCE_TYPES.includes(v as ReconciliationMatchSourceType);
}

export function isValidReconciliationMatchType(v: unknown): v is ReconciliationMatchType {
  return typeof v === "string" && VALID_RECONCILIATION_MATCH_TYPES.includes(v as ReconciliationMatchType);
}

export function isValidReconciliationMatchStatus(v: unknown): v is ReconciliationMatchStatus {
  return typeof v === "string" && VALID_RECONCILIATION_MATCH_STATUSES.includes(v as ReconciliationMatchStatus);
}

// ─── Error Code Type for Reconciliation ─────────────────────────────────────────

export type BankReconciliationErrorCode =
  | "STATEMENT_IMPORT_NOT_FOUND"
  | "STATEMENT_LINE_NOT_FOUND"
  | "RECONCILIATION_SESSION_NOT_FOUND"
  | "RECONCILIATION_MATCH_NOT_FOUND"
  | "DUPLICATE_FILE_SHA256"
  | "DUPLICATE_LINE_HASH"
  | "INVALID_STATEMENT_FORMAT"
  | "INVALID_STATEMENT_PERIOD"
  | "INVALID_RECONCILIATION_STATUS"
  | "BANK_ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_INACTIVE"
  | "BANK_ACCOUNT_FROZEN"
  | "BRANCH_ACCESS_DENIED"
  | "COMPANY_ACCESS_DENIED"
  | "PERMISSION_DENIED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "POSTED_EVIDENCE_IMMUTABLE"
  | "MATCH_SOURCE_NOT_FOUND"
  | "MATCH_AMOUNT_EXCEEDS_LINE"
  | "SESSION_NOT_IN_VALID_STATE"
  | "HISTORICAL_QUARANTINE_VIOLATION"
  | "BANK_RECONCILIATION_ERROR";

// ─── List/Filter DTOs ───────────────────────────────────────────────────────────

export interface ListBankStatementImportsFilter {
  bankAccountId?: string;
  companyId?: string;
  status?: BankStatementImportStatus;
  sourceFormat?: BankStatementSourceFormat;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ListBankStatementLinesFilter {
  importId?: string;
  bankAccountId?: string;
  reconciliationStatus?: BankStatementLineReconciliationStatus;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListBankReconciliationSessionsFilter {
  bankAccountId?: string;
  companyId?: string;
  status?: BankReconciliationSessionStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ListBankReconciliationMatchesFilter {
  sessionId?: string;
  statementLineId?: string;
  matchSourceType?: ReconciliationMatchSourceType;
  matchStatus?: ReconciliationMatchStatus;
  limit?: number;
  offset?: number;
}

// ─── 4.10.5-C Matching Engine & Clearance DTOs ────────────────────────────────

export interface CreateReconciliationSessionParams {
  id?: string;
  bankAccountId: string;
  companyId?: string;
  periodStart: string;
  periodEnd: string;
  openingBalancePerBank?: number | null;
  closingBalancePerBank?: number | null;
  preparedBy: string;
  status?: BankReconciliationSessionStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateReconciliationMatchParams {
  id?: string;
  sessionId: string;
  statementLineId: string;
  matchSourceType: ReconciliationMatchSourceType;
  matchSourceId: string;
  matchType?: ReconciliationMatchType;
  matchedAmount: number;
  matchStatus?: ReconciliationMatchStatus;
  varianceAmount?: number;
  matchedBy: string;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CandidateMatchResult {
  statementLineId: string;
  candidateType: ReconciliationMatchSourceType;
  status: "PROPOSED" | "NO_CANDIDATE" | "AMBIGUOUS_EXCEPTION" | "ALREADY_MATCHED";
  candidatesCount: number;
  candidateId?: string;
  candidate?: Record<string, unknown>;
  match?: BankReconciliationMatchRow;
  reason?: string;
}

export interface ConfirmCashDepositClearanceParams {
  matchId?: string;
  statementLineId?: string;
  depositSlipId?: string;
  sessionId?: string;
  confirmerId: string;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    [key: string]: unknown;
  };
  voucherDate?: string;
  notes?: string;
}

export interface ConfirmCashDepositClearanceResult {
  depositSlip: BankDepositSlipRow;
  statementLine: BankStatementLineRow;
  match: BankReconciliationMatchRow;
  voucher?: unknown;
  journalEntry?: unknown;
  wasDuplicate: boolean;
}

export interface ConfirmGatewayPayoutMatchParams {
  matchId?: string;
  statementLineId?: string;
  payoutBatchId?: string;
  sessionId?: string;
  confirmerId: string;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    [key: string]: unknown;
  };
  notes?: string;
}

export interface ConfirmGatewayPayoutMatchResult {
  match: BankReconciliationMatchRow;
  statementLine: BankStatementLineRow;
  payoutBatch: Record<string, unknown>;
  wasDuplicate: boolean;
}

export interface ConfirmSupplierPaymentMatchParams {
  matchId?: string;
  statementLineId?: string;
  purchasePaymentId?: string;
  sessionId?: string;
  confirmerId: string;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    [key: string]: unknown;
  };
  notes?: string;
}

export interface ConfirmSupplierPaymentMatchResult {
  match: BankReconciliationMatchRow;
  statementLine: BankStatementLineRow;
  purchasePayment: Record<string, unknown>;
  wasDuplicate: boolean;
}

export interface ManualReconciliationMatchParams {
  sessionId: string;
  statementLineId: string;
  matchSourceType: ReconciliationMatchSourceType;
  matchSourceId: string;
  overrideReason: string;
  matcherId: string;
  confirmerId?: string;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    [key: string]: unknown;
  };
  matchedAmount?: number;
  varianceAmount?: number;
  metadata?: Record<string, unknown>;
}

// ─── Substep 4.10.5-D-A: Bank Reconciliation Statement (BRS) Engine Types ───

export interface BrsSummary {
  statementClosingBalance: number;
  statementClosingBalancePaise: number;
  gl1112BookBalance: number;
  gl1112BookBalancePaise: number;
  gl1118TransitBalance: number;
  gl1118TransitBalancePaise: number;
  totalBookBalance: number;
  totalBookBalancePaise: number;
  totalDepositsInTransit: number;
  totalDepositsInTransitPaise: number;
  totalOutstandingDisbursements: number;
  totalOutstandingDisbursementsPaise: number;
  totalUnmatchedBankDebits: number;
  totalUnmatchedBankDebitsPaise: number;
  totalUnmatchedBankCredits: number;
  totalUnmatchedBankCreditsPaise: number;
  reconciledBookBalance: number;
  reconciledBookBalancePaise: number;
  discrepancy: number;
  discrepancyPaise: number;
  isReconciled: boolean;
}

export interface BrsBreakdownsCount {
  depositsInTransitCount: number;
  outstandingDisbursementsCount: number;
  unmatchedBankDebitsCount: number;
  unmatchedBankCreditsCount: number;
}

export interface BrsUnclearedDepositItem {
  id: string;
  slipNumber: string;
  depositDate: string;
  amount: number;
  branchId: string;
  bankAccountId: string;
  status: string;
  transitVoucherId: string | null;
  creditVoucherId: string | null;
}

export interface BrsOutstandingDisbursementItem {
  voucherId: string;
  voucherNo: string;
  voucherDate: string;
  voucherType: string;
  referenceType: string;
  referenceId: string;
  branchId: string;
  amount: number;
  narration?: string;
}

export interface BrsUnmatchedStatementLineItem {
  id: string;
  importId: string;
  lineNumber: number;
  transactionDate: string;
  valueDate: string | null;
  effectiveDate: string;
  description: string;
  bankReference: string | null;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number | null;
  reconciliationStatus: string;
}

export interface BankReconciliationStatementResult {
  session?: {
    id: string;
    bankAccountId: string;
    periodStart: string;
    periodEnd: string;
    status: string;
  } | null;
  bankAccount: {
    id: string;
    bankName: string;
    accountNumberMasked: string;
    ifscCode: string;
    branchId: string | null;
  };
  asOfDate: string;
  summary: BrsSummary;
  breakdownCounts: BrsBreakdownsCount;
  calculatedAt: string;
}

export interface CalculateBrsParams {
  bankAccountId: string;
  asOfDate?: string;
  sessionId?: string;
  branchId?: string | null;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    isSuperAdmin?: boolean;
    [key: string]: unknown;
  };
}

export interface ListBrsUnclearedDepositsParams {
  bankAccountId: string;
  asOfDate?: string;
  branchId?: string | null;
  limit?: number;
  offset?: number;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    isSuperAdmin?: boolean;
    [key: string]: unknown;
  };
}

export interface ListBrsOutstandingDisbursementsParams {
  bankAccountId: string;
  asOfDate?: string;
  branchId?: string | null;
  limit?: number;
  offset?: number;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    isSuperAdmin?: boolean;
    [key: string]: unknown;
  };
}

export interface ListBrsUnmatchedLinesParams {
  bankAccountId: string;
  asOfDate?: string;
  type?: "DEBIT" | "CREDIT" | "ALL";
  branchId?: string | null;
  limit?: number;
  offset?: number;
  actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    isSuperAdmin?: boolean;
    [key: string]: unknown;
  };
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

// ─── Cost Allocation Domain Types (Phase C7.6 Step 4) ─────────────────────────

export type CostAllocationRuleType = "FIXED_PERCENTAGE" | "REVENUE_RATIO" | "EQUAL_SPLIT";

export type CostAllocationRunStatus = "PREVIEW" | "DRAFT" | "SUBMITTED" | "POSTED" | "REVERSED";

export interface CostAllocationRuleRow {
  id: string;
  rule_code: string;
  name: string;
  description: string | null;
  rule_type: CostAllocationRuleType;
  source_cost_centre_id: string;
  source_account_id: string;
  version: number;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Enriched fields
  source_cost_centre_code?: string;
  source_cost_centre_name?: string;
  source_account_code?: string;
  source_account_name?: string;
}

export interface CostAllocationRuleTargetRow {
  id: string;
  rule_id: string;
  target_cost_centre_id: string;
  target_account_id: string | null;
  percentage: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Enriched fields
  target_cost_centre_code?: string;
  target_cost_centre_name?: string;
  target_account_code?: string;
  target_account_name?: string;
}

export interface CostAllocationRuleTargetInput {
  target_cost_centre_id: string;
  target_account_id?: string | null;
  percentage: number;
  sort_order?: number;
}

export interface CreateCostAllocationRuleInput {
  rule_code: string;
  name: string;
  description?: string | null;
  rule_type?: CostAllocationRuleType;
  source_cost_centre_id: string;
  source_account_id: string;
  effective_from: string;
  effective_to?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
  targets?: CostAllocationRuleTargetInput[];
}

export interface UpdateCostAllocationRuleInput {
  name?: string;
  description?: string | null;
  effective_from?: string;
  effective_to?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface CostAllocationRuleWithTargets extends CostAllocationRuleRow {
  targets: CostAllocationRuleTargetRow[];
}

export interface CostAllocationRuleListFilters {
  is_active?: boolean;
  rule_type?: CostAllocationRuleType;
  source_cost_centre_id?: string;
  source_account_id?: string;
  effective_date?: string;
  search?: string;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface CostAllocationRuleTargetSnapshot {
  target_cost_centre_id: string;
  target_cost_centre_code?: string;
  target_cost_centre_name?: string;
  target_account_id: string | null;
  target_account_code?: string;
  percentage: number;
  sort_order: number;
}

export interface CostAllocationRuleSnapshot {
  rule_id: string;
  rule_code: string;
  rule_name: string;
  rule_type: CostAllocationRuleType;
  rule_version: number;
  source_cost_centre_id: string;
  source_cost_centre_code?: string;
  source_cost_centre_name?: string;
  source_account_id: string;
  source_account_code?: string;
  effective_from: string;
  effective_to: string | null;
  targets: CostAllocationRuleTargetSnapshot[];
  captured_at: string;
}

export interface CostAllocationRunRow {
  id: string;
  run_number: string;
  rule_id: string;
  rule_version: number;
  fiscal_year: string;
  period_name: string;
  allocation_date: string;
  source_cost_centre_id: string;
  source_account_id: string;
  total_source_amount: number;
  total_allocated_amount: number;
  rounding_difference: number;
  status: CostAllocationRunStatus;
  accounting_voucher_id: string | null;
  reversal_voucher_id: string | null;
  rule_snapshot: CostAllocationRuleSnapshot;
  narration: string;
  metadata: Record<string, unknown> | null;
  executed_by: string | null;
  executed_at: string;
  approved_by: string | null;
  approved_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  // Enriched fields
  source_cost_centre_code?: string;
  source_cost_centre_name?: string;
  source_account_code?: string;
  source_account_name?: string;
  voucher_no?: string;
}

export interface CostAllocationRunLineRow {
  id: string;
  run_id: string;
  source_journal_line_id: string | null;
  target_cost_centre_id: string;
  target_account_id: string;
  target_percentage: number;
  allocated_amount: number;
  sort_order: number;
  created_at: string;
  // Enriched fields
  target_cost_centre_code?: string;
  target_cost_centre_name?: string;
  target_account_code?: string;
  target_account_name?: string;
}

export interface CostAllocationRunLineInput {
  source_journal_line_id?: string | null;
  target_cost_centre_id: string;
  target_account_id: string;
  target_percentage: number;
  allocated_amount: number;
  sort_order?: number;
}

export interface CreateCostAllocationRunInput {
  run_number: string;
  rule_id: string;
  rule_version?: number;
  fiscal_year: string;
  period_name: string;
  allocation_date: string;
  source_cost_centre_id: string;
  source_account_id: string;
  total_source_amount: number;
  total_allocated_amount: number;
  rounding_difference?: number;
  status?: CostAllocationRunStatus;
  accounting_voucher_id?: string | null;
  rule_snapshot: CostAllocationRuleSnapshot;
  narration: string;
  metadata?: Record<string, unknown> | null;
  lines?: CostAllocationRunLineInput[];
}

export interface CostAllocationRunWithLines extends CostAllocationRunRow {
  lines: CostAllocationRunLineRow[];
}

export interface CostAllocationRunListFilters {
  status?: CostAllocationRunStatus;
  rule_id?: string;
  source_cost_centre_id?: string;
  fiscal_year?: string;
  period_name?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface CostAllocationSourceLineHistoryRow {
  source_journal_line_id: string;
  run_id: string;
  run_number: string;
  status: CostAllocationRunStatus;
  allocated_amount: number;
  allocation_date: string;
}

export type CostAllocationErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BRANCH_ACCESS_DENIED"
  | "VALIDATION_FAILED"
  | "RULE_TYPE_NOT_SUPPORTED"
  | "INVALID_RUN_STATE"
  | "RULE_NOT_FOUND"
  | "DUPLICATE_RULE_CODE"
  | "INVALID_RULE_TYPE"
  | "RULE_TYPE_NOT_AUTHORIZED"
  | "INVALID_PERCENTAGES"
  | "RULE_INACTIVE"
  | "SOURCE_COST_CENTRE_INVALID"
  | "SOURCE_COST_CENTRE_INACTIVE"
  | "DIRECT_BRANCH_EXPENSE_NOT_ALLOCATABLE"
  | "SOURCE_ACCOUNT_INVALID"
  | "ACCOUNT_NOT_ELIGIBLE_FOR_ALLOCATION"
  | "ACCOUNT_ROUNDING_PROHIBITED"
  | "TARGET_COST_CENTRE_INVALID"
  | "TARGET_COST_CENTRE_INACTIVE"
  | "TARGET_CANNOT_BE_SOURCE"
  | "DUPLICATE_TARGET_COST_CENTRE"
  | "INVALID_TARGET_PERCENTAGE"
  | "PERCENTAGE_SUM_INVALID"
  | "NO_TARGETS_CONFIGURED"
  | "NO_SOURCE_EXPENSES_FOUND"
  | "SOURCE_LINE_ALREADY_ALLOCATED"
  | "RUN_NOT_FOUND"
  | "DUPLICATE_RUN_NUMBER"
  | "INVALID_RUN_STATUS"
  | "IMMUTABLE_RECORD"
  | "TARGET_NOT_FOUND"
  | "RUN_ALREADY_POSTED"
  | "RUN_ALREADY_REVERSED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "FISCAL_PERIOD_LOCKED"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "POSTING_BEFORE_ACCOUNTING_START_DATE"
  | "PERMISSION_DENIED"
  | "OPERATION_FAILED";

export class CostAllocationRepositoryError extends Error {
  readonly code: CostAllocationErrorCode;
  readonly statusCode: number;

  constructor(code: CostAllocationErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "CostAllocationRepositoryError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class CostAllocationDomainError extends Error {
  readonly code: CostAllocationErrorCode;
  readonly statusCode: number;

  constructor(code: CostAllocationErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "CostAllocationDomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface CostAllocationCalculatedTarget {
  target_cost_centre_id: string;
  target_cost_centre_code?: string;
  target_cost_centre_name?: string;
  target_account_id: string;
  target_account_code?: string;
  target_account_name?: string;
  target_percentage: number;
  allocated_cents: number;
  allocated_amount: number;
  sort_order: number;
}

export interface CostAllocationPreviewSourceLine {
  id: string;
  journal_entry_id: string;
  entry_no: string;
  voucher_id: string;
  voucher_no: string;
  entry_date: string;
  debit_amount: number;
  narration: string | null;
}

export interface CostAllocationPreviewLineItem {
  source_journal_line_id: string;
  target_cost_centre_id: string;
  target_cost_centre_code?: string;
  target_account_id: string;
  target_account_code?: string;
  target_percentage: number;
  allocated_amount: number;
  sort_order: number;
}

export interface CostAllocationPreviewResult {
  rule: CostAllocationRuleWithTargets;
  fiscal_year: string;
  period_name: string;
  allocation_date: string;
  total_source_amount: number;
  total_allocated_amount: number;
  rounding_difference: number;
  source_journal_lines: CostAllocationPreviewSourceLine[];
  calculated_lines: CostAllocationPreviewLineItem[];
}

export interface PreviewCostAllocationParams {
  ruleId: string;
  fiscalYear?: string;
  periodName?: string;
  allocationDate: string;
  sourceJournalLineIds?: string[];
  actorContext?: any;
}

export interface ExecuteCostAllocationRunParams {
  ruleId: string;
  fiscalYear: string;
  periodName: string;
  allocationDate: string;
  executedBy: string;
  narration?: string;
  sourceJournalLineIds?: string[];
  status?: "DRAFT" | "SUBMITTED";
  actorContext?: any;
}

export interface ApproveAndPostCostAllocationRunParams {
  runId: string;
  approvedBy: string;
  branchId?: string;
  actorContext?: any;
}

export interface ReverseCostAllocationRunParams {
  runId: string;
  reversalDate: string;
  reason: string;
  reversedBy: string;
  branchId?: string;
  actorContext?: any;
}

export interface CostAllocationRunExecutionResult {
  run: CostAllocationRunRow;
  lines: CostAllocationRunLineRow[];
}

export interface CostAllocationPostingResult {
  run: CostAllocationRunRow;
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
}

export interface CostAllocationReversalResult {
  run: CostAllocationRunRow;
  original_voucher: AccountingVoucherRow;
  reversal_voucher: AccountingVoucherRow;
  reversal_journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
}


// ─── Phase C7.7: Corporate Gifting Types ──────────────────────────────────────

export type CorporateGiftingBatchStatus =
  | "DRAFT"
  | "VALIDATED"
  | "SCHEDULED"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type CorporateGiftingRecipientValidationStatus =
  | "PENDING"
  | "VALID"
  | "INVALID";

export type CorporateGiftingRecipientStatus =
  | "PENDING"
  | "ORDER_CREATED"
  | "DISPATCHED"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export interface CorporateGiftingBatchRow {
  id: string;
  customer_id: string;
  company_id: string | null;
  batch_name: string;
  source_filename: string;
  file_hash: string;
  file_size_bytes: number | null;
  status: CorporateGiftingBatchStatus;
  total_recipients: number;
  total_amount: number;
  validated_recipients: number;
  invalid_recipients: number;
  processed_recipients: number;
  scheduled_delivery_date: string | null;
  invoice_id: string | null;
  order_id: string | null;
  cost_centre_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  deleted_at: string | null;
}

export interface CorporateGiftingRecipientRow {
  id: string;
  batch_id: string;
  row_number: number;
  employee_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  delivery_pincode: string;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_date: string;
  delivery_slot: string | null;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  gift_message: string | null;
  validation_status: CorporateGiftingRecipientValidationStatus;
  validation_errors: Array<{ field?: string; message: string; code?: string }> | null;
  order_id: string | null;
  delivery_id: string | null;
  status: CorporateGiftingRecipientStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export * from "./teller.types";

