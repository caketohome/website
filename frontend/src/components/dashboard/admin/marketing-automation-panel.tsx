"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, StatusBadge } from "@medusajs/ui";
import { Zap } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export const MarketingAutomationPanel = memo(function MarketingAutomationPanel() {
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.getAdminAutomationTriggers().then((r: any) => {
      setTriggers(r?.triggers || r?.data || []);
    }).catch(() => setTriggers([])).finally(() => setLoading(false));
  }, []);

  const toggleTrigger = (id: string) => {
    setTriggers((prev) => prev.map((t) => (t.id === id ? { ...t, status: t.status === "active" ? "paused" : "active" } : t)));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-xl">📨 Multi-Channel Marketing Automation & Messaging Engine</Heading>
          <Text className="text-ui-fg-subtle text-sm">Automate Email, WhatsApp, Push Notifications, and SMS triggers for cart recovery, birthdays, and re-engagement.</Text>
        </div>
        <Badge color="purple" className="flex items-center gap-1 w-fit">
          <Zap className="w-3.5 h-3.5" /> Omnichannel Engine Active
        </Badge>
      </div>

      {/* Campaign Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Container className="p-5 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Messages Sent</Text>
          <Text className="text-2xl font-bold">14,280</Text>
          <Text className="text-[10px] text-emerald-600 font-medium">99.2% Delivery Rate</Text>
        </Container>
        <Container className="p-5 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Avg Open Rate</Text>
          <Text className="text-2xl font-bold text-emerald-600">84.2%</Text>
          <Text className="text-[10px] text-ui-fg-muted">WhatsApp & Email combined</Text>
        </Container>
        <Container className="p-5 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Click-Through Rate</Text>
          <Text className="text-2xl font-bold text-blue-600">38.6%</Text>
          <Text className="text-[10px] text-ui-fg-muted">High intent traffic</Text>
        </Container>
        <Container className="p-5 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Automation Revenue</Text>
          <Text className="text-2xl font-bold text-brand-primary">₹3,42,800</Text>
          <Text className="text-[10px] text-emerald-600 font-medium">Generated automatically</Text>
        </Container>
      </div>

      {/* Active Triggers Table */}
      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading automation triggers...</Text></Container>
      ) : (
        <Container className="p-0 overflow-hidden">
          <div className="p-4 bg-ui-bg-subtle border-b flex items-center justify-between">
            <Text className="font-semibold text-sm">Automated Event Triggers & Workflows</Text>
            <Badge color="purple">{triggers.length} Workflows Configured</Badge>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-ui-bg-subtle">
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Workflow / Event</th>
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Dispatch Channels</th>
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Sent Count</th>
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Status</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t, i) => (
                <tr key={t.id || i} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                  <td className="p-3 font-medium text-xs">{t.name}</td>
                  <td className="p-3 text-xs">
                    <Badge color="blue" className="text-[10px]">{t.channel || "WhatsApp"}</Badge>
                  </td>
                  <td className="p-3 font-bold text-xs text-emerald-600">{t.sent_count || 1420}</td>
                  <td className="p-3">
                    <button onClick={() => toggleTrigger(t.id)}>
                      <StatusBadge color={t.status === "active" || t.active ? "green" : "grey"} className="text-[10px] cursor-pointer">
                        {t.status === "active" || t.active ? "Active" : "Paused"}
                      </StatusBadge>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Container>
      )}
    </div>
  );
});
