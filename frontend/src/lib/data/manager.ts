/**
 * CakeToHome Branch Manager Panel Data Access Layer
 * Provides typed methods for interacting with `/api/v1/manager/*` backend endpoints.
 */

export interface BranchManagerDashboardDTO {
  success: boolean;
  branch: {
    id: string;
    code: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    manager_name: string;
    is_open: boolean;
    is_paused: boolean;
    pause_until: string | null;
    pause_remaining_minutes: number;
    operational_status: string;
    operating_hours?: Record<string, { open: string; close: string; is_open: boolean }>;
    preparation_buffer_mins?: number;
  };
  kpis: {
    todays_orders: number;
    pending_orders: number;
    preparing_orders: number;
    ready_orders: number;
    in_transit_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    delayed_orders: number;
    online_riders: number;
    low_stock_items: number;
  };
  recent_orders: any[];
  timestamp: string;
}

export async function fetchBranchDashboard(): Promise<BranchManagerDashboardDTO> {
  const res = await fetch("/api/v1/manager/dashboard", {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBranchOrders(params: Record<string, string> = {}): Promise<{ success: boolean; orders: any[]; total: number }> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/v1/manager/orders${query ? `?${query}` : ""}`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch orders: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBranchOrderDetails(orderId: string): Promise<{ success: boolean; order: any }> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch order details: ${res.statusText}`);
  }
  return res.json();
}

export async function acceptBranchOrder(orderId: string, notes?: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
    credentials: "include",
  });
  return res.json();
}

export async function rejectBranchOrder(orderId: string, reason: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
    credentials: "include",
  });
  return res.json();
}

export async function holdBranchOrder(orderId: string, reason: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/hold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
    credentials: "include",
  });
  return res.json();
}

export async function delayBranchOrder(orderId: string, reason: string, newEta: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/delay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, new_eta: newEta }),
    credentials: "include",
  });
  return res.json();
}

export async function markBranchOrderReady(orderId: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/ready`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    credentials: "include",
  });
  return res.json();
}

export async function assignBranchOrderRider(orderId: string, partnerId: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/assign-rider`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner_id: partnerId }),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchOrderKot(orderId: string): Promise<{ success: boolean; kot: any }> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/kot`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function reprintBranchOrderKot(orderId: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/kot/reprint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchOrderInvoice(orderId: string): Promise<{ success: boolean; invoice: any }> {
  const res = await fetch(`/api/v1/manager/orders/${orderId}/invoice`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchProducts(): Promise<{ success: boolean; products: any[] }> {
  const res = await fetch(`/api/v1/manager/products`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function updateBranchProductAvailability(productId: string, status: string, reason?: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/products/${productId}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchInventory(): Promise<{ success: boolean; items: any[] }> {
  const res = await fetch(`/api/v1/manager/inventory`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function updateBranchInventoryStock(itemId: string, stock: number, threshold?: number): Promise<any> {
  const res = await fetch(`/api/v1/manager/inventory/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stock, threshold }),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchDeliveryPartners(): Promise<{ success: boolean; partners: any[] }> {
  const res = await fetch(`/api/v1/manager/delivery-partners`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchActiveDeliveries(): Promise<{ success: boolean; deliveries: any[] }> {
  const res = await fetch(`/api/v1/manager/deliveries/active`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function updateBranchStatus(status: string, pauseDurationMinutes?: number, reason?: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/branch/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, pause_duration_minutes: pauseDurationMinutes, reason }),
    credentials: "include",
  });
  return res.json();
}

