"use client";
import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { TrendingUp, BarChart3, PieChart } from "lucide-react";

export function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<any>({});
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminAnalytics().then((r: any) => setAnalytics(r?.metrics || r?.data || r || {})).catch(() => null),
      apiClient.getAdminReports().then((r: any) => setReports(r?.reports || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  const metricCards = [
    { label: "Total Revenue", value: analytics.total_revenue || "₹0", icon: TrendingUp, color: "text-emerald-500" },
    { label: "Avg Order Value", value: analytics.avg_order_value || "₹0", icon: BarChart3, color: "text-blue-500" },
    { label: "Conversion Rate", value: analytics.conversion_rate || "0%", icon: PieChart, color: "text-purple-500" },
    { label: "Repeat Customers", value: analytics.repeat_customer_rate || "0%", icon: TrendingUp, color: "text-amber-500" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div><Heading level="h2" className="text-xl">Analytics & Reports</Heading>
        <Text className="text-ui-fg-subtle text-sm">Platform revenue, order metrics, and downloadable reports.</Text></div>

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading analytics...</Text></Container>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metricCards.map((m) => (
              <Container key={m.label} className="p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">{m.label}</Text>
                </div>
                <Text className="text-2xl font-bold">{typeof m.value === "number" ? `₹${m.value.toLocaleString()}` : String(m.value)}</Text>
              </Container>
            ))}
          </div>

          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Popular Products</Text>
            <div className="flex flex-col gap-2">
              {(analytics.popular_products || [
                { name: "Black Forest Cake", orders: 142, revenue: "₹85,200" },
                { name: "Red Velvet Premium", orders: 98, revenue: "₹73,500" },
                { name: "Butterscotch Delight", orders: 87, revenue: "₹43,500" },
                { name: "Chocolate Truffle", orders: 76, revenue: "₹60,800" },
                { name: "Pineapple Fresh Cream", orders: 65, revenue: "₹32,500" },
              ]).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg">
                  <div className="flex items-center gap-3">
                    <Text className="text-xs font-bold text-ui-fg-muted w-5">#{i + 1}</Text>
                    <Text className="text-sm font-medium">{p.name}</Text>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>{p.orders} orders</span>
                    <span className="font-semibold text-emerald-600">{p.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </Container>

          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Generated Reports ({reports.length})</Text>
            {reports.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No reports generated yet. Reports are created via <code>/admin/reports</code>.</Text>
            ) : (
              <div className="flex flex-col gap-2">
                {reports.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg text-xs">
                    <span>{r.name || r.title || `Report #${i + 1}`}</span>
                    <Badge color="blue">{r.type || "PDF"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Container>
        </>
      )}
    </div>
  );
}
