"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Heading, Text } from "@medusajs/ui";
import { AdminTabs, type AdminTabId } from "@frontend/components/dashboard/admin/admin-tabs";
import { DashboardPanelSkeleton } from "@frontend/components/dashboard/admin/dashboard-skeleton";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

// ---------------------------------------------------------------------------
// Lazy-load every admin panel via React.lazy with Suspense fallback.
// Only the active panel is loaded on demand when selected.
// ---------------------------------------------------------------------------

const OrdersPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/orders-panel").then((mod) => ({ default: mod.OrdersPanel }))
);
const CatalogPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/catalog-panel").then((mod) => ({ default: mod.CatalogPanel }))
);
const BranchesPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/branches-panel").then((mod) => ({ default: mod.BranchesPanel }))
);
const DeliveryPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/delivery-panel").then((mod) => ({ default: mod.DeliveryPanel }))
);
const TaxMasterPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/tax-master-panel").then((mod) => ({ default: mod.TaxMasterPanel }))
);
const CrmPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/crm-panel").then((mod) => ({ default: mod.CrmPanel }))
);
const MarketingPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/marketing-panel").then((mod) => ({ default: mod.MarketingPanel }))
);
const SeoPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/seo-panel").then((mod) => ({ default: mod.SeoPanel }))
);
const MarketingAutomationPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/marketing-automation-panel").then((mod) => ({ default: mod.MarketingAutomationPanel }))
);
const CmsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/cms-panel").then((mod) => ({ default: mod.CmsPanel }))
);
const AnalyticsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/analytics-panel").then((mod) => ({ default: mod.AnalyticsPanel }))
);
const NotificationsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/notifications-panel").then((mod) => ({ default: mod.NotificationsPanel }))
);
const SettingsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/settings-panel").then((mod) => ({ default: mod.SettingsPanel }))
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
          <Suspense fallback={<DashboardPanelSkeleton />}>
            <ActivePanel />
          </Suspense>
        </DashboardErrorBoundary>
      </div>
    </div>
  );
}
