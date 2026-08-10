"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Heading, Text } from "@medusajs/ui";
import { AdminTabs, type AdminTabId } from "@frontend/components/dashboard/admin/admin-tabs";
import { DashboardPanelSkeleton } from "@frontend/components/dashboard/admin/dashboard-skeleton";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

// ---------------------------------------------------------------------------
// Lazy-load every admin panel via next/dynamic with ssr: false.
// Only the active panel is downloaded & rendered on the client.
// Each panel displays a smooth skeleton loader while loading.
// ---------------------------------------------------------------------------

const OrdersPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/orders-panel").then((mod) => mod.OrdersPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const CatalogPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/catalog-panel").then((mod) => mod.CatalogPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const BranchesPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/branches-panel").then((mod) => mod.BranchesPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const DeliveryPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/delivery-panel").then((mod) => mod.DeliveryPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const TaxMasterPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/tax-master-panel").then((mod) => mod.TaxMasterPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const CrmPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/crm-panel").then((mod) => mod.CrmPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const MarketingPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/marketing-panel").then((mod) => mod.MarketingPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const SeoPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/seo-panel").then((mod) => mod.SeoPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const MarketingAutomationPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/marketing-automation-panel").then((mod) => mod.MarketingAutomationPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const CmsPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/cms-panel").then((mod) => mod.CmsPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const AnalyticsPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/analytics-panel").then((mod) => mod.AnalyticsPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const NotificationsPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/notifications-panel").then((mod) => mod.NotificationsPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);
const SettingsPanel = dynamic(
  () => import("@frontend/components/dashboard/admin/settings-panel").then((mod) => mod.SettingsPanel),
  { ssr: false, loading: () => <DashboardPanelSkeleton /> }
);

const PANEL_MAP: Record<AdminTabId, React.ComponentType> = {
  orders: OrdersPanel,
  catalog: CatalogPanel,
  branches: BranchesPanel,
  delivery: DeliveryPanel,
  tax_master: TaxMasterPanel,
  crm: CrmPanel,
  marketing: MarketingPanel,
  seo: SeoPanel,
  automation: MarketingAutomationPanel,
  cms: CmsPanel,
  analytics: AnalyticsPanel,
  notifications: NotificationsPanel,
  settings: SettingsPanel,
};

export default function SuperAdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("orders");

  useEffect(() => {
    console.log("[Dashboard Init Step 1: Initializing SuperAdminDashboardPage]");
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab") as AdminTabId;
      if (p && PANEL_MAP[p]) {
        console.log(`[Dashboard Init Step 2: Tab selection from URL parameter -> "${p}"]`);
        setActiveTab(p);
      } else {
        console.log("[Dashboard Init Step 2: Default active tab -> 'orders']");
      }
    }
  }, []);

  const handleTabChange = (tab: AdminTabId) => {
    console.log(`[Dashboard Navigation: Tab Changed -> "${tab}"]`);
    setActiveTab(tab);
    if (typeof window !== "undefined" && window.history) {
      const newUrl = `${window.location.pathname}?tab=${tab}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    }
  };

  const ActivePanel = PANEL_MAP[activeTab];

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-1">
        <Heading level="h1" className="text-2xl font-bold">
          🛡️ Super Admin Control Panel
        </Heading>
        <Text className="text-ui-fg-subtle text-sm">
          Platform-wide management, monitoring, and operations dashboard.
        </Text>
      </div>

      <AdminTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="min-h-[400px]">
        <DashboardErrorBoundary key={activeTab} moduleName={`Admin Panel (${activeTab})`}>
          <ActivePanel />
        </DashboardErrorBoundary>
      </div>
    </div>
  );
}
