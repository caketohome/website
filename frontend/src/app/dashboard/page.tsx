"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { Heading, Text } from "@medusajs/ui";
import { AdminTabs, type AdminTabId } from "@frontend/components/dashboard/admin/admin-tabs";
import { DashboardPanelSkeleton } from "@frontend/components/dashboard/admin/dashboard-skeleton";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

// ---------------------------------------------------------------------------
// Resilient dynamic loader for admin panels with automatic retry on chunk error
// ---------------------------------------------------------------------------

function createDynamicPanel(
  importFn: () => Promise<{ [key: string]: any }>,
  exportKey: string
) {
  return dynamic(
    () =>
      importFn()
        .then((mod) => mod[exportKey] || mod.default)
        .catch((error) => {
          console.warn(`[Dynamic Chunk Load Retry for ${exportKey}]:`, error);
          // Wait 300ms and retry dynamic import
          return new Promise((resolve) => setTimeout(resolve, 300))
            .then(() => importFn())
            .then((mod) => mod[exportKey] || mod.default);
        }),
    {
      loading: () => <DashboardPanelSkeleton />,
      ssr: false,
    }
  );
}

const OrdersPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/orders-panel"),
  "OrdersPanel"
);
const CatalogPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/catalog-panel"),
  "CatalogPanel"
);
const BranchesPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/branches-panel"),
  "BranchesPanel"
);
const DeliveryPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/delivery-panel"),
  "DeliveryPanel"
);
const TaxMasterPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/tax-master-panel"),
  "TaxMasterPanel"
);
const AbandonedCartPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/abandoned-cart-panel"),
  "AbandonedCartPanel"
);
const TelemarketingPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/telemarketing-panel"),
  "TelemarketingPanel"
);
const CrmPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/crm-panel"),
  "CrmPanel"
);
const LoginActivityPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/login-activity-panel"),
  "LoginActivityPanel"
);
const MarketingPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/marketing-panel"),
  "MarketingPanel"
);
const PopupsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/popups-panel"),
  "PopupsPanel"
);
const SeoPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/seo-panel"),
  "SeoPanel"
);
const MarketingAutomationPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/marketing-automation-panel"),
  "MarketingAutomationPanel"
);
const WebhooksPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/webhooks-panel"),
  "WebhooksPanel"
);
const CmsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/cms-panel"),
  "CmsPanel"
);
const AnalyticsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/analytics-panel"),
  "AnalyticsPanel"
);
const AiConciergePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/ai-concierge-panel"),
  "AiConciergePanel"
);
const NotificationsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/notifications-panel"),
  "NotificationsPanel"
);
const StaffProfilesPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/staff-profiles-panel"),
  "StaffProfilesPanel"
);
const SettingsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/settings-panel"),
  "SettingsPanel"
);
const FulfillmentConfigPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/fulfillment-config-panel"),
  "FulfillmentConfigPanel"
);
const SearchConfigPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/search-config-panel").then((mod) => ({ default: mod.SearchConfigPanel })),
  "SearchConfigPanel"
);

const PANEL_MAP: Record<AdminTabId, React.ComponentType> = {
  orders: OrdersPanel,
  catalog: CatalogPanel,
  search_engine: SearchConfigPanel,
  branches: BranchesPanel,
  delivery: DeliveryPanel,
  fulfillment: FulfillmentConfigPanel,
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
