/**
 * CakeToHome ERP — Central Accounting Work Queue Data Layer
 * Phase 5A.6 Substep 5.4 Module C
 *
 * Provides typed client data fetching and action invocations for:
 * 1. Purchases Approval & GL Posting (PurchasePostingService)
 * 2. Expenses Claims Approval & GL Posting (ExpenseService)
 * 3. Bank Deposit Slips Approval & Transit Posting (BankDepositSlipService)
 * 4. Gateway Settlement Payout Batches Approval & GL Posting (GatewaySettlementService)
 *
 * Enforces strict Segregation of Duties (SoD) contract.
 */

export interface WorkQueueSummary {
  pending_purchases: { count: number; total: number };
  pending_expenses: { count: number; total: number };
  pending_deposits: { count: number; total: number };
  pending_gateways: { count: number; total: number };
  pending_sales: { count: number; total: number };
  total_pending_count: number;
  total_pending_value: number;
}

export interface SalesQueueItem {
  id: string;
  voucher_number: string;
  order_id: string;
  customer_name?: string;
  customer_phone?: string;
  branch_id: string;
  branch_name?: string;
  voucher_date: string;
  total_amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED";
  created_by: string;
  approved_by?: string | null;
  posted_by?: string | null;
  created_at: string;
  invoice_number?: string | null;
}

export interface PurchaseQueueItem {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  supplier_id: string | null;
  supplier_name?: string;
  branch_id: string;
  branch_name?: string;
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED";
  created_by: string | null;
  approved_by: string | null;
  posted_at: string | null;
  accounting_voucher_id?: string | null;
  items?: Array<{
    id: string;
    description: string;
    item_type?: "ACCESSORY" | "CAKE" | "PACKAGING";
    quantity: number;
    rate: number;
    taxable_value: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    hsn_code?: string | null;
  }>;
}

export interface ExpenseQueueItem {
  id: string;
  category_id: string | null;
  category_name?: string;
  branch_id: string;
  branch_name?: string;
  description: string;
  expense_date: string;
  payment_method: string;
  settlement_type?: "DIRECT_PAYMENT" | "CREDIT_ACCRUAL" | "BRANCH_PAID";
  bank_account_id?: string | null;
  teller_session_id?: string | null;
  voucher_id?: string | null;
  reversal_voucher_id?: string | null;
  reversal_reason?: string | null;
  itc_eligibility?: "ITC_ELIGIBLE" | "ITC_INELIGIBLE";
  rcm_applicable?: boolean;
  reference_no: string | null;
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED" | "REVERSED" | "CANCELLED";
  created_by: string;
  approved_by?: string | null;
  notes?: string | null;
}

export interface DepositSlipQueueItem {
  id: string;
  slip_reference: string;
  branch_id: string;
  branch_name?: string;
  bank_account_id: string;
  bank_name?: string;
  account_number?: string;
  deposit_amount: number;
  deposit_date: string;
  status: "PREPARED" | "APPROVED" | "POSTED" | "CANCELLED" | "REJECTED";
  prepared_by: string;
  approved_by?: string | null;
  posted_by?: string | null;
  denominations?: Record<string, number>;
  transit_voucher_id?: string | null;
  notes?: string | null;
}

export interface GatewayBatchQueueItem {
  id: string;
  provider: string;
  payout_reference: string;
  settlement_date: string;
  gross_amount: number | string;
  identified_fee_amount: number | string;
  reported_tax_amount: number | string;
  net_amount: number | string;
  status: "INGESTED" | "APPROVED" | "POSTED" | "EXCEPTION" | "CANCELLED";
  prepared_by: string;
  approved_by?: string;
  posted_by?: string;
  unreconciled_exception_count: number;
  bank_name?: string;
}

// ── Generic API Helper ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1/${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });
  return res.json();
}

// ── Work Queue Summary ────────────────────────────────────────────────────────

export async function fetchWorkQueueSummary(branchId?: string): Promise<WorkQueueSummary> {
  const params = new URLSearchParams();
  if (branchId) params.set("branch_id", branchId);
  const data = await apiFetch<{ success: boolean; summary: WorkQueueSummary }>(
    `admin/accounting/work-queue/summary?${params}`
  );
  if (!data.success) {
    throw new Error((data as any).error || "Failed to fetch work queue summary");
  }
  return data.summary;
}

// ── Purchases Queue ───────────────────────────────────────────────────────────

export async function fetchPurchasesForQueue(filters?: {
  branchId?: string;
  status?: string;
}): Promise<PurchaseQueueItem[]> {
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (filters?.branchId) params.set("branch_id", filters.branchId);
  if (filters?.status) params.set("status", filters.status);

  const data = await apiFetch<{ success: boolean; data?: { purchases: PurchaseQueueItem[] }; error?: string }>(
    `admin/purchases?${params}`
  );
  if (!data.success) throw new Error(data.error || "Failed to load purchases queue");
  return data.data?.purchases || [];
}

export async function previewPurchaseVoucher(purchaseId: string): Promise<any> {
  const data = await apiFetch<{ success: boolean; data?: any; error?: string }>(
    `admin/purchases/${purchaseId}/preview-voucher`
  );
  if (!data.success) throw new Error(data.error || "Failed to generate purchase voucher preview");
  return data.data;
}

