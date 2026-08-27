"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Building2,
  Receipt,
  ShieldAlert,
  Store,
  FileText,
  CreditCard,
  Truck,
  Bell,
  Shield,
  Plug,
  ScrollText,
  MapPin,
  Globe2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { BusinessProfileTab } from "./compliance/business-profile-tab";
import { GstRegistrationsTab } from "./compliance/gst-registrations-tab";
import { FssaiComplianceTab } from "./compliance/fssai-compliance-tab";
import { BranchComplianceTab } from "./compliance/branch-compliance-tab";
import { InvoiceBillingTab } from "./compliance/invoice-billing-tab";
import { PaymentConfigTab } from "./compliance/payment-config-tab";
import { DeliveryDefaultsTab } from "./compliance/delivery-defaults-tab";
import { NotificationsTab } from "./compliance/notifications-tab";
import { SecurityTab } from "./compliance/security-tab";
import { IntegrationsTab } from "./compliance/integrations-tab";
import { AuditLogsTab } from "./compliance/audit-logs-tab";
import { CitiesPanel } from "./cities-panel";
import { StatesPanel } from "./states-panel";

type SettingsTab =
  | "business"
  | "gst"
  | "fssai"
  | "branches"
  | "invoices"
  | "payments"
  | "delivery"
  | "notifications"
  | "security"
  | "integrations"
  | "audit"
  | "states"
  | "cities";

export const SettingsPanel = memo(function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("business");
  const [loading, setLoading] = useState(true);

  // Statutory Datasets
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [gstRegistrations, setGstRegistrations] = useState<any[]>([]);
  const [branchCompliance, setBranchCompliance] = useState<any[]>([]);
  const [fssaiOverview, setFssaiOverview] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [deliveryDefaults, setDeliveryDefaults] = useState<any>(null);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [integrationSettings, setIntegrationSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [securityConfig, setSecurityConfig] = useState<any>(null);

  const fetchAllComplianceData = async () => {
    setLoading(true);
    try {
      const [bundleRes, branchesRes, secRes, logsRes] = await Promise.all([
        apiClient.getAllComplianceBundle().catch(() => ({})),
        apiClient.getAdminBranches().catch(() => ({ branches: [] })),
        apiClient.getAdminSecurityConfig().catch(() => ({ config: {} })),
        apiClient.getAdminAuditLogs().catch(() => ({ logs: [] })),
      ]);

      const b = (bundleRes as any) || {};
      setBusinessProfile(b.profile || null);
      setGstRegistrations(b.gstRegistrations || []);
      setBranchCompliance(b.branchCompliance || []);
      setFssaiOverview(b.overview || null);
      setInvoiceSettings(b.invoiceSettings || null);
      setDeliveryDefaults(b.deliveryDefaults || null);
      setPaymentSettings(b.paymentSettings || null);
      setIntegrationSettings(b.integrationSettings || null);

      setBranches((branchesRes as any)?.branches || []);
      setSecurityConfig((secRes as any)?.config || null);
      setAuditLogs((logsRes as any)?.logs || (logsRes as any)?.data || []);
    } catch (err) {
      console.error("Failed to load compliance data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllComplianceData();
  }, []);

  const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType; badge?: string; badgeColor?: "green" | "orange" | "red" }> = [
    { id: "business", label: "Business Profile", icon: Building2 },
    { id: "gst", label: "Tax & GST", icon: Receipt, badge: `${gstRegistrations.length} States` },
    {
      id: "fssai",
      label: "FSSAI & Food Safety",
      icon: ShieldAlert,
      badge: fssaiOverview?.expiringSoon ? `⚠ ${fssaiOverview.expiringSoon} Expiring` : undefined,
      badgeColor: "orange",
    },
    { id: "branches", label: "Branch Compliance", icon: Store },
    { id: "invoices", label: "Invoice & Billing", icon: FileText },
    { id: "payments", label: "Payment Config", icon: CreditCard },
    { id: "delivery", label: "Delivery Defaults", icon: Truck },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security & MFA", icon: Shield },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "audit", label: "Audit Logs", icon: ScrollText },
    { id: "states", label: "States Master", icon: Globe2 },
    { id: "cities", label: "Cities Master", icon: MapPin },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Platform Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Heading level="h2" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Business, Tax & Statutory Compliance
            </Heading>
            <Badge color="green" size="small" className="font-semibold">
              Multi-City Hub Architecture
            </Badge>
          </div>
          <Text className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Global corporate identity, multi-state GSTIN registrations, branch-specific FoSCoS food licenses, and immutable tax invoicing.
          </Text>
        </div>

        <Button
          variant="secondary"
          size="small"
          onClick={fetchAllComplianceData}
          isLoading={loading}
          className="flex items-center gap-1.5 self-start md:self-auto text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Sync Statutory Records
        </Button>
      </div>

      {/* Modern Horizontal Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-amber-600 dark:text-amber-400"}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : tab.badgeColor === "orange"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      {loading ? (
        <Container className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
          <Text className="text-slate-500 text-sm">Loading business profile and statutory records...</Text>
        </Container>
      ) : (
        <div className="animate-in fade-in-50 duration-200">
          {activeTab === "business" && (
            <BusinessProfileTab
              profile={businessProfile}
              onProfileUpdated={(updated) => setBusinessProfile(updated)}
            />
          )}

          {activeTab === "gst" && (
            <GstRegistrationsTab
              registrations={gstRegistrations}
              branches={branches}
              onReload={fetchAllComplianceData}
            />
          )}

          {activeTab === "fssai" && (
            <FssaiComplianceTab
              complianceList={branchCompliance}
              overview={fssaiOverview}
              branches={branches}
              onReload={fetchAllComplianceData}
            />
          )}

          {activeTab === "branches" && (
            <BranchComplianceTab
              branches={branches}
              complianceList={branchCompliance}
              gstRegistrations={gstRegistrations}
              onReload={fetchAllComplianceData}
            />
          )}

          {activeTab === "invoices" && (
            <InvoiceBillingTab
              invoiceSettings={invoiceSettings}
              onUpdated={(updated) => setInvoiceSettings(updated)}
            />
          )}

          {activeTab === "payments" && (
            <PaymentConfigTab
              paymentSettings={paymentSettings}
              onUpdated={(updated) => setPaymentSettings(updated)}
            />
          )}

          {activeTab === "delivery" && (
            <DeliveryDefaultsTab
              deliveryDefaults={deliveryDefaults}
              onUpdated={(updated) => setDeliveryDefaults(updated)}
            />
          )}

          {activeTab === "notifications" && <NotificationsTab />}

          {activeTab === "security" && <SecurityTab securityConfig={securityConfig} />}

          {activeTab === "integrations" && (
            <IntegrationsTab
              integrationSettings={integrationSettings}
              onUpdated={(updated) => setIntegrationSettings(updated)}
            />
          )}

          {activeTab === "audit" && <AuditLogsTab auditLogs={auditLogs} />}

          {activeTab === "states" && <StatesPanel />}

          {activeTab === "cities" && <CitiesPanel />}
        </div>
      )}
    </div>
  );
});
