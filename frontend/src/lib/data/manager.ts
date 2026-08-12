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
