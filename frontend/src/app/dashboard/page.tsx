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
const BankAccountsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bank-accounts-panel"),
  "BankAccountsPanel"
);
const BankManagementPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bank-management-dashboard"),
  "BankManagementDashboard"
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
const GstB2bRegisterPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/gst-b2b-register-panel").then((mod) => ({ default: mod.GstB2bRegisterPanel })),
  "GstB2bRegisterPanel"
);
const TdsRegisterPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/tds-register-panel").then((mod) => ({ default: mod.TdsRegisterPanel })),
  "TdsRegisterPanel"
);
const AccountingWorkQueuePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/accounting-work-queue-panel"),
  "AccountingWorkQueuePanel"
);
const TellerCustodyPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/teller-custody-panel"),
  "TellerCustodyPanel"
);
const ManualJournalsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/manual-journals-panel"),
  "ManualJournalsPanel"
);
const BillsPayablePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bills-payable-panel").then((mod) => ({ default: mod.BillsPayablePanel })),
  "BillsPayablePanel"
);
const BillsReceivablePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bills-receivable-panel").then((mod) => ({ default: mod.BillsReceivablePanel })),
  "BillsReceivablePanel"
);
const CostAllocationPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/cost-allocation-panel").then((mod) => ({ default: mod.CostAllocationPanel })),
  "CostAllocationPanel"
);
const CorporateAccountsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/corporate-accounts-panel").then((mod) => ({ default: mod.CorporateAccountsPanel })),
  "CorporateAccountsPanel"
);
const CorporateGiftingPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/corporate-gifting-panel").then((mod) => ({ default: mod.CorporateGiftingPanel })),
  "CorporateGiftingPanel"
);
const DeliveryCoveragePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/delivery-coverage-panel").then((mod) => ({ default: mod.DeliveryCoveragePanel })),
  "DeliveryCoveragePanel"
);
const CorporateRoutingReviewPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/corporate-routing-review-panel").then((mod) => ({ default: mod.CorporateRoutingReviewPanel })),
  "CorporateRoutingReviewPanel"
);
const MarketplacePanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/marketplace-panel").then((mod) => ({ default: mod.MarketplacePanel })),
  "MarketplacePanel"
);
const FeatureFlagsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/feature-flags-panel").then((mod) => ({ default: mod.FeatureFlagsPanel })),
  "FeatureFlagsPanel"
);
const OperationalClosuresPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/operational-closures-panel").then((mod) => ({ default: mod.OperationalClosuresPanel })),
  "OperationalClosuresPanel"
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Tab ID type and panel map — backwards compatible
 * ────────────────────────────────────────────────────────────────────────── */

type AdminTabId =
  | "orders" | "catalog" | "search_engine" | "branches" | "delivery" | "delivery_coverage"
  | "fulfillment" | "suppliers" | "purchases" | "bills_payable" | "bills_receivable" | "expenses" | "accounting_work_queue" | "teller_custody" | "manual_journals" | "cost_allocations" | "corporate_accounts" | "corporate_gifting" | "corporate_routing_review" | "gateway_settlements" | "bank_management" | "bank_accounts" | "bank_reconciliation" | "general_ledger" | "profit_loss" | "balance_sheet" | "cash_flow" | "tds_register" | "gst_b2b_register" | "accounting_setup" | "fleet" | "tax_master" | "abandoned_carts" | "telemarketing"
  | "crm" | "login_activity" | "marketing" | "popups" | "seo"
  | "automation" | "webhooks" | "cms" | "media" | "analytics" | "ai_concierge"
  | "staff_profiles" | "notifications" | "settings"
  | "marketplace" | "feature_flags" | "operational_closures";

const PANEL_MAP: Record<AdminTabId, React.ComponentType> = {
  orders: OrdersPanel,
  catalog: CatalogPanel,
  search_engine: SearchConfigPanel,
  branches: BranchesPanel,
  delivery: DeliveryPanel,
  delivery_coverage: DeliveryCoveragePanel,
  fulfillment: FulfillmentConfigPanel,
  suppliers: SupplierPanel,
  purchases: PurchasePanel,
  bills_payable: BillsPayablePanel,
  bills_receivable: BillsReceivablePanel,
  expenses: ExpensePanel,
  accounting_work_queue: AccountingWorkQueuePanel,
  teller_custody: TellerCustodyPanel,
  manual_journals: ManualJournalsPanel,
  cost_allocations: CostAllocationPanel,
  corporate_accounts: CorporateAccountsPanel,
  corporate_gifting: CorporateGiftingPanel,
  corporate_routing_review: CorporateRoutingReviewPanel,
  gateway_settlements: GatewaySettlementPanel,
  bank_management: BankManagementPanel,
  bank_accounts: BankManagementPanel,
  bank_reconciliation: BankReconciliationPanel,
  general_ledger: GeneralLedgerPanel,
  profit_loss: ProfitLossPanel,
  balance_sheet: BalanceSheetPanel,
  cash_flow: CashFlowPanel,
  tds_register: TdsRegisterPanel,
  gst_b2b_register: GstB2bRegisterPanel,
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
  marketplace: MarketplacePanel,
  feature_flags: FeatureFlagsPanel,
  operational_closures: OperationalClosuresPanel,
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Page Component
 * ────────────────────────────────────────────────────────────────────────── */

export default function SuperAdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("orders");
  const [user, setUser] = useState<any>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function verifyAndInitDashboard() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const sessionUser = json?.data?.user;

        if (!active) return;

        if (!sessionUser) {
          window.location.href = "/login";
          return;
        }

        const role = (sessionUser.role || "").toUpperCase();
        const userId = sessionUser.id || "";
        const phone = sessionUser.phone || "";
        const userObj = {
          role,
          userId,
          id: userId,
          phone,
          branchId: sessionUser.branch_id || null,
          permissions: sessionUser.permissions || [],
          permitted_tabs: (sessionUser.permitted_tabs || []) as string[],
        };
        setUser(userObj);

        // Sections come from the server (permitted_tabs); super admins can open everything.
        const allowed = (t: string) => role === "SUPER_ADMIN" || userObj.permitted_tabs.includes(t);
        const firstAllowed = (Object.keys(PANEL_MAP) as AdminTabId[]).find((t) => allowed(t));
        const p = new URLSearchParams(window.location.search).get("tab") as AdminTabId;
        if (p && PANEL_MAP[p] && allowed(p)) {
          setActiveTab(p);
        } else if (!allowed(activeTab)) {
          if (p) setAccessDeniedMessage(`Access Denied: you do not have access to "${p}".`);
          if (firstAllowed) setActiveTab(firstAllowed);
          else setAccessDeniedMessage("No sections have been assigned to your account yet. Ask a super admin to assign an access profile.");
        }
      } catch {
        if (active) window.location.href = "/login";
      }
    }
    verifyAndInitDashboard();
    return () => {
      active = false;
    };
  }, []);

  const handleTabChange = (tabId: string) => {
    const tab = tabId as AdminTabId;
    if (user && user.role !== "SUPER_ADMIN" && !(user.permitted_tabs || []).includes(tab)) {
      setAccessDeniedMessage(`Access Denied: you do not have access to "${tab}".`);
      setTimeout(() => setAccessDeniedMessage(null), 4000);
      return;
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-xs text-slate-500">
        Verifying administrator session...
      </div>
    );
  }

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
