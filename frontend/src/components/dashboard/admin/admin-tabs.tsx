"use client";

import { useState } from "react";
import { Text } from "@medusajs/ui";
import {
  ShoppingCart, Package, Building2, Truck,
  Users, Megaphone, Sparkles, FileText, BarChart3, Bell, Settings, Globe, Zap, Percent, ShieldCheck, KeyRound,
  PhoneCall, Plug
} from "lucide-react";

const TABS = [
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "catalog", label: "Catalog", icon: Package },
  { id: "branches", label: "Branches", icon: Building2 },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "tax_master", label: "Tax Master", icon: Percent },
  { id: "abandoned_carts", label: "Cart Recovery", icon: ShoppingCart },
  { id: "telemarketing", label: "📞 Reorder Outreach", icon: PhoneCall },
  { id: "crm", label: "Customers", icon: Users },
  { id: "login_activity", label: "Login Security", icon: ShieldCheck },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "popups", label: "Popup Manager", icon: Sparkles },
  { id: "seo", label: "SEO & Digital", icon: Globe },
  { id: "automation", label: "⚡ Messaging & Auto", icon: Zap },
  { id: "webhooks", label: "⚡ Event Gateway", icon: Plug },
  { id: "cms", label: "Content", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai_concierge", label: "🤖 AI Concierge", icon: Sparkles },
  { id: "staff_profiles", label: "👥 Staff Profiles", icon: KeyRound },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type AdminTabId = (typeof TABS)[number]["id"];

interface AdminTabsProps {
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
  user?: any;
}

export function AdminTabs({ activeTab, onTabChange, user }: AdminTabsProps) {
  // Dynamically derive visible tabs based on user permissions
  const visibleTabs = TABS.filter((tab) => {
    if (!user) return true;
    try {
      const { StaffAccessControl } = require("@frontend/lib/staff-access-control");
      return StaffAccessControl.isTabPermitted(user, tab.id);
    } catch {
      return true;
    }
  });

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 border-b border-ui-border-base">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as AdminTabId)}
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
