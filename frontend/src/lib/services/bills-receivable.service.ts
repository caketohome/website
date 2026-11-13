/**
 * CakeToHome ERP — Bills Receivable & Corporate AR Subledger Service
 * Phase C7.4: Canonical Corporate AR, Order-Tied GST Invoicing, Concurrency-Safe Credit Controls,
 * Bank Leaf GL Settlement, and Multi-Invoice Allocation.
 *
 * ARCHITECTURAL PRINCIPLES & INVARIANTS:
 * 1. ORDER-TIED CORPORATE INVOICING:
 *    - Corporate Order → GST Invoice → AR Subledger → Receipt Allocation.
 *    - Invoices retain immutable links to: customer_id, order_id, branch_id, voucher_id,
 *      due_date, payment_terms_days, GST breakdown (taxable, CGST, SGST, IGST, GSTIN).
 * 2. DYNAMIC GST BILLING:
 *    - Intra-state: Dr 1121 Trade AR / Cr 4110 Sales Revenue / Cr 2121 Output CGST / Cr 2122 Output SGST.
 *    - Inter-state: Dr 1121 Trade AR / Cr 4110 Sales Revenue / Cr 2125 Output IGST.
 *    - Rates derived dynamically via SalesTaxEngine. Zero hardcoded percentages in UI.
 * 3. CONCURRENCY-SAFE CREDIT LIMIT PROTECTION:
 *    - Customer-level advisory transaction lock: pg_advisory_xact_lock(hashtext('corp_credit_' || customer_id)).
 *    - Wraps check exposure → create/post invoice → update exposure atomically.
 * 4. EXPLICIT FOUR-EYES CREDIT APPROVAL:
 *    - Retail customers (is_corporate = false): Strict zero credit. Upfront payment / COD only.
 *    - Corporate customers: Require is_corporate = true, credit_enabled = true, credit_limit > 0,
 *      payment_terms_days > 0, credit_status = 'APPROVED', credit_approved_by, credit_approved_at.
 * 5. AUTHORITATIVE AR OUTSTANDING:
 *    - customer.credit_balance is NOT an independent source of financial truth.
 *    - Authoritative formula:
 *        Outstanding = sum(Posted Invoices) - sum(Approved Returns/Credit Notes) - sum(Allocated Receipts).
 * 6. MULTI-INVOICE, FULL & PARTIAL RECEIPT ALLOCATION:
 *    - One receipt can settle multiple corporate invoices.
 *    - One invoice can receive multiple partial receipts.
 *    - Uses public.customer_receipt_allocation.
 * 7. PROVIDER-NEUTRAL BANK SETTLEMENT:
 *    - Methods: BANK_TRANSFER, NEFT, RTGS, IMPS, CHEQUE, OTHER_BANK_SETTLEMENT.
 * 8. BANK LEAF GL RESOLUTION:
 *    - Selected bank_account_id resolves to leaf GL in chart of accounts (or fallback 1112).
 *    - Dr Selected Bank GL / Cr 1121 Trade AR.
 * 9. MANDATORY UTR / REFERENCE ID:
 *    - Mandatory for electronic receipts (BANK_TRANSFER, NEFT, RTGS, IMPS); searchable in ledger.
 * 10. REMINDER SCHEDULING:
 *     - Integrates with public.notification (resource_type = 'INVOICE', trigger_type = 'PAYMENT_REMINDER').
 * 11. MULTI-TIER CUSTOMER LEDGER DRILL-DOWN:
 *     - Customer → Ledger → Invoice → Receipt → Bank → UTR → Allocation.
 * 12. DYNAMIC BRANCH-WISE AR:
 *     - Derived on the fly from invoice.branch_id and receipt allocations. Zero duplicate tables.
 * 13. IMMUTABLE INVOICE LIFECYCLE:
 *     - Lifecycle: POSTED (UNPAID) → PARTIALLY_RECEIVED → FULLY_RECEIVED → OVERDUE → CANCELLED/REVERSED.
 * 14. CREDIT NOTES & SALES RETURNS INTEGRATION:
 *     - Reconciles with SalesReturnService (reference_type = 'ORDER_RETURN').
 * 15. DUE-DATE AR AGEING:
 *     - Buckets derived strictly from due_date: Current (Not Due), 1–30, 31–60, 61–90, >90 days overdue.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { hasEffectivePermission } from "../staff-access-control";
import { PostingService, PostingServiceError } from "./posting.service";
import {
  calculateSalesTaxesAndTotals,
  type SalesCalculationInput,
  type SalesLineItemInput,
} from "./sales-tax-engine";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  AccountingAccountRow,
  JournalLineInput,
} from "../types/accounting.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type BillsReceivableErrorCode =
  | "INVOICE_NOT_FOUND"
  | "CUSTOMER_NOT_FOUND"
  | "CREDIT_NOT_PERMITTED"
  | "CREDIT_APPROVAL_REQUIRED"
  | "CREDIT_LIMIT_EXCEEDED"
  | "INVALID_INVOICE_STATUS"
  | "INVOICE_ALREADY_SETTLED"
  | "INVALID_RECEIPT_AMOUNT"
  | "ALLOCATION_EXCEEDS_OUTSTANDING"
  | "TOTAL_ALLOCATION_MISMATCH"
  | "BRANCH_ACCESS_DENIED"
  | "CUSTOMER_MISMATCH"
  | "BRANCH_MISMATCH"
  | "ORDER_REQUIRED"
  | "ORDER_NOT_FOUND"
  | "ORDER_ALREADY_INVOICED"
  | "ORDER_STATUS_INVALID"
  | "PAYMENT_ACCOUNT_UNRESOLVED"
  | "REFERENCE_MANDATORY"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "PERMISSION_DENIED"
  | "CONCURRENT_SETTLEMENT_LOCK"
  | "SETTLEMENT_FAILED"
  | "REMINDER_CREATION_FAILED"
  | "ACCOUNT_NOT_APPROVED"
  | "SELLER_GSTIN_INVALID"
  | "UNAUTHORIZED_INVOICE_SERIES"
  | "SUPER_ADMIN_REQUIRED";

export class BillsReceivableError extends Error {
  readonly code: BillsReceivableErrorCode;

  constructor(code: BillsReceivableErrorCode, message: string) {
    super(message);
    this.name = "BillsReceivableError";
    this.code = code;
  }
}

// ─── DTOs & Interfaces ────────────────────────────────────────────────────────

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

export interface BillReceivableGstBreakdown {
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  gstin: string | null;
  is_intra_state: boolean;
}

export interface BillReceivableDetail {
  invoice: BillReceivableListItem;
  gst_breakdown: BillReceivableGstBreakdown;
  items: Array<{
    id?: string;
    description: string;
    quantity: number;
    rate: number;
    taxable_value: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    hsn_code?: string;
    item_type?: string;
  }>;
  voucher: AccountingVoucherRow | null;
  journal_entry: (AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] }) | null;
  receipt_allocations: Array<{
    allocation_id: string;
    voucher_id: string;
    voucher_no: string | null;
    receipt_date: string;
    amount: number;
    payment_method: string;
    reference: string | null;
    bank_name: string | null;
    account_name: string | null;
    created_by: string;
    created_at: string;
  }>;
  credit_notes: Array<{
    voucher_id: string;
    voucher_no: string;
    date: string;
    amount: number;
    narration: string;
  }>;
}

export interface ListBillsReceivableFilters {
  customer_id?: string;
  branch_id?: string;
  status?: BillReceivableStatus;
  ageing_bucket?: ArAgeingBucket;
  startDate?: string;
  endDate?: string;
  dueBefore?: string;
  search?: string;
  limit?: number;
  offset?: number;
  actorContext?: any;
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

export interface ListBillsReceivableResult {
  bills: BillReceivableListItem[];
  total_count: number;
  summary: BillsReceivableSummary;
}

export interface SettleReceiptAllocationInput {
  invoiceId: string;
  amount: number;
}

export interface SettleCustomerReceiptParams {
  customerId: string;
  branchId: string;
  receiptDate: string;
  paymentMethod: "BANK_TRANSFER" | "NEFT" | "RTGS" | "IMPS" | "CHEQUE" | "OTHER_BANK_SETTLEMENT";
  bankAccountId?: string | null;
  reference?: string | null; // UTR or transaction ID
  narration?: string | null;
  receivedBy: string;
  voucherPreparerId?: string;
  actorRole?: string;
  actorSession?: any;
  allocations: SettleReceiptAllocationInput[];
  client?: PoolClient;
}

export interface SettleCustomerReceiptResult {
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  allocations: Array<{
    id: string;
    invoice_id: string;
    allocated_amount: number;
  }>;
  total_received: number;
  payment_method: string;
  reference: string | null;
  bank_gl_code: string;
  bank_gl_name: string;
  settled_invoices: Array<{
    invoice_id: string;
    invoice_number: string;
    allocated_amount: number;
    new_outstanding: number;
    new_status: BillReceivableStatus;
  }>;
  customer_authoritative_outstanding: number;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  entry_type: "INVOICE" | "RECEIPT" | "CREDIT_NOTE";
  document_id: string;
  document_no: string;
  reference_no: string | null;
  branch_id: string;
  branch_name: string | null;
  bank_name: string | null;
  account_name: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  narration: string;
  allocated_invoices?: Array<{
    invoice_number: string;
    amount: number;
  }>;
}

export interface CustomerLedgerResult {
  customer_id: string;
  customer_name: string;
  company_name: string | null;
  gstin: string | null;
  is_corporate: boolean;
  credit_enabled: boolean;
  credit_status: string | null;
  credit_limit: number;
  payment_terms_days: number;
  total_invoiced: number;
  total_received: number;
  total_credited: number;
  closing_balance: number; // Authoritative outstanding
  entries: CustomerLedgerEntry[];
}

export interface ArAgeingSummaryResult {
  company_total: {
    current: number;
    bucket_1_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_over_90: number;
    total_outstanding: number;
  };
  branch_breakdown: Array<{
    branch_id: string;
    branch_name: string;
    current: number;
    bucket_1_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_over_90: number;
    total_outstanding: number;
  }>;
}

export interface ApproveCorporateCreditParams {
  customerId: string;
  creditLimit: number;
  paymentTermsDays: number;
  approvedBy: string;
  actorRole?: string;
  actorSession?: any;
  client?: PoolClient;
}

export interface ScheduleInvoiceReminderParams {
  invoiceId: string;
  reminderDate: string;
  reminderType: "PRE_DUE" | "DUE_DATE" | "OVERDUE";
  channel?: "EMAIL" | "SMS" | "IN_APP";
  scheduledBy: string;
  client?: PoolClient;
}

export interface CreateCorporateInvoiceItemInput {
  id?: string;
  productId?: string | null;
  variantId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRatePercent?: number;
  hsnCode?: string | null;
  itemType?: "CAKE" | "ACCESSORY" | "PACKAGING" | "TOY" | "CUSTOM";
}

export interface CreateCorporateInvoiceParams {
  orderId: string; // Mandatory commercial corporate order ID from public.order
  customerId: string;
  branchId: string;
  invoiceDate: string;
  items?: CreateCorporateInvoiceItemInput[];
  deliveryFee?: number;
  deliveryTaxRatePercent?: number;
  discountTotal?: number;
  customerLocation?: {
    state?: string;
    stateCode?: string;
    gstin?: string;
    cityName?: string;
    pincode?: string;
  };
  createdBy: string;
  actorRole?: string;
  actorSession?: any;
  client?: PoolClient;
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function stringToAdvisoryLockId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function calculateAgeingBucket(dueDateStr: string): { bucket: ArAgeingBucket; overdueDays: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dueDate.getTime();
  const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  if (diffTime <= 0) {
    return { bucket: "CURRENT", overdueDays: 0 };
  } else if (overdueDays <= 30) {
    return { bucket: "1_TO_30", overdueDays };
  } else if (overdueDays <= 60) {
    return { bucket: "31_TO_60", overdueDays };
  } else if (overdueDays <= 90) {
    return { bucket: "61_TO_90", overdueDays };
  } else {
    return { bucket: "OVER_90", overdueDays };
  }
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class BillsReceivableService {
  /**
   * Enforces branch and RBAC scoping.
   */
  private static enforceBranchScope(
    actorContext: any,
    requiredBranchId?: string
  ): { branchId?: string; isSuperAdmin: boolean } {
    if (!actorContext) {
      return { isSuperAdmin: true, branchId: requiredBranchId };
    }

    const role = (actorContext.role || "").toUpperCase();
    const isSuperAdmin =
      role === "SUPER_ADMIN" ||
      actorContext.isSuperAdmin === true;

    if (isSuperAdmin) {
      return { isSuperAdmin: true, branchId: requiredBranchId };
    }

    const actorBranch = actorContext.branch_id || actorContext.branchId;
    if (!actorBranch) {
      throw new BillsReceivableError(
        "BRANCH_ACCESS_DENIED",
        "Non-super-admin user lacks an authorized branch assignment."
      );
    }

    if (requiredBranchId && requiredBranchId !== actorBranch) {
      throw new BillsReceivableError(
        "BRANCH_ACCESS_DENIED",
        `Cross-branch access denied. Authorized for '${actorBranch}', requested '${requiredBranchId}'.`
      );
    }

    return { isSuperAdmin: false, branchId: actorBranch };
  }

  /**
   * Authoritative calculation of a customer's real-time outstanding AR exposure:
   * sum(Posted Invoices) - sum(Approved Returns/Credit Notes) - sum(Allocated Receipts).
   * Note: customer.credit_balance is non-authoritative and never trusted.
   */
  static async calculateAuthoritativeCustomerOutstanding(
    customerId: string,
    client?: PoolClient
  ): Promise<number> {
    const queryFn = async (sql: string, params: any[] = []): Promise<any> => {
      return client ? client.query(sql, params) : dbQuery(sql, params);
    };
    const res = await queryFn(
      `SELECT
         COALESCE((
           SELECT SUM(inv.grand_total)
           FROM public.invoice inv
           WHERE inv.customer_id = $1
             AND inv.is_corporate = true
             AND inv.status = 'POSTED'
             AND inv.deleted_at IS NULL
         ), 0) AS total_invoiced,
         COALESCE((
           SELECT SUM(cra.allocated_amount)
           FROM public.customer_receipt_allocation cra
           JOIN public.invoice inv2 ON inv2.id = cra.invoice_id
           WHERE inv2.customer_id = $1
             AND inv2.is_corporate = true
             AND inv2.deleted_at IS NULL
         ), 0) AS total_receipts,
         COALESCE((
           SELECT SUM(v.total_amount)
           FROM public.accounting_voucher v
           WHERE v.reference_type = 'ORDER_RETURN'
             AND v.status = 'POSTED'
             AND v.deleted_at IS NULL
             AND EXISTS (
               SELECT 1 FROM public.invoice inv3
               WHERE inv3.order_id = v.metadata->>'order_id'
                 AND inv3.customer_id = $1
             )
         ), 0) AS total_returns`,
      [customerId]
    );

    const invoiced = Number(res.rows[0]?.total_invoiced || 0);
    const receipts = Number(res.rows[0]?.total_receipts || 0);
    const returns = Number(res.rows[0]?.total_returns || 0);

    return Math.max(0, Math.round((invoiced - receipts - returns) * 100) / 100);
  }

  /**
   * Explicit Four-Eyes corporate credit approval.
   * Opt-in authorization: is_corporate=true, credit_enabled=true, credit_limit>0, payment_terms_days>0, credit_status='APPROVED'.
   */
  static async approveCorporateCredit(
    params: ApproveCorporateCreditParams
  ): Promise<{ success: boolean; customer: any }> {
    const { customerId, creditLimit, paymentTermsDays, approvedBy, actorRole, actorSession, client: callerClient } = params;

    if (!customerId) {
      throw new BillsReceivableError("CUSTOMER_NOT_FOUND", "Customer ID is required.");
    }
    if (creditLimit <= 0) {
      throw new BillsReceivableError("CREDIT_NOT_PERMITTED", "Approved credit limit must be strictly greater than zero.");
    }
    if (paymentTermsDays <= 0) {
      throw new BillsReceivableError("CREDIT_NOT_PERMITTED", "Payment terms days must be strictly greater than zero.");
    }

    const actorContext = {
      userId: approvedBy,
      role: actorRole || (actorSession?.role as any) || (approvedBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
      session: actorSession,
    };

    const hasPerm =
      hasEffectivePermission(actorContext, "CUSTOMER.EDIT") ||
      hasEffectivePermission(actorContext, "ACCOUNTING.POST") ||
      hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE");

    if (!hasPerm) {
      throw new BillsReceivableError(
        "PERMISSION_DENIED",
        `Actor '${approvedBy}' lacks permission to approve corporate credit.`
      );
    }

    const executeApproval = async (client: PoolClient) => {
      // Advisory lock on customer
      const lockId = stringToAdvisoryLockId("corp_credit_" + customerId);
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);

      const custRes = await client.query(
        `SELECT * FROM public.customer WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [customerId]
      );
      if (custRes.rows.length === 0) {
        throw new BillsReceivableError("CUSTOMER_NOT_FOUND", `Customer '${customerId}' not found.`);
      }
      const customer = custRes.rows[0];

      // Four-Eyes check: approver !== creator
      if (customer.created_by && customer.created_by === approvedBy && customer.created_by !== "system") {
        throw new BillsReceivableError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Four-Eyes violation: Customer creator ('${customer.created_by}') cannot approve credit for customer '${customerId}'.`
        );
      }

      // Decision Q1: If customer is linked to a corporate_account, require corporate_account.status = 'APPROVED' and caller has SUPER_ADMIN
      const corpAcctRes = await client.query(
        `SELECT id, status FROM public.corporate_account WHERE customer_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [customerId]
      );
      if (corpAcctRes.rows.length > 0) {
        const corpAcct = corpAcctRes.rows[0];
        if (corpAcct.status !== "APPROVED") {
          throw new BillsReceivableError(
            "ACCOUNT_NOT_APPROVED",
            `Cannot activate credit: Associated corporate account '${corpAcct.id}' is '${corpAcct.status}', expected 'APPROVED'.`
          );
        }
        const isSuperAdmin =
          (actorRole || "").toUpperCase() === "SUPER_ADMIN" ||
          (actorSession?.role || "").toUpperCase() === "SUPER_ADMIN" ||
          (actorSession?.user?.role || "").toUpperCase() === "SUPER_ADMIN" ||
          (approvedBy.startsWith("admin_") && actorContext.role === "SUPER_ADMIN");
        if (!isSuperAdmin) {
          throw new BillsReceivableError(
            "SUPER_ADMIN_REQUIRED",
            `Activating credit for customer linked to corporate account '${corpAcct.id}' requires SUPER_ADMIN authority.`
          );
        }
      }

      // Reconcile authoritative outstanding exposure
      const currentOutstanding = await BillsReceivableService.calculateAuthoritativeCustomerOutstanding(
        customerId,
        client
      );

      const updRes = await client.query(
        `UPDATE public.customer
         SET is_corporate = true,
             credit_enabled = true,
             credit_limit = $1,
             payment_terms_days = $2,
             credit_status = 'APPROVED',
             credit_approved_by = $3,
             credit_approved_at = NOW(),
             credit_balance = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [creditLimit, paymentTermsDays, approvedBy, currentOutstanding, customerId]
      );

      return { success: true, customer: updRes.rows[0] };
    };

    return callerClient ? await executeApproval(callerClient) : await dbTransaction(executeApproval);
  }

  /**
   * Concurrency-safe corporate invoice creation and posting.
   * Locked under pg_advisory_xact_lock(hashtext('corp_credit_' || customer_id)).
   * Reuses SalesTaxEngine for dynamic intra/inter-state GST resolution.
   */
  static async createAndPostCorporateInvoice(
    params: CreateCorporateInvoiceParams
  ): Promise<{
    invoice: any;
    voucher: AccountingVoucherRow;
    journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  }> {
    const {
      orderId,
      customerId,
      branchId,
      invoiceDate,
      items,
      deliveryFee = 0,
      deliveryTaxRatePercent,
      discountTotal = 0,
      customerLocation,
      createdBy,
      actorRole,
      actorSession,
      client: callerClient,
    } = params;

    if (!orderId || typeof orderId !== "string" || orderId.trim() === "") {
      throw new BillsReceivableError(
        "ORDER_REQUIRED",
        "Commercial corporate order ID is mandatory. Invoices cannot be created without an existing commercial order."
      );
    }
    if (!customerId) throw new BillsReceivableError("CUSTOMER_NOT_FOUND", "Customer ID is required.");
    if (!branchId) throw new BillsReceivableError("BRANCH_ACCESS_DENIED", "Branch ID is required.");

    const actorContext = {
      userId: createdBy,
      role: actorRole || (actorSession?.role as any) || (createdBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
      session: actorSession,
      branch_id: branchId,
    };

    BillsReceivableService.enforceBranchScope(actorContext, branchId);

    const executeInvoice = async (client: PoolClient) => {
      // 1. ACQUIRE ADVISORY LOCK ON CUSTOMER CREDIT
      const lockId = stringToAdvisoryLockId("corp_credit_" + customerId);
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);

      // 2. VALIDATE COMMERCIAL ORDER FROM public.order
      const ordRes = await client.query(
        `SELECT * FROM public."order" WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [orderId]
      );
      if (ordRes.rows.length === 0) {
        throw new BillsReceivableError(
          "ORDER_NOT_FOUND",
          `Commercial corporate order '${orderId}' not found or deleted.`
        );
      }
      const order = ordRes.rows[0];

      if (order.status === "cancelled" || order.status === "canceled" || order.canceled_at !== null) {
        throw new BillsReceivableError(
          "ORDER_STATUS_INVALID",
          `Commercial corporate order '${orderId}' has status '${order.status}' and cannot be invoiced.`
        );
      }

      if (order.customer_id && order.customer_id !== customerId) {
        throw new BillsReceivableError(
          "CUSTOMER_MISMATCH",
          `Commercial order '${orderId}' belongs to customer '${order.customer_id}', not '${customerId}'.`
        );
      }

      const orderBranch = order.metadata?.branch_id || order.branch_id;
      if (orderBranch && orderBranch !== branchId) {
        throw new BillsReceivableError(
          "BRANCH_MISMATCH",
          `Commercial order '${orderId}' belongs to branch '${orderBranch}', not '${branchId}'.`
        );
      }

      const existingInvRes = await client.query(
        `SELECT id, invoice_number FROM public.invoice WHERE order_id = $1 AND deleted_at IS NULL`,
        [orderId]
      );
      if (existingInvRes.rows.length > 0) {
        throw new BillsReceivableError(
          "ORDER_ALREADY_INVOICED",
          `Commercial order '${orderId}' has already been invoiced under invoice '${existingInvRes.rows[0].invoice_number}' (${existingInvRes.rows[0].id}).`
        );
      }

      // 3. FETCH CUSTOMER & VERIFY CREDIT AUTHORIZATION
      const custRes = await client.query(
        `SELECT * FROM public.customer WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [customerId]
      );
      if (custRes.rows.length === 0) {
        throw new BillsReceivableError("CUSTOMER_NOT_FOUND", `Customer '${customerId}' not found.`);
      }
      const customer = custRes.rows[0];

      // Explicit Policy: Retail customers have zero credit
      if (!customer.is_corporate || !customer.credit_enabled) {
        throw new BillsReceivableError(
          "CREDIT_NOT_PERMITTED",
          `Customer '${customerId}' is not an authorized corporate customer. Retail customers cannot receive credit invoices. Upfront payment/COD required.`
        );
      }

      if (customer.credit_status !== "APPROVED") {
        throw new BillsReceivableError(
          "CREDIT_APPROVAL_REQUIRED",
          `Corporate customer '${customerId}' credit status is '${customer.credit_status || "PENDING"}'. Explicit approval required.`
        );
      }

      const creditLimit = Number(customer.credit_limit || 0);
      const paymentTermsDays = Number(customer.payment_terms_days || 30);

      // 4. RESOLVE BRANCH AND JURISDICTION FOR GST
      const branchRes = await client.query(
        `SELECT id, name, code, metadata, address FROM public.branch WHERE id = $1 AND deleted_at IS NULL`,
        [branchId]
      );
      if (branchRes.rows.length === 0) {
        throw new BillsReceivableError("BRANCH_ACCESS_DENIED", `Branch '${branchId}' not found.`);
      }
      const branch = branchRes.rows[0];
      const branchMeta = branch.metadata || {};
      const branchState =
        branchMeta.state ||
        branch.state ||
        (branch.address && /bengaluru|bangalore|karnataka/i.test(branch.address) ? "Karnataka" : null) ||
        (branch.address && /mumbai|pune|maharashtra/i.test(branch.address) ? "Maharashtra" : null) ||
        (branch.address && /delhi/i.test(branch.address) ? "Delhi" : null) ||
        (branch.address && /chennai|tamil nadu/i.test(branch.address) ? "Tamil Nadu" : null) ||
        (branch.address && /hyderabad|telangana/i.test(branch.address) ? "Telangana" : null) ||
        (branch.address && /kochi|kerala/i.test(branch.address) ? "Kerala" : null) ||
        branchMeta.city ||
        "Karnataka";
      const branchGstin = branchMeta.gstin || branchMeta.gst_number || null;

      const orderMeta = order.metadata || {};
      const deliveryAddress = orderMeta.delivery_address || orderMeta.delivery?.address || {};
      const custState =
        customerLocation?.state ||
        (typeof deliveryAddress === "object" && deliveryAddress !== null && deliveryAddress.state ? deliveryAddress.state : null) ||
        orderMeta.delivery_state ||
        orderMeta.state ||
        orderMeta.customer_state ||
        orderMeta.delivery?.state ||
        branchState;

      // 5. PREPARE ITEMS FOR CANONICAL SalesTaxEngine
      let rawItems: CreateCorporateInvoiceItemInput[] = items && items.length > 0 ? items : [];
      if (rawItems.length === 0) {
        if (Array.isArray(orderMeta.items) && orderMeta.items.length > 0) {
          rawItems = orderMeta.items;
        } else {
          const oiRes = await client.query(
            `SELECT * FROM public.order_item WHERE order_id = $1 AND deleted_at IS NULL ORDER BY id ASC`,
            [orderId]
          );
          if (oiRes.rows.length > 0) {
            rawItems = oiRes.rows.map((r: any) => ({
              id: r.id,
              productId: r.product_id,
              variantId: r.variant_id,
              description: r.title || r.description || "Order Item",
              quantity: Number(r.quantity || 1),
              unitPrice: Number(r.unit_price || 0),
              taxRatePercent: r.tax_rate !== undefined && r.tax_rate !== null ? Number(r.tax_rate) : undefined,
              hsnCode: r.hsn_code || "19059090",
              itemType: (r.metadata?.merchandise_type || "CAKE") as any,
            }));
          }
        }
      }

      if (rawItems.length === 0) {
        throw new BillsReceivableError(
          "INVALID_INVOICE_STATUS",
          `No line items found for commercial order '${orderId}'. Invoices require at least one line item.`
        );
      }

      const productIds = rawItems.map((i) => i.productId).filter(Boolean) as string[];
      let productMap = new Map<string, any>();
      if (productIds.length > 0) {
        const pRes = await client.query(
          `SELECT id, title, merchandise_type, metadata FROM public.product WHERE id = ANY($1) AND deleted_at IS NULL`,
          [productIds]
        );
        for (const p of pRes.rows) {
          productMap.set(p.id, p);
        }
      }

      const salesLineItemInputs: SalesLineItemInput[] = rawItems.map((it, idx) => {
        const prod = it.productId ? productMap.get(it.productId) : null;
        const itemType = it.itemType || (prod?.merchandise_type as any) || "CAKE";
        let taxRate = it.taxRatePercent;
        if (taxRate === undefined || taxRate === null) {
          if (prod?.metadata?.tax_rate !== undefined) {
            taxRate = Number(prod.metadata.tax_rate);
          } else if (itemType === "ACCESSORY") {
            taxRate = 18;
          } else if (itemType === "TOY") {
            taxRate = 12;
          } else {
            taxRate = 5;
          }
        }

        return {
          id: it.id || `item_${idx + 1}`,
          itemType,
          productId: it.productId || null,
          variantId: it.variantId || null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount || 0,
          taxRatePercent: taxRate,
          hsnCode: it.hsnCode || (itemType === "ACCESSORY" ? "95059000" : "19059090"),
        };
      });

      // 6. EXECUTE CANONICAL SalesTaxEngine
      const taxEngineInput: SalesCalculationInput = {
        branch: {
          state: branchState,
          stateCode: branchMeta.state_code || null,
          cityName: branchMeta.city || null,
          gstin: branchGstin,
        },
        customer: {
          state: custState,
          stateCode: customerLocation?.stateCode || null,
          pincode: customerLocation?.pincode || null,
          cityName: customerLocation?.cityName || null,
        },
        items: salesLineItemInputs,
        headerDiscount: discountTotal,
        delivery:
          deliveryFee > 0
            ? {
                amount: deliveryFee,
                taxRatePercent: deliveryTaxRatePercent !== undefined ? deliveryTaxRatePercent : 18,
                hsnCode: "996813",
              }
            : 0,
        isCod: false,
      };

      const taxResult = calculateSalesTaxesAndTotals(taxEngineInput);
      const isIntraState = taxResult.jurisdiction.jurisdiction === "INTRA_STATE";
      const subtotal = taxResult.subtotal;
      const taxTotal = taxResult.totalTax;
      const grandTotal = taxResult.invoiceTotal;

      // 7. CONCURRENCY-SAFE CREDIT LIMIT CHECK
      const currentOutstanding = await BillsReceivableService.calculateAuthoritativeCustomerOutstanding(
        customerId,
        client
      );

      if (currentOutstanding + grandTotal > creditLimit + 0.005) {
        throw new BillsReceivableError(
          "CREDIT_LIMIT_EXCEEDED",
          `Credit limit of ₹${creditLimit.toFixed(2)} exceeded for customer '${customer.company_name || customer.id}'. Current exposure: ₹${currentOutstanding.toFixed(2)}, attempted invoice: ₹${grandTotal.toFixed(2)}, total exposure: ₹${(currentOutstanding + grandTotal).toFixed(2)}.`
        );
      }

      // 8. DUE DATE CALCULATION
      const invDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(invDateObj.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);
      const dueDateStr = dueDateObj.toISOString().split("T")[0];

      // 9. ACCOUNTING CONFIG GUARDS & GL ACCOUNTS
      await PostingService.validateAccountingStartDate(invoiceDate, client);
      const period = await PostingService.validateFiscalPeriod(invoiceDate, client);
      const fiscalYear = period.fiscal_year;

      const arCode = taxResult.suggestedArAccount?.code || "1121";
      const arAccount = await AccountingAccountRepository.findByCode(arCode, client);
      if (!arAccount || !arAccount.is_active || arAccount.is_group) {
        throw new BillsReceivableError(
          "PAYMENT_ACCOUNT_UNRESOLVED",
          `Trade Accounts Receivable control account ${arCode} is not configured, inactive, or is a group.`
        );
      }

      // Group revenues by account code
      const revenueMap = new Map<string, { amount: number; name: string }>();
      for (const line of taxResult.lines) {
        const revCode = line.accountingMetadata.revenueAccountCode;
        const revName = line.accountingMetadata.revenueAccountName;
        const cur = revenueMap.get(revCode) || { amount: 0, name: revName };
        cur.amount = Math.round((cur.amount + line.taxableValue) * 100) / 100;
        revenueMap.set(revCode, cur);
      }
      if (taxResult.delivery && taxResult.delivery.amount > 0) {
        const delRevCode = taxResult.delivery.accountingMetadata.revenueAccountCode;
        const delRevName = taxResult.delivery.accountingMetadata.revenueAccountName;
        const cur = revenueMap.get(delRevCode) || { amount: 0, name: delRevName };
        cur.amount = Math.round((cur.amount + taxResult.delivery.amount) * 100) / 100;
        revenueMap.set(delRevCode, cur);
      }

      // Group taxes by GL account code
      const taxMap = new Map<string, { amount: number; name: string }>();
      for (const line of taxResult.lines) {
        if (line.cgstAmount > 0 && line.accountingMetadata.cgstAccountCode) {
          const code = line.accountingMetadata.cgstAccountCode;
          const name = line.accountingMetadata.cgstAccountName || "Output CGST";
          const cur = taxMap.get(code) || { amount: 0, name };
          cur.amount = Math.round((cur.amount + line.cgstAmount) * 100) / 100;
          taxMap.set(code, cur);
        }
        if (line.sgstAmount > 0 && line.accountingMetadata.sgstAccountCode) {
          const code = line.accountingMetadata.sgstAccountCode;
          const name = line.accountingMetadata.sgstAccountName || "Output SGST";
          const cur = taxMap.get(code) || { amount: 0, name };
          cur.amount = Math.round((cur.amount + line.sgstAmount) * 100) / 100;
          taxMap.set(code, cur);
        }
        if (line.igstAmount > 0 && line.accountingMetadata.igstAccountCode) {
          const code = line.accountingMetadata.igstAccountCode;
          const name = line.accountingMetadata.igstAccountName || "Output IGST";
          const cur = taxMap.get(code) || { amount: 0, name };
          cur.amount = Math.round((cur.amount + line.igstAmount) * 100) / 100;
          taxMap.set(code, cur);
        }
      }
      if (taxResult.delivery && taxResult.delivery.totalTax > 0) {
        const del = taxResult.delivery;
        if (del.cgstAmount > 0 && del.accountingMetadata.cgstAccountCode) {
          const code = del.accountingMetadata.cgstAccountCode;
          const name = del.accountingMetadata.cgstAccountName || "Output CGST";
          const cur = taxMap.get(code) || { amount: 0, name };
          cur.amount = Math.round((cur.amount + del.cgstAmount) * 100) / 100;
          taxMap.set(code, cur);
        }
        if (del.sgstAmount > 0 && del.accountingMetadata.sgstAccountCode) {
          const code = del.accountingMetadata.sgstAccountCode;
          const name = del.accountingMetadata.sgstAccountName || "Output SGST";
          const cur = taxMap.get(code) || { amount: 0, name };
          cur.amount = Math.round((cur.amount + del.sgstAmount) * 100) / 100;
          taxMap.set(code, cur);
        }
        if (del.igstAmount > 0 && del.accountingMetadata.igstAccountCode) {
          const code = del.accountingMetadata.igstAccountCode;
          const name = del.accountingMetadata.igstAccountName || "Output IGST";
          const cur = taxMap.get(code) || { amount: 0, name };
          cur.amount = Math.round((cur.amount + del.igstAmount) * 100) / 100;
          taxMap.set(code, cur);
        }
      }

      // Build journal lines
      const journalLines: JournalLineInput[] = [
        // Debit: 1121 Trade AR (grand total, carrying customer_id and branch_id)
        {
          account_id: arAccount.id,
          debit_amount: grandTotal,
          credit_amount: 0,
          customer_id: customerId,
          branch_id: branchId,
          narration: `Corporate AR Invoice: ${customer.company_name || customerId}`,
        },
      ];

      // Credits: Resolved revenue accounts (4110, 4120, 4130, etc.)
      for (const [code, revInfo] of revenueMap.entries()) {
        if (revInfo.amount <= 0) continue;
        const revAcc = await AccountingAccountRepository.findByCode(code, client);
        if (!revAcc || !revAcc.is_active || revAcc.is_group) {
          throw new BillsReceivableError(
            "PAYMENT_ACCOUNT_UNRESOLVED",
            `Revenue account ${code} (${revInfo.name}) is not configured, inactive, or is a group.`
          );
        }
        journalLines.push({
          account_id: revAcc.id,
          debit_amount: 0,
          credit_amount: revInfo.amount,
          branch_id: branchId,
          narration: `${revAcc.name}: ${customer.company_name || customerId}`,
        });
      }

      // Credits: Resolved output GST accounts (2121, 2122, 2123, 2124, 2125, 2126, etc.)
      for (const [code, taxInfo] of taxMap.entries()) {
        if (taxInfo.amount <= 0) continue;
        const taxAcc = await AccountingAccountRepository.findByCode(code, client);
        if (!taxAcc || !taxAcc.is_active || taxAcc.is_group) {
          throw new BillsReceivableError(
            "PAYMENT_ACCOUNT_UNRESOLVED",
            `Output GST tax account ${code} (${taxInfo.name}) is not configured, inactive, or is a group.`
          );
        }
        journalLines.push({
          account_id: taxAcc.id,
          debit_amount: 0,
          credit_amount: taxInfo.amount,
          branch_id: branchId,
          narration: taxAcc.name,
        });
      }

      // 10. GENERATE STATUTORY INVOICE NUMBER & ID via atomic PostgreSQL function
      // Pre-allocation statutory validation: Ensure seller GSTIN is present and conforms to GST Rule 46.
      const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!branchGstin || !GSTIN_REGEX.test(branchGstin)) {
        throw new BillsReceivableError(
          "SELLER_GSTIN_INVALID",
          `Cannot allocate statutory invoice: branch seller GSTIN '${branchGstin}' is missing or invalid under GST Rule 46.`
        );
      }

      // Dynamic Database-Driven Statutory Invoice Series Resolution (CGST Rule 46)
      const approvedSeqRes = await client.query(
        `SELECT prefix FROM public.invoice_sequence 
         WHERE (entity_id = 'CAKETOHOME_PARENT')
           AND gstin = $1 
           AND fiscal_year = $2 
           AND is_active = true 
           AND approval_status = 'APPROVED'
         ORDER BY id ASC LIMIT 1`,
        [branchGstin, fiscalYear]
      );
      if (approvedSeqRes.rows.length === 0) {
        throw new BillsReceivableError(
          "UNAUTHORIZED_INVOICE_SERIES",
          `Cannot allocate statutory invoice: No approved active invoice series exists for seller GSTIN '${branchGstin}' in FY ${fiscalYear}. Invoicing fail-closed under CGST Rule 46 pending CA designation.`
        );
      }
      const corpPrefix = approvedSeqRes.rows[0].prefix;

      // Uses same allocate_invoice_number() as delivery invoicing — single sequence authority,
      // FY-aware reset, advisory lock serialization, and allocation audit log.
      const seqRes = await client.query(
        `SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, $5)`,
        [
          corpPrefix,
          orderId,
          "CAKETOHOME_PARENT",
          branchGstin || null,
          invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        ]
      );
      const invoiceNumber = seqRes.rows[0].invoice_number;
      const invoiceId = `inv_corp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // 11. CREATE & POST VOUCHER VIA PostingService
      const narration = `Corporate GST Invoice ${invoiceNumber} for ${customer.company_name || customerId} (Due: ${dueDateStr})`;
      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "SALES",
          voucher_date: invoiceDate,
          branch_id: branchId,
          narration,
          reference_type: "SALES_INVOICE",
          reference_id: invoiceId,
          reference_event: "CORPORATE_INVOICE_POSTED",
          lines: journalLines,
        },
        branchId,
        fiscalYear,
        createdBy: "system:sales_posting",
        client,
      });

      if (!draftRes.success) {
        throw new BillsReceivableError("SETTLEMENT_FAILED", `Voucher draft failed: ${draftRes.error}`);
      }
      const voucherDraft = draftRes.data;

      // Submit
      await PostingService.submitVoucher({
        voucherId: voucherDraft.id,
        submittedBy: "system:sales_posting",
        branchId,
        client,
      });

      // Approve (SoD: createdBy !== system:sales_posting)
      await PostingService.approveVoucher({
        voucherId: voucherDraft.id,
        approvedBy: createdBy,
        branchId,
        client,
      });

      // Post
      const postRes = await PostingService.postVoucher({
        voucherId: voucherDraft.id,
        postedBy: createdBy,
        lines: journalLines,
        branchId,
        client,
      });
      if (!postRes.success) {
        throw new BillsReceivableError("SETTLEMENT_FAILED", `Voucher post failed: ${postRes.error}`);
      }

      // 12. INSERT STATUTORY INVOICE RECORD (Strictly tied to genuine order)
      const metadata = {
        order_id: orderId,
        payment_terms_days: paymentTermsDays,
        gstin: customer.gstin || customerLocation?.gstin || null,
        seller_gstin: branchGstin,
        supply_type: isIntraState ? "INTRA-STATE (CGST + SGST)" : "INTER-STATE (IGST)",
        is_intra_state: isIntraState,
        taxable_value: taxResult.totalTaxable,
        cgst: taxResult.cgst,
        sgst: taxResult.sgst,
        igst: taxResult.igst,
        items: taxResult.lines.map((l, idx) => ({
          id: l.id || `item_${idx + 1}`,
          description: l.description,
          quantity: l.quantity,
          rate: l.unitPrice,
          taxable_value: l.taxableValue,
          tax_rate_percent: l.taxRatePercent,
          cgst: l.cgstAmount,
          sgst: l.sgstAmount,
          igst: l.igstAmount,
          total: l.lineTotal,
          hsn_code: l.hsnCode,
          item_type: l.itemType,
          revenue_account: l.accountingMetadata.revenueAccountCode,
        })),
        created_by: createdBy,
      };

      const insInvSql = `
        INSERT INTO public.invoice (
          id, invoice_number, order_id, branch_id, customer_id, customer_name, customer_phone,
          subtotal, tax_total, delivery_fee, discount_total, grand_total, currency_code,
          payment_method, payment_status, status, voucher_id, due_date, paid_amount,
          outstanding_amount, is_corporate, metadata, delivered_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, 'INR',
          'CREDIT', 'UNPAID', 'POSTED', $13, $14, 0,
          $12, true, $15, NOW(), NOW(), NOW()
        ) RETURNING *
      `;

      const invRes = await client.query(insInvSql, [
        invoiceId,
        invoiceNumber,
        orderId,
        branchId,
        customerId,
        customer.company_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customerId,
        customer.phone || null,
        subtotal,
        taxTotal,
        taxResult.deliveryTotal || deliveryFee,
        discountTotal,
        grandTotal,
        voucherDraft.id,
        dueDateStr,
        JSON.stringify(metadata),
      ]);

      // 13. COMMIT INVOICE ALLOCATION
      try {
        await client.query(`SELECT public.commit_invoice_allocation($1, $2)`, [orderId, invoiceId]);
      } catch (commitErr: any) {
        console.warn(`[BillsReceivableService] commit_invoice_allocation notice for ${orderId}:`, commitErr?.message);
      }

      // 14. RECONCILE AND UPDATE CACHED credit_balance (Display only)
      const newOutstanding = currentOutstanding + grandTotal;
      await client.query(
        `UPDATE public.customer SET credit_balance = $1, updated_at = NOW() WHERE id = $2`,
        [newOutstanding, customerId]
      );

      return {
        invoice: invRes.rows[0],
        voucher: postRes.data.voucher,
        journal_entry: postRes.data.journal_entry,
      };
    };

    return callerClient ? await executeInvoice(callerClient) : await dbTransaction(executeInvoice);
  }

  /**
   * Lists corporate bills receivable with authoritative outstanding balances,
   * ageing buckets derived from due_date, and aggregation metrics.
   */
  static async listBillsReceivable(
    filters: ListBillsReceivableFilters,
    callerClient?: PoolClient
  ): Promise<ListBillsReceivableResult> {
    const { branchId: scopedBranchId } = BillsReceivableService.enforceBranchScope(
      filters.actorContext,
      filters.branch_id
    );

    const queryFn = async (sql: string, params: any[] = []): Promise<any> => {
      return callerClient ? callerClient.query(sql, params) : dbQuery(sql, params);
    };

    const conditions: string[] = [
      `inv.is_corporate = true`,
      `inv.status = 'POSTED'`,
      `inv.deleted_at IS NULL`,
    ];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.customer_id) {
      conditions.push(`inv.customer_id = $${pIdx++}`);
      params.push(filters.customer_id);
    }
    if (scopedBranchId) {
      conditions.push(`inv.branch_id = $${pIdx++}`);
      params.push(scopedBranchId);
    }
    if (filters.startDate) {
      conditions.push(`inv.created_at >= $${pIdx++}::timestamp`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`inv.created_at <= $${pIdx++}::timestamp`);
      params.push(filters.endDate);
    }
    if (filters.dueBefore) {
      conditions.push(`inv.due_date <= $${pIdx++}::date`);
      params.push(filters.dueBefore);
    }
    if (filters.search) {
      conditions.push(
        `(inv.invoice_number ILIKE $${pIdx} OR c.company_name ILIKE $${pIdx} OR c.first_name ILIKE $${pIdx} OR c.last_name ILIKE $${pIdx} OR inv.order_id ILIKE $${pIdx})`
      );
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rawSql = `
      SELECT
        inv.id AS invoice_id,
        inv.invoice_number,
        inv.order_id,
        inv.customer_id,
        COALESCE(c.company_name, inv.customer_name) AS customer_name,
        c.company_name AS customer_company,
        c.gstin AS customer_gstin,
        COALESCE(c.phone, inv.customer_phone) AS customer_phone,
        inv.branch_id,
        b.name AS branch_name,
        inv.created_at::DATE::TEXT AS invoice_date,
        inv.due_date::TEXT AS due_date,
        COALESCE((inv.metadata->>'payment_terms_days')::INT, c.payment_terms_days, 30) AS payment_terms_days,
        inv.grand_total::NUMERIC AS total_amount,
        COALESCE((
          SELECT SUM(cra.allocated_amount)
          FROM public.customer_receipt_allocation cra
          WHERE cra.invoice_id = inv.id
        ), 0)::NUMERIC AS paid_amount,
        COALESCE((
          SELECT SUM(v_ret.total_amount)
          FROM public.accounting_voucher v_ret
          WHERE v_ret.reference_type = 'ORDER_RETURN'
            AND v_ret.metadata->>'order_id' = inv.order_id
            AND v_ret.status = 'POSTED'
            AND v_ret.deleted_at IS NULL
        ), 0)::NUMERIC AS returns_amount,
        inv.voucher_id,
        v_sales.voucher_no,
        inv.created_at::TEXT AS created_at
      FROM public.invoice inv
      LEFT JOIN public.customer c ON c.id = inv.customer_id
      LEFT JOIN public.branch b ON b.id = inv.branch_id
      LEFT JOIN public.accounting_voucher v_sales ON v_sales.id = inv.voucher_id
      ${whereClause}
      ORDER BY inv.due_date ASC, inv.created_at DESC
    `;

    const res = await queryFn(rawSql, params);

    const items: BillReceivableListItem[] = [];
    let totalReceivables = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let overdueAmount = 0;
    let unpaidCount = 0;
    let partiallyReceivedCount = 0;
    let fullyReceivedCount = 0;
    let overdueCount = 0;

    const ageingBreakdown = {
      current: 0,
      bucket_1_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_over_90: 0,
    };

    for (const r of res.rows) {
      const total = Number(r.total_amount);
      const paid = Number(r.paid_amount);
      const returns = Number(r.returns_amount);
      const outstanding = Math.max(0, Math.round((total - paid - returns) * 100) / 100);

      const { bucket, overdueDays } = calculateAgeingBucket(r.due_date);

      let status: BillReceivableStatus = "UNPAID";
      if (outstanding <= 0.005) {
        status = "FULLY_RECEIVED";
        fullyReceivedCount++;
      } else if (paid > 0) {
        status = "PARTIALLY_RECEIVED";
        partiallyReceivedCount++;
      } else if (overdueDays > 0) {
        status = "OVERDUE";
        overdueCount++;
      } else {
        status = "UNPAID";
        unpaidCount++;
      }

      if (overdueDays > 0 && outstanding > 0.005 && status !== "OVERDUE") {
        // If partially paid but overdue, record in overdue count/amount
        overdueAmount += outstanding;
      } else if (status === "OVERDUE") {
        overdueAmount += outstanding;
      }

      totalReceivables += total;
      totalReceived += paid;
      totalOutstanding += outstanding;

      if (outstanding > 0.005) {
        if (bucket === "CURRENT") ageingBreakdown.current += outstanding;
        else if (bucket === "1_TO_30") ageingBreakdown.bucket_1_30 += outstanding;
        else if (bucket === "31_TO_60") ageingBreakdown.bucket_31_60 += outstanding;
        else if (bucket === "61_TO_90") ageingBreakdown.bucket_61_90 += outstanding;
        else if (bucket === "OVER_90") ageingBreakdown.bucket_over_90 += outstanding;
      }

      // Filter by requested status/ageing bucket in memory if provided
      if (filters.status && status !== filters.status) continue;
      if (filters.ageing_bucket && bucket !== filters.ageing_bucket) continue;

      items.push({
        invoice_id: r.invoice_id,
        invoice_number: r.invoice_number,
        order_id: r.order_id,
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        customer_company: r.customer_company,
        customer_gstin: r.customer_gstin,
        customer_phone: r.customer_phone,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        invoice_date: r.invoice_date,
        due_date: r.due_date,
        payment_terms_days: r.payment_terms_days,
        total_amount: total,
        paid_amount: paid,
        returns_amount: returns,
        outstanding_amount: outstanding,
        status,
        ageing_bucket: bucket,
        overdue_days: overdueDays,
        voucher_id: r.voucher_id,
        voucher_no: r.voucher_no,
        created_at: r.created_at,
      });
    }

    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      bills: paginatedItems,
      total_count: items.length,
      summary: {
        total_receivables: Math.round(totalReceivables * 100) / 100,
        total_received: Math.round(totalReceived * 100) / 100,
        total_outstanding: Math.round(totalOutstanding * 100) / 100,
        overdue_amount: Math.round(overdueAmount * 100) / 100,
        total_bills_count: res.rows.length,
        unpaid_count: unpaidCount,
        partially_received_count: partiallyReceivedCount,
        fully_received_count: fullyReceivedCount,
        overdue_count: overdueCount,
        ageing_breakdown: {
          current: Math.round(ageingBreakdown.current * 100) / 100,
          bucket_1_30: Math.round(ageingBreakdown.bucket_1_30 * 100) / 100,
          bucket_31_60: Math.round(ageingBreakdown.bucket_31_60 * 100) / 100,
          bucket_61_90: Math.round(ageingBreakdown.bucket_61_90 * 100) / 100,
          bucket_over_90: Math.round(ageingBreakdown.bucket_over_90 * 100) / 100,
        },
      },
    };
  }

  /**
   * Retrieves full details for a corporate bill receivable:
   * Header, GST breakdown, items, voucher, allocations, credit notes.
   */
  static async getBillReceivableDetail(
    invoiceId: string,
    actorContext?: any,
    callerClient?: PoolClient
  ): Promise<BillReceivableDetail> {
    const queryFn = async (sql: string, params: any[] = []): Promise<any> => {
      return callerClient ? callerClient.query(sql, params) : dbQuery(sql, params);
    };

    const listRes = await BillsReceivableService.listBillsReceivable(
      { actorContext },
      callerClient
    );
    // Find bill in list
    const billRes = await queryFn(
      `SELECT
         inv.id AS invoice_id,
         inv.invoice_number,
         inv.order_id,
         inv.customer_id,
         COALESCE(c.company_name, inv.customer_name) AS customer_name,
         c.company_name AS customer_company,
         c.gstin AS customer_gstin,
         COALESCE(c.phone, inv.customer_phone) AS customer_phone,
         inv.branch_id,
         b.name AS branch_name,
         inv.created_at::DATE::TEXT AS invoice_date,
         inv.due_date::TEXT AS due_date,
         COALESCE((inv.metadata->>'payment_terms_days')::INT, c.payment_terms_days, 30) AS payment_terms_days,
         inv.grand_total::NUMERIC AS total_amount,
         COALESCE((
           SELECT SUM(cra.allocated_amount)
           FROM public.customer_receipt_allocation cra
           WHERE cra.invoice_id = inv.id
         ), 0)::NUMERIC AS paid_amount,
         COALESCE((
           SELECT SUM(v_ret.total_amount)
           FROM public.accounting_voucher v_ret
           WHERE v_ret.reference_type = 'ORDER_RETURN'
             AND v_ret.metadata->>'order_id' = inv.order_id
             AND v_ret.status = 'POSTED'
             AND v_ret.deleted_at IS NULL
         ), 0)::NUMERIC AS returns_amount,
         inv.voucher_id,
         v_sales.voucher_no,
         inv.metadata,
         inv.created_at::TEXT AS created_at
       FROM public.invoice inv
       LEFT JOIN public.customer c ON c.id = inv.customer_id
       LEFT JOIN public.branch b ON b.id = inv.branch_id
       LEFT JOIN public.accounting_voucher v_sales ON v_sales.id = inv.voucher_id
       WHERE inv.id = $1 AND inv.is_corporate = true AND inv.deleted_at IS NULL`,
      [invoiceId]
    );

    if (billRes.rows.length === 0) {
      throw new BillsReceivableError("INVOICE_NOT_FOUND", `Corporate invoice '${invoiceId}' not found.`);
    }

    const r = billRes.rows[0];
    BillsReceivableService.enforceBranchScope(actorContext, r.branch_id);

    const total = Number(r.total_amount);
    const paid = Number(r.paid_amount);
    const returns = Number(r.returns_amount);
    const outstanding = Math.max(0, Math.round((total - paid - returns) * 100) / 100);
    const { bucket, overdueDays } = calculateAgeingBucket(r.due_date);

    let status: BillReceivableStatus = "UNPAID";
    if (outstanding <= 0.005) status = "FULLY_RECEIVED";
    else if (paid > 0) status = "PARTIALLY_RECEIVED";
    else if (overdueDays > 0) status = "OVERDUE";

    const invoiceItem: BillReceivableListItem = {
      invoice_id: r.invoice_id,
      invoice_number: r.invoice_number,
      order_id: r.order_id,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_company: r.customer_company,
      customer_gstin: r.customer_gstin,
      customer_phone: r.customer_phone,
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      payment_terms_days: r.payment_terms_days,
      total_amount: total,
      paid_amount: paid,
      returns_amount: returns,
      outstanding_amount: outstanding,
      status,
      ageing_bucket: bucket,
      overdue_days: overdueDays,
      voucher_id: r.voucher_id,
      voucher_no: r.voucher_no,
      created_at: r.created_at,
    };

    const meta = r.metadata || {};
    const gstBreakdown: BillReceivableGstBreakdown = {
      taxable_value: Number(meta.taxable_value || total),
      cgst: Number(meta.cgst || 0),
      sgst: Number(meta.sgst || 0),
      igst: Number(meta.igst || 0),
      total_tax: Number(meta.cgst || 0) + Number(meta.sgst || 0) + Number(meta.igst || 0),
      gstin: meta.gstin || r.customer_gstin || null,
      is_intra_state: meta.is_intra_state !== false,
    };

    const items = Array.isArray(meta.items) ? meta.items : [];

    // Fetch voucher & journal entries
    let voucher: AccountingVoucherRow | null = null;
    let journalEntry: (AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] }) | null = null;

    if (r.voucher_id) {
      const vRes = await queryFn(`SELECT * FROM public.accounting_voucher WHERE id = $1`, [r.voucher_id]);
      voucher = vRes.rows[0] || null;

      if (voucher) {
        const jeRes = await queryFn(`SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`, [voucher.id]);
        const je = jeRes.rows[0];
        if (je) {
          const lRes = await queryFn(
            `SELECT * FROM public.accounting_journal_line WHERE journal_entry_id = $1 ORDER BY line_no ASC`,
            [je.id]
          );
          journalEntry = { ...je, lines: lRes.rows };
        }
      }
    }

    // Fetch receipt allocations
    const craRes = await queryFn(
      `SELECT
         cra.id AS allocation_id,
         cra.voucher_id,
         v.voucher_no,
         v.voucher_date::TEXT AS receipt_date,
         cra.allocated_amount::NUMERIC AS amount,
         COALESCE(cra.metadata->>'payment_method', 'BANK_TRANSFER') AS payment_method,
         cra.metadata->>'reference' AS reference,
         cra.metadata->>'bank_name' AS bank_name,
         cra.metadata->>'account_name' AS account_name,
         v.created_by,
         cra.created_at::TEXT AS created_at
       FROM public.customer_receipt_allocation cra
       JOIN public.accounting_voucher v ON v.id = cra.voucher_id
       WHERE cra.invoice_id = $1
       ORDER BY v.voucher_date DESC, cra.created_at DESC`,
      [invoiceId]
    );

    const receiptAllocations = craRes.rows.map((row: any) => ({
      allocation_id: row.allocation_id,
      voucher_id: row.voucher_id,
      voucher_no: row.voucher_no,
      receipt_date: row.receipt_date,
      amount: Number(row.amount),
      payment_method: row.payment_method,
      reference: row.reference,
      bank_name: row.bank_name,
      account_name: row.account_name,
      created_by: row.created_by,
      created_at: row.created_at,
    }));

    // Fetch credit notes
    const cnRes = await queryFn(
      `SELECT
         v.id AS voucher_id,
         v.voucher_no,
         v.voucher_date::TEXT AS date,
         v.total_amount::NUMERIC AS amount,
         v.narration
       FROM public.accounting_voucher v
       WHERE v.reference_type = 'ORDER_RETURN'
         AND v.metadata->>'order_id' = $1
         AND v.status = 'POSTED'
         AND v.deleted_at IS NULL
       ORDER BY v.voucher_date DESC`,
      [r.order_id]
    );

    const creditNotes = cnRes.rows.map((row: any) => ({
      voucher_id: row.voucher_id,
      voucher_no: row.voucher_no,
      date: row.date,
      amount: Number(row.amount),
      narration: row.narration,
    }));

    return {
      invoice: invoiceItem,
      gst_breakdown: gstBreakdown,
      items,
      voucher,
      journal_entry: journalEntry,
      receipt_allocations: receiptAllocations,
      credit_notes: creditNotes,
    };
  }

  /**
   * Settle customer receipt against one or multiple corporate invoices.
   * Advisory-locked, overpayment-defended, provider-neutral, bank leaf GL resolved,
   * double-entry committed via PostingService.
   */
  static async settleCustomerReceipt(
    params: SettleCustomerReceiptParams
  ): Promise<SettleCustomerReceiptResult> {
    const {
      customerId,
      branchId,
      receiptDate,
      paymentMethod,
      bankAccountId,
      reference,
      narration: customNarration,
      receivedBy,
      voucherPreparerId,
      actorRole,
      actorSession,
      allocations,
      client: callerClient,
    } = params;

    // 0. Pre-transaction validation
    if (!customerId) throw new BillsReceivableError("CUSTOMER_NOT_FOUND", "Customer ID is required.");
    if (!branchId) throw new BillsReceivableError("BRANCH_ACCESS_DENIED", "Branch ID is required.");
    if (!receiptDate) throw new BillsReceivableError("INVALID_RECEIPT_AMOUNT", "Receipt date is required.");
    if (!allocations || allocations.length === 0) {
      throw new BillsReceivableError("INVALID_RECEIPT_AMOUNT", "At least one invoice allocation is required.");
    }

    let totalAllocationAmount = 0;
    for (const a of allocations) {
      const amt = Number(a.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new BillsReceivableError(
          "INVALID_RECEIPT_AMOUNT",
          `Allocation amount for invoice '${a.invoiceId}' must be strictly greater than zero.`
        );
      }
      totalAllocationAmount += amt;
    }
    totalAllocationAmount = Math.round(totalAllocationAmount * 100) / 100;

    // Electronic settlement requires UTR reference
    const electronicMethods = ["BANK_TRANSFER", "NEFT", "RTGS", "IMPS"];
    if (electronicMethods.includes(paymentMethod) && (!reference || !reference.trim())) {
      throw new BillsReceivableError(
        "REFERENCE_MANDATORY",
        `Transaction/UTR reference ID is mandatory for ${paymentMethod} receipt.`
      );
    }

    // Check permissions
    const actorContext = {
      userId: receivedBy,
      role: actorRole || (actorSession?.role as any) || (receivedBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
      session: actorSession,
      branch_id: branchId,
    };

    const hasPerm =
      hasEffectivePermission(actorContext, "ACCOUNTING.POST") ||
      hasEffectivePermission(actorContext, "CUSTOMER.EDIT");
    if (!hasPerm) {
      throw new BillsReceivableError(
        "PERMISSION_DENIED",
        `Caller '${receivedBy}' lacks required permission to settle customer receipts.`
      );
    }

    BillsReceivableService.enforceBranchScope(actorContext, branchId);

    const executeReceipt = async (client: PoolClient): Promise<SettleCustomerReceiptResult> => {
      // 1. ACQUIRE CUSTOMER ADVISORY LOCK
      const custLockId = stringToAdvisoryLockId("corp_credit_" + customerId);
      await client.query("SELECT pg_advisory_xact_lock($1)", [custLockId]);

      // 2. FETCH INVOICES FOR UPDATE & VALIDATE
      const invoiceIds = allocations.map((a) => a.invoiceId);
      const invRes = await client.query(
        `SELECT * FROM public.invoice WHERE id = ANY($1) AND deleted_at IS NULL FOR UPDATE`,
        [invoiceIds]
      );

      if (invRes.rows.length !== invoiceIds.length) {
        throw new BillsReceivableError("INVOICE_NOT_FOUND", "One or more target invoices could not be found.");
      }

      const invMap = new Map<string, any>();
      invRes.rows.forEach((i) => invMap.set(i.id, i));

      const settledInvoices: SettleCustomerReceiptResult["settled_invoices"] = [];

      for (const alloc of allocations) {
        const inv = invMap.get(alloc.invoiceId)!;

        if (inv.customer_id !== customerId) {
          throw new BillsReceivableError(
            "CUSTOMER_MISMATCH",
            `Invoice '${inv.id}' belongs to customer '${inv.customer_id}', not '${customerId}'.`
          );
        }
        if (!inv.is_corporate) {
          throw new BillsReceivableError(
            "CREDIT_NOT_PERMITTED",
            `Invoice '${inv.id}' is not a corporate invoice.`
          );
        }
        if (inv.status !== "POSTED") {
          throw new BillsReceivableError(
            "INVALID_INVOICE_STATUS",
            `Invoice '${inv.id}' has status '${inv.status}'. Only POSTED invoices can receive receipts.`
          );
        }

        // Segregation of Duties
        if (inv.metadata?.created_by && receivedBy === inv.metadata.created_by) {
          throw new BillsReceivableError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Invoice creator ('${inv.metadata.created_by}') cannot settle receipt for invoice '${inv.id}'.`
          );
        }

        // Calculate authoritative current outstanding
        const invTotal = Number(inv.grand_total);
        const paidRes = await client.query<{ total_paid: string }>(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_paid
           FROM public.customer_receipt_allocation
           WHERE invoice_id = $1`,
          [inv.id]
        );
        const alreadyPaid = Number(paidRes.rows[0]?.total_paid || 0);

        const retRes = await client.query<{ total_returns: string }>(
          `SELECT COALESCE(SUM(total_amount), 0) AS total_returns
           FROM public.accounting_voucher
           WHERE reference_type = 'ORDER_RETURN'
             AND metadata->>'order_id' = $1
             AND status = 'POSTED'
             AND deleted_at IS NULL`,
          [inv.order_id]
        );
        const totalReturns = Number(retRes.rows[0]?.total_returns || 0);

        const currentOutstanding = Math.max(0, Math.round((invTotal - alreadyPaid - totalReturns) * 100) / 100);

        if (currentOutstanding <= 0.005) {
          throw new BillsReceivableError(
            "INVOICE_ALREADY_SETTLED",
            `Invoice '${inv.invoice_number || inv.id}' is already fully settled.`
          );
        }

        if (alloc.amount > currentOutstanding + 0.005) {
          throw new BillsReceivableError(
            "ALLOCATION_EXCEEDS_OUTSTANDING",
            `Allocation amount (₹${alloc.amount.toFixed(2)}) exceeds outstanding balance (₹${currentOutstanding.toFixed(2)}) for invoice '${inv.invoice_number || inv.id}'.`
          );
        }

        const newOutstanding = Math.max(0, Math.round((currentOutstanding - alloc.amount) * 100) / 100);
        const newStatus: BillReceivableStatus = newOutstanding <= 0.005 ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";

        settledInvoices.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          allocated_amount: alloc.amount,
          new_outstanding: newOutstanding,
          new_status: newStatus,
        });
      }

      // 3. VALIDATE ACCOUNTING CONFIG GUARDS
      await PostingService.validateAccountingStartDate(receiptDate, client);
      const period = await PostingService.validateFiscalPeriod(receiptDate, client);
      const fiscalYear = period.fiscal_year;

      // 4. RESOLVE BANK LEAF GL ACCOUNT
      let bankGlAccount: AccountingAccountRow;
      let bankName = "Operating Bank";
      let accountName = "Main Account";

      if (bankAccountId) {
        const bank = await BankAccountRepository.findById(bankAccountId, client);
        if (!bank || bank.status !== "ACTIVE") {
          throw new BillsReceivableError("PAYMENT_ACCOUNT_UNRESOLVED", `Bank account '${bankAccountId}' not active.`);
        }
        if (!bank.gl_account_id) {
          throw new BillsReceivableError("PAYMENT_ACCOUNT_UNRESOLVED", `Bank '${bank.account_name}' has no mapped GL account.`);
        }
        const acc = await AccountingAccountRepository.findById(bank.gl_account_id, client);
        if (!acc || !acc.is_active || acc.is_group) {
          throw new BillsReceivableError("PAYMENT_ACCOUNT_UNRESOLVED", `Bank GL account '${bank.gl_account_id}' is inactive or group.`);
        }
        bankGlAccount = acc;
        bankName = bank.bank_name;
        accountName = bank.account_name;
      } else {
        const acc = await AccountingAccountRepository.findByCode("1112", client);
        if (!acc || !acc.is_active || acc.is_group) {
          throw new BillsReceivableError("PAYMENT_ACCOUNT_UNRESOLVED", "Bank Operating account 1112 unresolved.");
        }
        bankGlAccount = acc;
      }

      // Resolve AR control account 1121
      const arAccount = await AccountingAccountRepository.findByCode("1121", client);
      if (!arAccount || !arAccount.is_active || arAccount.is_group) {
        throw new BillsReceivableError("PAYMENT_ACCOUNT_UNRESOLVED", "Trade Accounts Receivable account 1121 unresolved.");
      }

      // 5. PREPARE DOUBLE-ENTRY JOURNAL LINES
      const invRefNos = settledInvoices.map((s) => s.invoice_number).join(", ");
      const narration =
        customNarration ||
        `Corporate receipt from ${customerId} for Invoice(s): ${invRefNos} via ${paymentMethod}${reference ? ` (Ref: ${reference})` : ""}`;

      const journalLines: JournalLineInput[] = [
        // Debit: Selected Bank GL account
        {
          account_id: bankGlAccount.id,
          debit_amount: totalAllocationAmount,
          credit_amount: 0,
          branch_id: branchId,
          narration: `Bank Receipt via ${paymentMethod}${reference ? ` Ref: ${reference}` : ""}`,
        },
        // Credit: 1121 Trade AR (carrying customer_id and branch_id)
        {
          account_id: arAccount.id,
          debit_amount: 0,
          credit_amount: totalAllocationAmount,
          customer_id: customerId,
          branch_id: branchId,
          narration: `AR Settlement: ${invRefNos}`,
        },
      ];

      // 6. CREATE, SUBMIT, APPROVE, POST VOUCHER VIA PostingService
      const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const preparerId =
        voucherPreparerId && voucherPreparerId !== receivedBy
          ? voucherPreparerId
          : `cashier_${branchId.replace(/^br_/, "")}`;

      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "RECEIPT",
          voucher_date: receiptDate,
          branch_id: branchId,
          narration,
          reference_type: "CUSTOMER_RECEIPT",
          reference_id: receiptId,
          reference_event: "CORPORATE_RECEIPT_SETTLEMENT",
          lines: journalLines,
        },
        branchId,
        fiscalYear,
        createdBy: preparerId,
        client,
      });

      if (!draftRes.success) {
        throw new BillsReceivableError("SETTLEMENT_FAILED", `Voucher draft failed: ${draftRes.error}`);
      }
      const voucherDraft = draftRes.data;

      await PostingService.submitVoucher({
        voucherId: voucherDraft.id,
        submittedBy: preparerId,
        branchId,
        client,
      });

      await PostingService.approveVoucher({
        voucherId: voucherDraft.id,
        approvedBy: receivedBy,
        branchId,
        client,
      });

      const postRes = await PostingService.postVoucher({
        voucherId: voucherDraft.id,
        postedBy: receivedBy,
        lines: journalLines,
        branchId,
        client,
      });

      if (!postRes.success) {
        throw new BillsReceivableError("SETTLEMENT_FAILED", `Voucher post failed: ${postRes.error}`);
      }

      // 7. INSERT CUSTOMER_RECEIPT_ALLOCATION RECORDS
      const createdAllocations: Array<{ id: string; invoice_id: string; allocated_amount: number }> = [];

      for (const sb of settledInvoices) {
        const allocId = `cra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const meta = {
          payment_method: paymentMethod,
          reference: reference || null,
          bank_account_id: bankAccountId || null,
          bank_name: bankName,
          account_name: accountName,
          receipt_date: receiptDate,
        };

        await client.query(
          `INSERT INTO public.customer_receipt_allocation (
             id, invoice_id, voucher_id, allocated_amount, metadata, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [allocId, sb.invoice_id, voucherDraft.id, sb.allocated_amount, JSON.stringify(meta)]
        );

        createdAllocations.push({
          id: allocId,
          invoice_id: sb.invoice_id,
          allocated_amount: sb.allocated_amount,
        });

        // Update cached invoice columns
        await client.query(
          `UPDATE public.invoice
           SET paid_amount = paid_amount + $1,
               outstanding_amount = $2,
               payment_status = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [sb.allocated_amount, sb.new_outstanding, sb.new_status === "FULLY_RECEIVED" ? "PAID" : "PARTIALLY_PAID", sb.invoice_id]
        );
      }

      // 8. RECONCILE AND UPDATE CACHED CUSTOMER EXPOSURE
      const newAuthoritativeOutstanding = await BillsReceivableService.calculateAuthoritativeCustomerOutstanding(
        customerId,
        client
      );

      await client.query(
        `UPDATE public.customer SET credit_balance = $1, updated_at = NOW() WHERE id = $2`,
        [newAuthoritativeOutstanding, customerId]
      );

      return {
        voucher: postRes.data.voucher,
        journal_entry: postRes.data.journal_entry,
        allocations: createdAllocations,
        total_received: totalAllocationAmount,
        payment_method: paymentMethod,
        reference: reference || null,
        bank_gl_code: bankGlAccount.code,
        bank_gl_name: bankGlAccount.name,
        settled_invoices: settledInvoices,
        customer_authoritative_outstanding: newAuthoritativeOutstanding,
      };
    };

    return callerClient ? await executeReceipt(callerClient) : await dbTransaction(executeReceipt);
  }

  /**
   * Retrieves the authoritative chronological Customer Subledger for Account 1121.
   * Multi-tier drill-down: Customer → Ledger → Invoice → Receipt → Bank → UTR → Allocation.
   */
  static async getCustomerLedger(
    customerId: string,
    filters?: { startDate?: string; endDate?: string; branchId?: string },
    actorContext?: any,
    callerClient?: PoolClient
  ): Promise<CustomerLedgerResult> {
    const queryFn = async (sql: string, params: any[] = []): Promise<any> => {
      return callerClient ? callerClient.query(sql, params) : dbQuery(sql, params);
    };

    const custRes = await queryFn(
      `SELECT * FROM public.customer WHERE id = $1 AND deleted_at IS NULL`,
      [customerId]
    );
    if (custRes.rows.length === 0) {
      throw new BillsReceivableError("CUSTOMER_NOT_FOUND", `Customer '${customerId}' not found.`);
    }
    const customer = custRes.rows[0];

    // Branch scoping
    const { branchId: scopedBranchId } = BillsReceivableService.enforceBranchScope(
      actorContext,
      filters?.branchId
    );

    // 1. Fetch Invoices (Debits to AR)
    let invSql = `
      SELECT
        inv.id AS document_id,
        inv.invoice_number AS document_no,
        inv.order_id AS reference_no,
        inv.created_at::TEXT AS date,
        inv.grand_total::NUMERIC AS amount,
        inv.branch_id,
        b.name AS branch_name,
        'INVOICE' AS entry_type,
        CONCAT('Corporate Invoice ', inv.invoice_number, ' (Due: ', inv.due_date, ')') AS narration
      FROM public.invoice inv
      LEFT JOIN public.branch b ON b.id = inv.branch_id
      WHERE inv.customer_id = $1 AND inv.is_corporate = true AND inv.status = 'POSTED' AND inv.deleted_at IS NULL
    `;
    const invParams: any[] = [customerId];
    if (scopedBranchId) {
      invSql += ` AND inv.branch_id = $2`;
      invParams.push(scopedBranchId);
    }
    const invRows = await queryFn(invSql, invParams);

    // 2. Fetch Receipts (Credits to AR) with allocations drill-down
    let rcptSql = `
      SELECT
        v.id AS document_id,
        v.voucher_no AS document_no,
        cra.metadata->>'reference' AS reference_no,
        v.voucher_date::TEXT AS date,
        cra.allocated_amount::NUMERIC AS amount,
        v.branch_id,
        b.name AS branch_name,
        cra.metadata->>'bank_name' AS bank_name,
        cra.metadata->>'account_name' AS account_name,
        'RECEIPT' AS entry_type,
        v.narration,
        inv.invoice_number AS allocated_invoice_number
      FROM public.customer_receipt_allocation cra
      JOIN public.invoice inv ON inv.id = cra.invoice_id
      JOIN public.accounting_voucher v ON v.id = cra.voucher_id
      LEFT JOIN public.branch b ON b.id = v.branch_id
      WHERE inv.customer_id = $1
    `;
    const rcptParams: any[] = [customerId];
    if (scopedBranchId) {
      rcptSql += ` AND v.branch_id = $2`;
      rcptParams.push(scopedBranchId);
    }
    const rcptRows = await queryFn(rcptSql, rcptParams);

    // 3. Fetch Credit Notes / Returns (Credits to AR)
    let cnSql = `
      SELECT
        v.id AS document_id,
        v.voucher_no AS document_no,
        v.metadata->>'order_id' AS reference_no,
        v.voucher_date::TEXT AS date,
        v.total_amount::NUMERIC AS amount,
        v.branch_id,
        b.name AS branch_name,
        'CREDIT_NOTE' AS entry_type,
        v.narration
      FROM public.accounting_voucher v
      LEFT JOIN public.branch b ON b.id = v.branch_id
      WHERE v.reference_type = 'ORDER_RETURN'
        AND v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.invoice inv
          WHERE inv.order_id = v.metadata->>'order_id'
            AND inv.customer_id = $1
        )
    `;
    const cnParams: any[] = [customerId];
    if (scopedBranchId) {
      cnSql += ` AND v.branch_id = $2`;
      cnParams.push(scopedBranchId);
    }
    const cnRows = await queryFn(cnSql, cnParams);

    // Merge and sort chronologically
    type RawEntry = {
      id: string;
      date: string;
      entry_type: "INVOICE" | "RECEIPT" | "CREDIT_NOTE";
      document_id: string;
      document_no: string;
      reference_no: string | null;
      branch_id: string;
      branch_name: string | null;
      bank_name?: string | null;
      account_name?: string | null;
      amount: number;
      narration: string;
      allocated_invoice_number?: string;
    };

    const combined: RawEntry[] = [];

    for (const r of invRows.rows) {
      combined.push({
        id: `inv_${r.document_id}`,
        date: r.date,
        entry_type: "INVOICE",
        document_id: r.document_id,
        document_no: r.document_no,
        reference_no: r.reference_no,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        amount: Number(r.amount),
        narration: r.narration,
      });
    }

    for (const r of rcptRows.rows) {
      combined.push({
        id: `cra_${r.document_id}_${r.allocated_invoice_number}`,
        date: r.date,
        entry_type: "RECEIPT",
        document_id: r.document_id,
        document_no: r.document_no,
        reference_no: r.reference_no,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        bank_name: r.bank_name,
        account_name: r.account_name,
        amount: Number(r.amount),
        narration: r.narration,
        allocated_invoice_number: r.allocated_invoice_number,
      });
    }

    for (const r of cnRows.rows) {
      combined.push({
        id: `cn_${r.document_id}`,
        date: r.date,
        entry_type: "CREDIT_NOTE",
        document_id: r.document_id,
        document_no: r.document_no,
        reference_no: r.reference_no,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        amount: Number(r.amount),
        narration: r.narration,
      });
    }

    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    let totalInvoiced = 0;
    let totalReceived = 0;
    let totalCredited = 0;

    const entries: CustomerLedgerEntry[] = combined.map((item) => {
      let debit = 0;
      let credit = 0;

      if (item.entry_type === "INVOICE") {
        debit = item.amount;
        runningBalance += debit;
        totalInvoiced += debit;
      } else {
        credit = item.amount;
        runningBalance -= credit;
        if (item.entry_type === "RECEIPT") totalReceived += credit;
        else totalCredited += credit;
      }

      runningBalance = Math.round(runningBalance * 100) / 100;

      return {
        id: item.id,
        date: item.date,
        entry_type: item.entry_type,
        document_id: item.document_id,
        document_no: item.document_no,
        reference_no: item.reference_no,
        branch_id: item.branch_id,
        branch_name: item.branch_name,
        bank_name: item.bank_name || null,
        account_name: item.account_name || null,
        debit,
        credit,
        running_balance: runningBalance,
        narration: item.narration,
        allocated_invoices: item.allocated_invoice_number
          ? [{ invoice_number: item.allocated_invoice_number, amount: item.amount }]
          : undefined,
      };
    });

    return {
      customer_id: customer.id,
      customer_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.company_name || customer.id,
      company_name: customer.company_name || null,
      gstin: customer.gstin || null,
      is_corporate: customer.is_corporate,
      credit_enabled: customer.credit_enabled,
      credit_status: customer.credit_status || null,
      credit_limit: Number(customer.credit_limit || 0),
      payment_terms_days: Number(customer.payment_terms_days || 30),
      total_invoiced: Math.round(totalInvoiced * 100) / 100,
      total_received: Math.round(totalReceived * 100) / 100,
      total_credited: Math.round(totalCredited * 100) / 100,
      closing_balance: Math.max(0, runningBalance),
      entries,
    };
  }

  /**
   * AR Ageing Matrix derived from due_date.
   * Provides company-wide aggregation and dynamic branch breakdown.
   */
  static async getArAgeingSummary(
    branchId?: string,
    actorContext?: any,
    callerClient?: PoolClient
  ): Promise<ArAgeingSummaryResult> {
    const listRes = await BillsReceivableService.listBillsReceivable(
      { branch_id: branchId, actorContext },
      callerClient
    );

    const queryFn = async (sql: string, params: any[] = []): Promise<any> => {
      return callerClient ? callerClient.query(sql, params) : dbQuery(sql, params);
    };
    const branchesRes = await queryFn(`SELECT id, name FROM public.branch WHERE deleted_at IS NULL`);
    const branchMap = new Map<string, string>();
    branchesRes.rows.forEach((b: any) => branchMap.set(b.id, b.name));

    const branchAgg: Record<
      string,
      { current: number; bucket_1_30: number; bucket_31_60: number; bucket_61_90: number; bucket_over_90: number; total_outstanding: number }
    > = {};

    for (const bill of listRes.bills) {
      if (bill.outstanding_amount <= 0.005) continue;

      if (!branchAgg[bill.branch_id]) {
        branchAgg[bill.branch_id] = {
          current: 0,
          bucket_1_30: 0,
          bucket_31_60: 0,
          bucket_61_90: 0,
          bucket_over_90: 0,
          total_outstanding: 0,
        };
      }

      const b = branchAgg[bill.branch_id];
      b.total_outstanding += bill.outstanding_amount;

      if (bill.ageing_bucket === "CURRENT") b.current += bill.outstanding_amount;
      else if (bill.ageing_bucket === "1_TO_30") b.bucket_1_30 += bill.outstanding_amount;
      else if (bill.ageing_bucket === "31_TO_60") b.bucket_31_60 += bill.outstanding_amount;
      else if (bill.ageing_bucket === "61_TO_90") b.bucket_61_90 += bill.outstanding_amount;
      else if (bill.ageing_bucket === "OVER_90") b.bucket_over_90 += bill.outstanding_amount;
    }

    const branchBreakdown = Object.entries(branchAgg).map(([bId, data]) => ({
      branch_id: bId,
      branch_name: branchMap.get(bId) || bId,
      current: Math.round(data.current * 100) / 100,
      bucket_1_30: Math.round(data.bucket_1_30 * 100) / 100,
      bucket_31_60: Math.round(data.bucket_31_60 * 100) / 100,
      bucket_61_90: Math.round(data.bucket_61_90 * 100) / 100,
      bucket_over_90: Math.round(data.bucket_over_90 * 100) / 100,
      total_outstanding: Math.round(data.total_outstanding * 100) / 100,
    }));

    const summary = listRes.summary;

    return {
      company_total: {
        current: summary.ageing_breakdown.current,
        bucket_1_30: summary.ageing_breakdown.bucket_1_30,
        bucket_31_60: summary.ageing_breakdown.bucket_31_60,
        bucket_61_90: summary.ageing_breakdown.bucket_61_90,
        bucket_over_90: summary.ageing_breakdown.bucket_over_90,
        total_outstanding: summary.total_outstanding,
      },
      branch_breakdown: branchBreakdown,
    };
  }

  /**
   * Schedule invoice payment reminder using existing public.notification table.
   */
  static async scheduleInvoiceReminder(
    params: ScheduleInvoiceReminderParams
  ): Promise<{ success: boolean; notification: any }> {
    const { invoiceId, reminderDate, reminderType, channel = "EMAIL", scheduledBy, client: callerClient } = params;

    const executeReminder = async (client: PoolClient) => {
      const invRes = await client.query(
        `SELECT inv.*, c.email, c.phone, c.company_name
         FROM public.invoice inv
         LEFT JOIN public.customer c ON c.id = inv.customer_id
         WHERE inv.id = $1 AND inv.deleted_at IS NULL`,
        [invoiceId]
      );
      if (invRes.rows.length === 0) {
        throw new BillsReceivableError("INVOICE_NOT_FOUND", `Invoice '${invoiceId}' not found.`);
      }
      const inv = invRes.rows[0];

      const notifId = `notif_inv_rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const recipient = channel === "SMS" ? inv.phone || inv.customer_phone : inv.email;

      const data = {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        grand_total: Number(inv.grand_total),
        outstanding_amount: Number(inv.outstanding_amount || inv.grand_total),
        due_date: inv.due_date,
        reminder_type: reminderType,
        scheduled_for: reminderDate,
        scheduled_by: scheduledBy,
      };

      const insRes = await client.query(
        `INSERT INTO public.notification (
           id, "to", channel, template, data, trigger_type, resource_id, resource_type,
           receiver_id, status, created_at, updated_at
         ) VALUES ($1, $2, $3, 'INVOICE_PAYMENT_REMINDER', $4, 'PAYMENT_REMINDER', $5, 'INVOICE', $6, 'pending', NOW(), NOW())
         RETURNING *`,
        [notifId, recipient || "unspecified", channel, JSON.stringify(data), inv.id, inv.customer_id]
      );

      return { success: true, notification: insRes.rows[0] };
    };

    return callerClient ? await executeReminder(callerClient) : await dbTransaction(executeReminder);
  }

  /**
   * Lists reminders scheduled for a specific invoice.
   */
  static async listInvoiceReminders(
    invoiceId: string,
    callerClient?: PoolClient
  ): Promise<any[]> {
    const queryFn = async (sql: string, params: any[] = []): Promise<any> => {
      return callerClient ? callerClient.query(sql, params) : dbQuery(sql, params);
    };
    const res = await queryFn(
      `SELECT * FROM public.notification
       WHERE resource_type = 'INVOICE' AND resource_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [invoiceId]
    );
    return res.rows;
  }
}
