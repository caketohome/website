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
const AbandonedCartPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/abandoned-cart-panel").then((mod) => ({ default: mod.AbandonedCartPanel }))
);
const TelemarketingPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/telemarketing-panel").then((mod) => ({ default: mod.TelemarketingPanel }))
);
const CrmPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/crm-panel").then((mod) => ({ default: mod.CrmPanel }))
);
const LoginActivityPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/login-activity-panel").then((mod) => ({ default: mod.LoginActivityPanel }))
);
const MarketingPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/marketing-panel").then((mod) => ({ default: mod.MarketingPanel }))
);
const PopupsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/popups-panel").then((mod) => ({ default: mod.PopupsPanel }))
);
const SeoPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/seo-panel").then((mod) => ({ default: mod.SeoPanel }))
);
const MarketingAutomationPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/marketing-automation-panel").then((mod) => ({ default: mod.MarketingAutomationPanel }))
);
const WebhooksPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/webhooks-panel").then((mod) => ({ default: mod.WebhooksPanel }))
);
const CmsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/cms-panel").then((mod) => ({ default: mod.CmsPanel }))
);
const AnalyticsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/analytics-panel").then((mod) => ({ default: mod.AnalyticsPanel }))
);
const AiConciergePanel = lazy(() =>
  import("@frontend/components/dashboard/admin/ai-concierge-panel").then((mod) => ({ default: mod.AiConciergePanel }))
);
const NotificationsPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/notifications-panel").then((mod) => ({ default: mod.NotificationsPanel }))
);
const StaffProfilesPanel = lazy(() =>
  import("@frontend/components/dashboard/admin/staff-profiles-panel").then((mod) => ({ default: mod.StaffProfilesPanel }))
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
  abandoned_carts: AbandonedCartPanel,
  telemarketing: TelemarketingPanel,
  crm: CrmPanel,
  login_activity: LoginActivityPanel,
  marketing: MarketingPanel,
  popups: PopupsPanel,
  seo: SeoPanel,
  automation: MarketingAutomationPanel,
  webhooks: WebhooksPanel,
  cms: CmsPanel,
  analytics: AnalyticsPanel,
  ai_concierge: AiConciergePanel,
  staff_profiles: StaffProfilesPanel,
  notifications: NotificationsPanel,
  settings: SettingsPanel,
};

export default function SuperAdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("orders");
  const [user, setUser] = useState<any>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Resolve user from cookies
      const cookies = document.cookie.split(";").reduce((acc: any, c) => {
        const [k, ...v] = c.trim().split("=");
        if (k) acc[k] = decodeURIComponent(v.join("="));
        return acc;
      }, {});

      const role = (cookies["_cth_role"] || "SUPER_ADMIN").toUpperCase();
      const userId = cookies["_cth_user_id"] || "admin_01";
      const phone = cookies["_cth_phone"] || "";
      const userObj = { role, userId, id: userId, phone };
      setUser(userObj);

      const p = new URLSearchParams(window.location.search).get("tab") as AdminTabId;
      if (p && PANEL_MAP[p]) {
        try {
          const { StaffAccessControl } = require("@frontend/lib/staff-access-control");
          if (!StaffAccessControl.isTabPermitted(userObj, p)) {
            setAccessDeniedMessage(`Access Denied: Your profile does not have permission for "${p}". Showing permitted default.`);
            // Find first permitted tab
            const permittedTab = (role === "STAFF" || role === "TELECALLER") ? "telemarketing" : "orders";
            setActiveTab(permittedTab as AdminTabId);
            return;
          }
        } catch {
          // ignore
        }
        setActiveTab(p);
      } else if (role === "TELECALLER" || (role === "STAFF" && phone.includes("9876543210"))) {
        setActiveTab("telemarketing");
      }
    }
  }, []);

  const handleTabChange = (tab: AdminTabId) => {
    if (user) {
      try {
        const { StaffAccessControl } = require("@frontend/lib/staff-access-control");
        if (!StaffAccessControl.isTabPermitted(user, tab)) {
          setAccessDeniedMessage(`Access Denied: Your profile does not have permission for "${tab}".`);
          setTimeout(() => setAccessDeniedMessage(null), 4000);
          return;
        }
      } catch {
        // ignore
      }
    }

    setAccessDeniedMessage(null);
    console.log(`[Dashboard Navigation: Tab Changed -> "${tab}"]`);
    setActiveTab(tab);
    if (typeof window !== "undefined" && window.history) {
      const newUrl = `${window.location.pathname}?tab=${tab}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    }
  };

  const ActivePanel = PANEL_MAP[activeTab] || OrdersPanel;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-1">
        <Heading level="h1" className="text-2xl font-bold">
          🛡️ Bakery Management & Operations Control
        </Heading>
        <Text className="text-ui-fg-subtle text-sm">
          Platform-wide management, operations, and role-governed administration dashboard.
        </Text>
      </div>

      {accessDeniedMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center justify-between">
          <span>{accessDeniedMessage}</span>
          <button onClick={() => setAccessDeniedMessage(null)} className="text-red-600 hover:text-red-800 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      <AdminTabs activeTab={activeTab} onTabChange={handleTabChange} user={user} />

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
