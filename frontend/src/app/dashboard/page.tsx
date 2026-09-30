"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { AdminShell } from "@frontend/components/admin/AdminShell";
import { AdminSidebar } from "@frontend/components/admin/AdminSidebar";
import { AdminTopbar } from "@frontend/components/admin/AdminTopbar";
import { DashboardPanelSkeleton } from "@frontend/components/dashboard/admin/dashboard-skeleton";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

/* ─────────────────────────────────────────────────────────────────────────────
 * Dynamic panel loader with retry on chunk error
 * ────────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * Panel registry — all 22 existing panels preserved
 * ────────────────────────────────────────────────────────────────────────── */

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
const MediaLibraryPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/media-library-panel").then((mod) => ({ default: mod.MediaLibraryPanel })),
  "MediaLibraryPanel"
);
const SupplierPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/supplier-panel"),
  "SupplierPanel"
);
const PurchasePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/purchase-panel"),
  "PurchasePanel"
);
const ExpensePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/expense-panel"),
  "ExpensePanel"
);
const FleetPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/fleet-panel"),
  "FleetPanel"
);
const GatewaySettlementPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/gateway-settlement-panel"),
  "GatewaySettlementPanel"
);
const BankReconciliationPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bank-reconciliation-panel"),
  "BankReconciliationPanel"
);
const GeneralLedgerPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/general-ledger-panel"),
  "GeneralLedgerPanel"
);
const AccountingSetupPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/accounting-setup-panel"),
  "AccountingSetupPanel"
);
const ProfitLossPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/profit-loss-panel"),
  "ProfitLossPanel"
);
const BalanceSheetPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/balance-sheet-panel"),
  "BalanceSheetPanel"
);
const CashFlowPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/cash-flow-panel").then((mod) => ({ default: mod.CashFlowPanel })),
  "CashFlowPanel"
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Tab ID type and panel map — backwards compatible
 * ────────────────────────────────────────────────────────────────────────── */

type AdminTabId =
  | "orders" | "catalog" | "search_engine" | "branches" | "delivery"
  | "fulfillment" | "suppliers" | "purchases" | "expenses" | "gateway_settlements" | "bank_reconciliation" | "general_ledger" | "profit_loss" | "balance_sheet" | "cash_flow" | "accounting_setup" | "fleet" | "tax_master" | "abandoned_carts" | "telemarketing"
  | "crm" | "login_activity" | "marketing" | "popups" | "seo"
  | "automation" | "webhooks" | "cms" | "media" | "analytics" | "ai_concierge"
  | "staff_profiles" | "notifications" | "settings";

const PANEL_MAP: Record<AdminTabId, React.ComponentType> = {
  orders: OrdersPanel,
  catalog: CatalogPanel,
  search_engine: SearchConfigPanel,
  branches: BranchesPanel,
  delivery: DeliveryPanel,
  fulfillment: FulfillmentConfigPanel,
  suppliers: SupplierPanel,
  purchases: PurchasePanel,
  expenses: ExpensePanel,
  gateway_settlements: GatewaySettlementPanel,
  bank_reconciliation: BankReconciliationPanel,
  general_ledger: GeneralLedgerPanel,
  profit_loss: ProfitLossPanel,
  balance_sheet: BalanceSheetPanel,
  cash_flow: CashFlowPanel,
  accounting_setup: AccountingSetupPanel,
  fleet: FleetPanel,
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
  media: MediaLibraryPanel,
  analytics: AnalyticsPanel,
  ai_concierge: AiConciergePanel,
  staff_profiles: StaffProfilesPanel,
  notifications: NotificationsPanel,
  settings: SettingsPanel,
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Page Component
 * ────────────────────────────────────────────────────────────────────────── */

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

  const handleTabChange = (tabId: string) => {
    const tab = tabId as AdminTabId;
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
    <AdminShell
      sidebar={
        <AdminSidebar
          activeTabId={activeTab}
          onNavigate={handleTabChange}
          user={user}
        />
      }
      topbar={
        <AdminTopbar
          user={user}
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: activeTab.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
          ]}
        />
      }
    >
      {/* Access denied banner */}
      {accessDeniedMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-semibold flex items-center justify-between">
          <span>{accessDeniedMessage}</span>
          <button onClick={() => setAccessDeniedMessage(null)} className="text-red-600 hover:text-red-800 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Active panel */}
      <div className="min-h-[400px] w-full min-w-0">
        <DashboardErrorBoundary key={activeTab} moduleName={`Admin Panel (${activeTab})`}>
          <Suspense fallback={<DashboardPanelSkeleton />}>
            <ActivePanel />
          </Suspense>
        </DashboardErrorBoundary>
      </div>
    </AdminShell>
  );
}
