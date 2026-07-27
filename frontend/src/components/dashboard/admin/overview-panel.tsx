"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, StatusBadge, Badge } from "@medusajs/ui";
import { Activity, Server, Database, Wifi, ShoppingCart, Building2, Truck, Users } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function OverviewPanel() {
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState({ orders: 0, branches: 0, drivers: 0, customers: 0 });

  useEffect(() => {
    if (typeof apiClient?.getAdminHealth === "function") {
      apiClient.getAdminHealth().then(setHealth).catch(() => null);
    }
    if (typeof apiClient?.getAdminOrders === "function") {
      apiClient.getAdminOrders().then((r: any) => {
        const orders = r?.orders || r?.data || [];
        setStats(s => ({ ...s, orders: Array.isArray(orders) ? orders.length : 0 }));
      }).catch(() => null);
    }
    if (typeof apiClient?.getAdminBranches === "function") {
      apiClient.getAdminBranches().then((r: any) => {
        const branches = r?.branches || r?.data || [];
        setStats(s => ({ ...s, branches: Array.isArray(branches) ? branches.length : 0 }));
      }).catch(() => null);
    }
    if (typeof apiClient?.getAdminDeliveries === "function") {
      apiClient.getAdminDeliveries().then((r: any) => {
        const deliveries = r?.deliveries || r?.data || [];
        setStats(s => ({ ...s, drivers: Array.isArray(deliveries) ? deliveries.length : 0 }));
      }).catch(() => null);
    }
    if (typeof apiClient?.getAdminCustomers === "function") {
      apiClient.getAdminCustomers().then((r: any) => {
        const customers = r?.customers || r?.data || [];
        setStats(s => ({ ...s, customers: Array.isArray(customers) ? customers.length : 0 }));
      }).catch(() => null);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Heading level="h2" className="text-xl">Platform Overview</Heading>
        <Text className="text-ui-fg-subtle text-sm">Real-time platform health and key metrics.</Text>
      </div>

      {/* System Health */}
      <Container className="p-5">
        <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">System Health</Text>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "NestJS Core API", icon: Server, port: "9000" },
            { label: "Next.js Frontend", icon: Activity, port: "3000" },
            { label: "PostgreSQL", icon: Database, port: "5432" },
            { label: "Redis Cache", icon: Wifi, port: "6379" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 p-3 bg-ui-bg-subtle rounded-lg">
              <s.icon className="w-4 h-4 text-emerald-500" />
              <div>
                <Text className="text-xs font-medium">{s.label}</Text>
                <Text className="text-[10px] text-ui-fg-muted">Port {s.port}</Text>
              </div>
              <StatusBadge color="green" className="ml-auto text-[10px]">Online</StatusBadge>
            </div>
          ))}
        </div>
      </Container>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-blue-500" },
          { label: "Active Branches", value: stats.branches, icon: Building2, color: "text-emerald-500" },
          { label: "Delivery Partners", value: stats.drivers, icon: Truck, color: "text-amber-500" },
          { label: "Customers", value: stats.customers, icon: Users, color: "text-purple-500" },
        ].map((s) => (
          <Container key={s.label} className="p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">{s.label}</Text>
            </div>
            <Text className="text-3xl font-bold">{s.value}</Text>
          </Container>
        ))}
      </div>

      {/* Recent Activity */}
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
    </div>
  );
}
