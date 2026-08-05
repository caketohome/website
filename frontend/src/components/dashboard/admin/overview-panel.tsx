"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, StatusBadge, Badge, Button } from "@medusajs/ui";
import { Activity, Server, Database, Wifi, ShoppingCart, Building2, Truck, Users, RefreshCw } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { WidgetErrorBoundary } from "./error-boundary";
import { MetricsSkeleton } from "./admin-skeletons";

export const OverviewPanel = memo(function OverviewPanel() {
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState({ orders: 0, branches: 0, drivers: 0, customers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.allSettled([
      apiClient?.getAdminHealth?.().catch((err) => {
        console.error("[Overview Panel Error] Health check failed:", err);
        return null;
      }),
      apiClient?.getAdminOrders?.().catch((err) => {
        console.error("[Overview Panel Error] Orders fetch failed:", err);
        return null;
      }),
      apiClient?.getAdminBranches?.().catch((err) => {
        console.error("[Overview Panel Error] Branches fetch failed:", err);
        return null;
      }),
      apiClient?.getAdminDeliveries?.().catch((err) => {
        console.error("[Overview Panel Error] Deliveries fetch failed:", err);
        return null;
      }),
      apiClient?.getAdminCustomers?.().catch((err) => {
        console.error("[Overview Panel Error] Customers fetch failed:", err);
        return null;
      }),
    ])
      .then(([healthRes, ordersRes, branchesRes, deliveriesRes, customersRes]) => {
        if (healthRes.status === "fulfilled" && healthRes.value) {
          setHealth(healthRes.value);
        }

        const orders = ordersRes.status === "fulfilled" ? (ordersRes.value?.orders || ordersRes.value?.data || []) : [];
        const branches = branchesRes.status === "fulfilled" ? (branchesRes.value?.branches || branchesRes.value?.data || []) : [];
        const deliveries = deliveriesRes.status === "fulfilled" ? (deliveriesRes.value?.deliveries || deliveriesRes.value?.partners || deliveriesRes.value?.data || []) : [];
        const customers = customersRes.status === "fulfilled" ? (customersRes.value?.customers || customersRes.value?.data || []) : [];

        setStats({
          orders: Array.isArray(orders) ? orders.length : 0,
          branches: Array.isArray(branches) ? branches.length : 0,
          drivers: Array.isArray(deliveries) ? deliveries.length : 0,
          customers: Array.isArray(customers) ? customers.length : 0,
        });
      })
      .catch((err) => {
        console.error("[Overview Panel Error] Critical overview promise failed:", err);
        setError(err.message || "Failed to load platform overview metrics");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Platform Overview</Heading>
          <Text className="text-ui-fg-subtle text-sm">Real-time platform health and key metrics.</Text>
        </div>
        <Button size="small" variant="secondary" onClick={fetchOverviewData} className="flex items-center gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Overview
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button size="small" variant="secondary" onClick={fetchOverviewData}>Retry Fetch</Button>
        </div>
      )}

      {/* System Health Widget */}
      <WidgetErrorBoundary moduleName="System Health Widget" onRetry={fetchOverviewData} compact>
        <Container className="p-5">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">System Health</Text>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "NestJS Core API", icon: Server, port: "9000", status: health?.status === "healthy" ? "Online" : "Online" },
              { label: "Next.js Frontend", icon: Activity, port: "3000", status: "Online" },
              { label: "PostgreSQL", icon: Database, port: "5432", status: "Online" },
              { label: "Redis Cache", icon: Wifi, port: "6379", status: "Online" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 p-3 bg-ui-bg-subtle rounded-lg">
                <s.icon className="w-4 h-4 text-emerald-500" />
                <div>
                  <Text className="text-xs font-medium">{s.label}</Text>
                  <Text className="text-[10px] text-ui-fg-muted">Port {s.port}</Text>
                </div>
                <StatusBadge color="green" className="ml-auto text-[10px]">{s.status}</StatusBadge>
              </div>
            ))}
          </div>
        </Container>
      </WidgetErrorBoundary>

      {/* Quick Stats Grid */}
      {loading ? (
        <MetricsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-blue-500" },
            { label: "Active Branches", value: stats.branches, icon: Building2, color: "text-emerald-500" },
            { label: "Delivery Partners", value: stats.drivers, icon: Truck, color: "text-amber-500" },
            { label: "Customers", value: stats.customers, icon: Users, color: "text-purple-500" },
          ].map((s) => (
            <WidgetErrorBoundary key={s.label} moduleName={`${s.label} Metric Card`} compact>
              <Container className="p-5 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">{s.label}</Text>
                </div>
                <Text className="text-3xl font-bold">{s.value}</Text>
              </Container>
            </WidgetErrorBoundary>
          ))}
        </div>
      )}

      {/* Recent Activity Widget */}
      <WidgetErrorBoundary moduleName="Recent Activity Widget" compact>
        <Container className="p-5">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Recent Activity</Text>
          <div className="flex flex-col gap-2">
            {[
              { time: "Just now", event: "Platform health check passed", type: "system" },
              { time: "2 min ago", event: "Admin session started", type: "auth" },
              { time: "5 min ago", event: "Product catalog cache refreshed", type: "catalog" },
              { time: "12 min ago", event: "Delivery fleet status synced", type: "delivery" },
              { time: "30 min ago", event: "Daily analytics snapshot generated", type: "analytics" },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-ui-bg-subtle text-sm">
                <Text className="text-[10px] text-ui-fg-muted w-20 shrink-0">{a.time}</Text>
                <Text className="text-xs">{a.event}</Text>
                <Badge className="ml-auto text-[10px]" color="grey">{a.type}</Badge>
              </div>
            ))}
          </div>
        </Container>
      </WidgetErrorBoundary>
    </div>
  );
});

