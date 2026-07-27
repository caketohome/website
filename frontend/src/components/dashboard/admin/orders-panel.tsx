"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, StatusBadge, Badge, Input } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Search, Eye } from "lucide-react";

export function OrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.getAdminOrders().then((r: any) => {
      const list = r?.orders || r?.data || [];
      setOrders(Array.isArray(list) ? list : []);
    }).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    const map: Record<string, "green" | "orange" | "red" | "blue" | "grey"> = {
      delivered: "green", completed: "green", pending: "orange", preparing: "blue",
      in_transit: "blue", cancelled: "red", declined: "red",
    };
    return map[s?.toLowerCase()] || "grey";
  };

  const filtered = orders.filter((o: any) =>
    JSON.stringify(o).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Orders Management</Heading>
          <Text className="text-ui-fg-subtle text-sm">View and manage all platform orders.</Text>
        </div>
        <Badge color="purple">{orders.length} total</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
        <Input
          placeholder="Search orders by ID, customer, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading orders...</Text></Container>
      ) : filtered.length === 0 ? (
        <Container className="p-8 text-center flex flex-col gap-2 items-center">
          <ShoppingCartEmpty />
          <Text className="text-ui-fg-muted text-sm">No orders found. Orders will appear here when customers place them.</Text>
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
                <tr key={o.id || i} className="border-b border-ui-border-base hover:bg-ui-bg-subtle-hover transition-colors">
                  <td className="p-3 font-mono text-xs">{o.id || o.order_id || `ORD-${i + 1}`}</td>
                  <td className="p-3 text-xs">{o.customer_name || o.customer?.name || "—"}</td>
                  <td className="p-3"><StatusBadge color={statusColor(o.status)} className="text-[10px]">{o.status || "pending"}</StatusBadge></td>
                  <td className="p-3 text-xs font-medium">₹{o.total || o.amount || "0"}</td>
                  <td className="p-3 text-xs text-ui-fg-muted">{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
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

      {selectedOrder && (
        <Container className="p-5 border-2 border-ui-border-interactive">
          <div className="flex items-center justify-between mb-3">
            <Text className="font-semibold">Order Details: {selectedOrder.id || selectedOrder.order_id}</Text>
            <button onClick={() => setSelectedOrder(null)} className="text-xs underline text-ui-fg-subtle">Close</button>
          </div>
          <pre className="text-xs bg-ui-bg-subtle p-3 rounded overflow-x-auto max-h-60">
            {JSON.stringify(selectedOrder, null, 2)}
          </pre>
        </Container>
      )}
    </div>
  );
}

function ShoppingCartEmpty() {
  return <div className="w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center text-2xl">🛒</div>;
}
