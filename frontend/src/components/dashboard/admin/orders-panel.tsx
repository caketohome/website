"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, StatusBadge, Badge, Input, Button } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Search, Eye, RefreshCw } from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";

export const OrdersPanel = memo(function OrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getAdminOrders()
      .then((r: any) => {
        const list = r?.orders || r?.data || [];
        setOrders(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error("[Orders Panel Error] Failed to fetch admin orders:", err);
        setError(err.message || "Failed to load orders");
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const statusColor = (s: string) => {
    const map: Record<string, "green" | "orange" | "red" | "blue" | "grey"> = {
      delivered: "green", completed: "green", pending: "orange", preparing: "blue",
      in_transit: "blue", cancelled: "red", declined: "red",
    };
    return map[s?.toLowerCase()] || "grey";
  };

  const filtered = orders.filter((o: any) => {
    if (!o) return false;
    try {
      return JSON.stringify(o).toLowerCase().includes(search.toLowerCase());
    } catch {
      return false;
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Orders Management</Heading>
          <Text className="text-ui-fg-subtle text-sm">View and manage all platform orders.</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" variant="secondary" onClick={fetchOrders} className="flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Badge color="purple">{orders.length} total</Badge>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button size="small" variant="secondary" onClick={fetchOrders}>Retry Fetch</Button>
        </div>
      )}

      <WidgetErrorBoundary moduleName="Orders Search Bar" compact>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
          <Input
            placeholder="Search orders by ID, customer, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </WidgetErrorBoundary>

      <WidgetErrorBoundary moduleName="Orders Table Grid" onRetry={fetchOrders} compact>
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : filtered.length === 0 ? (
          <Container className="p-8 text-center flex flex-col gap-2 items-center">
            <ShoppingCartEmpty />
            <Text className="text-ui-fg-muted text-sm">No orders found. Orders will appear here when customers place them.</Text>
            {orders.length === 0 && (
              <Button size="small" variant="secondary" onClick={fetchOrders} className="mt-2 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" /> Retry Loading Orders
              </Button>
            )}
          </Container>
        ) : (
          <Container className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border-base bg-ui-bg-subtle">
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Order ID</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Customer</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Status</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Total</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Date</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((o: any, i: number) => (
                  <tr key={o?.id || i} className="border-b border-ui-border-base hover:bg-ui-bg-subtle-hover transition-colors">
                    <td className="p-3 font-mono text-xs">{o?.id || o?.order_id || `ORD-${i + 1}`}</td>
                    <td className="p-3 text-xs">{o?.customer_name || o?.customer?.name || "—"}</td>
                    <td className="p-3"><StatusBadge color={statusColor(o?.status)} className="text-[10px]">{o?.status || "pending"}</StatusBadge></td>
                    <td className="p-3 text-xs font-medium">₹{o?.total || o?.amount || "0"}</td>
                    <td className="p-3 text-xs text-ui-fg-muted">{o?.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3">
                      <button onClick={() => setSelectedOrder(o)} className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>
        )}
      </WidgetErrorBoundary>

      {selectedOrder && (
        <WidgetErrorBoundary moduleName="Order Detail Modal" compact>
          <Container className="p-5 border-2 border-ui-border-interactive">
            <div className="flex items-center justify-between mb-3">
              <Text className="font-semibold">Order Details: {selectedOrder.id || selectedOrder.order_id}</Text>
              <button onClick={() => setSelectedOrder(null)} className="text-xs underline text-ui-fg-subtle">Close</button>
            </div>
            <pre className="text-xs bg-ui-bg-subtle p-3 rounded overflow-x-auto max-h-60">
              {JSON.stringify(selectedOrder, null, 2)}
            </pre>
          </Container>
        </WidgetErrorBoundary>
      )}
    </div>
  );
});

function ShoppingCartEmpty() {
  return <div className="w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center text-2xl">🛒</div>;
}