export async function updateBranchSettings(settings: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/v1/manager/branch/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchReports(reportType: string, dateRange: string = "today"): Promise<any> {
  const res = await fetch(`/api/v1/manager/reports/${reportType}?range=${dateRange}`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchNotifications(): Promise<{ success: boolean; notifications: any[] }> {
  const res = await fetch(`/api/v1/manager/notifications`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function markBranchNotificationRead(notifId: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/notifications/${notifId}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════
// ── BRANCH PURCHASES & GRN ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

export async function fetchBranchPurchases(params: Record<string, string> = {}): Promise<{ success: boolean; data?: { purchases: any[]; total: number }; error?: string }> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/v1/admin/purchases${query ? `?${query}` : ""}`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchPurchaseDetails(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const res = await fetch(`/api/v1/admin/purchases/${id}`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function createBranchPurchase(data: any): Promise<any> {
  const res = await fetch(`/api/v1/admin/purchases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  return res.json();
}

export async function submitBranchPurchase(id: string): Promise<any> {
  const res = await fetch(`/api/v1/admin/purchases/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SUBMITTED" }),
    credentials: "include",
  });
  return res.json();
}

export async function recordBranchGrnReceipt(purchaseId: string, grnData: any): Promise<any> {
  const res = await fetch(`/api/v1/manager/purchases/${purchaseId}/grn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(grnData),
    credentials: "include",
  });
  return res.json();
}

export async function fetchSuppliers(): Promise<{ success: boolean; data?: { suppliers: any[]; total: number }; error?: string }> {
  const res = await fetch(`/api/v1/admin/suppliers?limit=200`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════
// ── BRANCH EXPENSES ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

export async function fetchBranchExpenses(params: Record<string, string> = {}): Promise<{ success: boolean; data?: { expenses: any[]; total: number }; error?: string }> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/v1/admin/expenses${query ? `?${query}` : ""}`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function createBranchExpense(data: any): Promise<any> {
  const res = await fetch(`/api/v1/admin/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  return res.json();
}

export async function submitBranchExpense(id: string): Promise<any> {
  const res = await fetch(`/api/v1/admin/expenses/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SUBMITTED" }),
    credentials: "include",
  });
  return res.json();
}

export async function fetchExpenseCategories(): Promise<{ success: boolean; data?: { categories: any[] }; error?: string }> {
  const res = await fetch(`/api/v1/admin/expense-categories`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════
// ── CASH, TELLER & BANK DEPOSIT SLIPS ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

export async function fetchBranchCashPosition(): Promise<any> {
  const res = await fetch(`/api/v1/manager/cash/position`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function recordDrawerOpeningFloat(openingFloat: number, notes?: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/cash/drawer/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opening_float: openingFloat, notes }),
    credentials: "include",
  });
  return res.json();
}

export async function recordDrawerClosingCount(closingAmount: number, notes?: string): Promise<any> {
  const res = await fetch(`/api/v1/manager/cash/drawer/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closing_amount: closingAmount, notes }),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchRiderCodCustody(): Promise<{ success: boolean; riders: any[] }> {
  const res = await fetch(`/api/v1/manager/cod/custody`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function settleRiderCodShift(data: any): Promise<any> {
  const res = await fetch(`/api/v1/admin/reports/cod/settlement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  return res.json();
}

export async function reportCodShortage(data: {
  rider_id: string;
  expected_amount: number;
  cash_presented: number;
  shortage_amount: number;
  reason?: string;
  notes: string;
}): Promise<any> {
  const res = await fetch(`/api/v1/manager/cash/cod/shortage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchBankDepositSlips(params: Record<string, string> = {}): Promise<{ success: boolean; slips: any[]; total: number }> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/v1/admin/bank-deposit-slips${query ? `?${query}` : ""}`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

export async function prepareBankDepositSlip(data: {
  bank_account_id: string;
  amount: number;
  deposit_date?: string;
  slip_number?: string;
  denominations?: Record<string, number>;
  metadata?: Record<string, unknown>;
}): Promise<any> {
  const res = await fetch(`/api/v1/admin/bank-deposit-slips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  return res.json();
}

export async function fetchBranchBankAccounts(): Promise<{ success: boolean; bankAccounts: any[] }> {
  const res = await fetch(`/api/v1/admin/bank-accounts?status=ACTIVE`, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "include",
  });
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════
// ── STOCK DAMAGE & SPOILAGE ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

export async function reportBranchStockDamage(data: {
  item_id: string;
  sku?: string;
  item_name: string;
  item_type?: string;
  quantity: number;
  reason_code: string;
  notes?: string;
}): Promise<any> {
  const res = await fetch(`/api/v1/manager/inventory/damage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  return res.json();
}