export async function approvePurchase(purchaseId: string): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(`admin/purchases/${purchaseId}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "APPROVED" }),
  });
}

export async function postPurchaseToGL(
  purchaseId: string,
  payload?: {
    voucher_created_by?: string;
    voucher_approved_by?: string;
    posted_by?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(`admin/purchases/${purchaseId}/post`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

// ── Expenses Queue ────────────────────────────────────────────────────────────

export async function fetchExpensesForQueue(filters?: {
  branchId?: string;
  status?: string;
}): Promise<ExpenseQueueItem[]> {
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (filters?.branchId) params.set("branch_id", filters.branchId);
  if (filters?.status) params.set("status", filters.status);

  const data = await apiFetch<{ success: boolean; data?: { expenses: ExpenseQueueItem[] }; error?: string }>(
    `admin/expenses?${params}`
  );
  if (!data.success) throw new Error(data.error || "Failed to load expenses queue");
  return data.data?.expenses || [];
}

export async function approveExpense(expenseId: string): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(`admin/expenses/${expenseId}/approve`, {
    method: "POST",
  });
}

export async function postExpenseToGL(expenseId: string): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(`admin/expenses/${expenseId}/post`, {
    method: "POST",
  });
}

export async function returnExpenseToDraft(expenseId: string): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(`admin/expenses/${expenseId}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "DRAFT" }),
  });
}

export async function fetchExpenseAccounting(expenseId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(`admin/expenses/${expenseId}/accounting`);
}

export async function reverseExpense(
  expenseId: string,
  payload: {
    reversal_reason: string;
    target_teller_session_id?: string;
    cash_return_destination?: "TELLER_DRAWER" | "PETTY_CASH";
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(`admin/expenses/${expenseId}/reverse`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Bank Deposit Slips Queue ──────────────────────────────────────────────────

export async function fetchDepositSlipsForQueue(filters?: {
  branchId?: string;
  status?: string;
}): Promise<DepositSlipQueueItem[]> {
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (filters?.branchId) params.set("branch_id", filters.branchId);
  if (filters?.status) params.set("status", filters.status);

  const data = await apiFetch<{ success: boolean; data?: { items: DepositSlipQueueItem[] }; error?: string }>(
    `admin/bank-deposit-slips?${params}`
  );
  if (!data.success) throw new Error(data.error || "Failed to load deposit slips queue");
  return data.data?.items || [];
}

export async function approveBankDeposit(
  slipId: string,
  approvedBy?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(
    `admin/bank-deposit-slips/${slipId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ approved_by: approvedBy || "acct_supervisor" }),
    }
  );
}

export async function postBankDepositToGL(
  slipId: string,
  voucherDate?: string,
  postedBy?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(
    `admin/bank-deposit-slips/${slipId}/post`,
    {
      method: "POST",
      body: JSON.stringify({
        voucher_date: voucherDate || new Date().toISOString().split("T")[0],
        posted_by: postedBy || "finance_controller",
      }),
    }
  );
}

export async function rejectBankDeposit(
  slipId: string,
  reason: string,
  rejectedBy?: string
): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(
    `admin/bank-deposit-slips/${slipId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        rejection_reason: reason,
        rejected_by: rejectedBy || "acct_supervisor",
      }),
    }
  );
}

// ── Gateway Settlement Batches Queue ──────────────────────────────────────────

export async function fetchGatewayBatchesForQueue(filters?: {
  status?: string;
}): Promise<GatewayBatchQueueItem[]> {
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (filters?.status) params.set("status", filters.status);

  const data = await apiFetch<{ success: boolean; data?: { batches: GatewayBatchQueueItem[] }; error?: string }>(
    `admin/gateway-settlements/batches?${params}`
  );
  if (!data.success) throw new Error(data.error || "Failed to load gateway settlement batches");
  return data.data?.batches || [];
}

export async function approveGatewayBatch(
  batchId: string,
  approvedBy?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(
    `admin/gateway-settlements/batches/${batchId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ approved_by: approvedBy || "acct_supervisor" }),
    }
  );
}

export async function postGatewayBatchToGL(
  batchId: string,
  postedBy?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(
    `admin/gateway-settlements/batches/${batchId}/post`,
    {
      method: "POST",
      body: JSON.stringify({ posted_by: postedBy || "finance_controller" }),
    }
  );
}

export async function cancelGatewayBatch(
  batchId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(
    `admin/gateway-settlements/batches/${batchId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  );
}

// ── Sales Vouchers Queue (Phase 5C) ──────────────────────────────────────────

export async function fetchSalesForQueue(filters?: {
  branchId?: string;
  status?: string;
}): Promise<SalesQueueItem[]> {
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (filters?.branchId) params.set("branch_id", filters.branchId);
  if (filters?.status) params.set("status", filters.status);

  const data = await apiFetch<{ success: boolean; data?: { sales: SalesQueueItem[] }; error?: string }>(
    `admin/accounting/work-queue/sales?${params}`
  );
  if (!data.success) throw new Error(data.error || "Failed to load sales vouchers queue");
  return data.data?.sales || [];
}

export async function approveSalesVoucher(
  voucherId: string,
  approvedBy?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(
    `admin/accounting/sales-vouchers/${voucherId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ approved_by: approvedBy || "acct_supervisor" }),
    }
  );
}

export async function postSalesVoucherToGL(
  voucherId: string,
  postedBy?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return apiFetch<{ success: boolean; data?: any; error?: string }>(
    `admin/accounting/sales-vouchers/${voucherId}/post`,
    {
      method: "POST",
      body: JSON.stringify({ posted_by: postedBy || "finance_controller" }),
    }
  );
}
