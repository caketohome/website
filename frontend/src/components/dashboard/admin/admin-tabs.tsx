"use client";

import { useState } from "react";
import { Text } from "@medusajs/ui";
import {
  ShoppingCart, Package, Building2, Truck, MapPin,
  Users, Megaphone, Sparkles, FileText, BarChart3, Bell, Settings, Globe, Zap, Percent, ShieldCheck, KeyRound,
  PhoneCall, Plug, Clock, Search, ShoppingBag, Building, Receipt, Landmark, BookOpen, Settings2, TrendingUp, Scale,
  Waves, ClipboardCheck, Wallet, PieChart, Gift
} from "lucide-react";

const TABS = [
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "catalog", label: "Catalog", icon: Package },
  { id: "search_engine", label: "🔍 Search & Mapping", icon: Search },
  { id: "branches", label: "Branches", icon: Building2 },
  { id: "operational_closures", label: "📅 Holiday Scheduling", icon: Clock },
  { id: "marketplace", label: "🏪 Partner Marketplace", icon: Building },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "delivery_coverage", label: "🗺️ Coverage & Routing", icon: MapPin },
  { id: "fulfillment", label: "🕒 Operations & Cutoff", icon: Clock },
  { id: "suppliers", label: "Suppliers", icon: Building },
  { id: "accounting_work_queue", label: "⚡ Financial Work Queue", icon: ClipboardCheck },
  { id: "teller_custody", label: "Teller Cash Custody", icon: Wallet },
  { id: "purchases", label: "Purchases", icon: ShoppingBag },
  { id: "bills_payable", label: "Bills Payable (AP)", icon: Receipt },
  { id: "bills_receivable", label: "Bills Receivable (AR)", icon: Receipt },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "cost_allocations", label: "Cost Allocations", icon: PieChart },
  { id: "corporate_accounts", label: "Corporate Accounts & Roster", icon: Building2 },
  { id: "corporate_gifting", label: "Corporate Gifting", icon: Gift },
  { id: "corporate_routing_review", label: "📍 Routing Review Queue", icon: MapPin },
  { id: "gateway_settlements", label: "Gateway Settlements", icon: Receipt },
  { id: "bank_management", label: "Bank & Cash Management", icon: Landmark },
  { id: "bank_accounts", label: "Bank Accounts", icon: Landmark },
  { id: "bank_reconciliation", label: "Bank Reconciliation", icon: Landmark },
  { id: "general_ledger", label: "General Ledger", icon: BookOpen },
  { id: "profit_loss", label: "Profit & Loss", icon: TrendingUp },
  { id: "balance_sheet", label: "Balance Sheet", icon: Scale },
  { id: "cash_flow", label: "Cash Flow", icon: Waves },
  { id: "tds_register", label: "TDS Register", icon: Waves },
  { id: "accounting_setup", label: "Accounting Setup", icon: Settings2 },
  { id: "fleet", label: "Fleet & Fuel", icon: Truck },
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
  { id: "feature_flags", label: "🎛️ Feature Toggles", icon: Settings2 },
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

  const currentTabObj = visibleTabs.find((t) => t.id === activeTab) || visibleTabs[0];

  return (
    <div className="w-full min-w-0 max-w-full flex flex-col gap-2">
      {/* Mobile / Tablet Quick Module Selector Dropdown (< lg screens) */}
      <div className="flex lg:hidden items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <label htmlFor="mobile-admin-module-select" className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
          <span>Navigate Module:</span>
        </label>
        <select
          id="mobile-admin-module-select"
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value as AdminTabId)}
          className="flex-1 min-w-0 py-1.5 px-2.5 text-xs font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy cursor-pointer"
        >
          {visibleTabs.map((tab) => (
            <option key={tab.id} value={tab.id} className="text-slate-900 bg-white dark:text-white dark:bg-slate-800 py-1">
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Bounded Navigation Scroller (contained inside viewport bounds) */}
      <div className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-thin pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 min-w-max">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id as AdminTabId)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? "bg-brand-navy text-white border-b-2 border-brand-gold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-brand-gold" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { TABS };
