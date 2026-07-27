"use client";

import { useState } from "react";
import { Text } from "@medusajs/ui";
import {
  LayoutDashboard, ShoppingCart, Package, Building2, Truck,
  Users, Megaphone, Gift, FileText, BarChart3, Bell, Settings, Globe, Bot, FlaskConical, Zap
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "ai_agent", label: "🤖 AI Command Center", icon: Bot },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "catalog", label: "Catalog", icon: Package },
  { id: "branches", label: "Branches", icon: Building2 },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "crm", label: "Customers", icon: Users },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "seo", label: "SEO & Digital", icon: Globe },
  { id: "ab_testing", label: "🧪 A/B Testing", icon: FlaskConical },
  { id: "automation", label: "⚡ Messaging & Auto", icon: Zap },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "cms", label: "Content", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type AdminTabId = (typeof TABS)[number]["id"];

interface AdminTabsProps {
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
}

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 border-b border-ui-border-base">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              isActive
                ? "bg-ui-bg-base text-ui-fg-base border border-b-0 border-ui-border-base shadow-sm"
                : "text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base-hover"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export { TABS };
