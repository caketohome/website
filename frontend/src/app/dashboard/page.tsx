"use client";

import { useState } from "react";
import { Heading, Text } from "@medusajs/ui";
import { AdminTabs, type AdminTabId } from "@frontend/components/dashboard/admin/admin-tabs";
import { OverviewPanel } from "@frontend/components/dashboard/admin/overview-panel";
import { AdminAiAssistantPanel } from "@frontend/components/dashboard/admin/admin-ai-assistant-panel";
import { OrdersPanel } from "@frontend/components/dashboard/admin/orders-panel";
import { CatalogPanel } from "@frontend/components/dashboard/admin/catalog-panel";
import { BranchesPanel } from "@frontend/components/dashboard/admin/branches-panel";
import { DeliveryPanel } from "@frontend/components/dashboard/admin/delivery-panel";
import { CrmPanel } from "@frontend/components/dashboard/admin/crm-panel";
import { MarketingPanel } from "@frontend/components/dashboard/admin/marketing-panel";
import { SeoPanel } from "@frontend/components/dashboard/admin/seo-panel";
import { AbTestingPanel } from "@frontend/components/dashboard/admin/ab-testing-panel";
import { MarketingAutomationPanel } from "@frontend/components/dashboard/admin/marketing-automation-panel";
import { RewardsPanel } from "@frontend/components/dashboard/admin/rewards-panel";
import { CmsPanel } from "@frontend/components/dashboard/admin/cms-panel";
import { AnalyticsPanel } from "@frontend/components/dashboard/admin/analytics-panel";
import { NotificationsPanel } from "@frontend/components/dashboard/admin/notifications-panel";
import { SettingsPanel } from "@frontend/components/dashboard/admin/settings-panel";

const PANEL_MAP: Record<AdminTabId, React.ComponentType> = {
  overview: OverviewPanel,
  ai_agent: AdminAiAssistantPanel,
  orders: OrdersPanel,
  catalog: CatalogPanel,
  branches: BranchesPanel,
  delivery: DeliveryPanel,
  crm: CrmPanel,
  marketing: MarketingPanel,
  seo: SeoPanel,
  ab_testing: AbTestingPanel,
  automation: MarketingAutomationPanel,
  rewards: RewardsPanel,
  cms: CmsPanel,
  analytics: AnalyticsPanel,
  notifications: NotificationsPanel,
  settings: SettingsPanel,
};

export default function SuperAdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");
  const ActivePanel = PANEL_MAP[activeTab];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Heading level="h1" className="text-2xl">
          🛡️ Super Admin Control Panel
        </Heading>
        <Text className="text-ui-fg-subtle text-sm">
          Platform-wide management, monitoring, and operations dashboard.
        </Text>
      </div>

      <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="min-h-[400px]">
        <ActivePanel />
      </div>
    </div>
  );
}
