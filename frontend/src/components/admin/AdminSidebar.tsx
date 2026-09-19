"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Bell, Activity,
  ShoppingCart, Package, DollarSign, Percent, ShoppingBag, PhoneCall,
  Building2, Truck, Clock, MapPin, Users as UsersIcon,
  Users, UserCircle, Heart, Star,
  Megaphone, Sparkles, Ticket, MessageSquare, Zap,
  FileText, Image, Globe, Map, Brain, Code2, SatelliteDish, BarChart4, Eye,
  BarChart3, TrendingUp, PieChart,
  Shield, KeyRound, ScrollText, Plug, Settings,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeft,
  Search,
} from "lucide-react";
import { useAdminShell } from "./AdminShell";

/* ─────────────────────────────────────────────────────────────────────────────
 * Sidebar Navigation Structure
 * ────────────────────────────────────────────────────────────────────────── */

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  tabId?: string; // maps to AdminTabId
  href?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, tabId: "orders" },
      { id: "notifications", label: "Notifications", icon: Bell, tabId: "notifications" },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    icon: ShoppingCart,
    items: [
      { id: "orders", label: "Orders", icon: ShoppingCart, tabId: "orders" },
      { id: "catalog", label: "Catalog", icon: Package, tabId: "catalog" },
      { id: "search_mapping", label: "Search & Mapping", icon: Search, tabId: "search_engine" },
      { id: "tax_master", label: "Tax Master", icon: Percent, tabId: "tax_master" },
      { id: "cart_recovery", label: "Cart Recovery", icon: ShoppingBag, tabId: "abandoned_carts" },
      { id: "reorder", label: "Reorder Outreach", icon: PhoneCall, tabId: "telemarketing" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Building2,
    items: [
      { id: "branches", label: "Branches", icon: Building2, tabId: "branches" },
      { id: "delivery", label: "Delivery", icon: Truck, tabId: "delivery" },
      { id: "fulfillment", label: "Operations & Cutoff", icon: Clock, tabId: "fulfillment" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    items: [
      { id: "crm", label: "Customers / CRM", icon: Users, tabId: "crm" },
      { id: "login_security", label: "Login Security", icon: Shield, tabId: "login_activity" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { id: "campaigns", label: "Campaigns", icon: Megaphone, tabId: "marketing" },
      { id: "popups", label: "Popups", icon: Sparkles, tabId: "popups" },
      { id: "messaging", label: "Messaging & Automation", icon: MessageSquare, tabId: "automation" },
      { id: "webhooks", label: "Event Gateway", icon: Zap, tabId: "webhooks" },
    ],
  },
  {
    id: "content_seo",
    label: "Content, SEO & AI",
    icon: Globe,
    items: [
      { id: "cms", label: "CMS Pages", icon: FileText, tabId: "cms" },
      { id: "media", label: "Media Library", icon: Image, tabId: "media" },
      { id: "seo", label: "SEO & Digital", icon: Globe, tabId: "seo" },
      { id: "ai_concierge", label: "AI Concierge", icon: Brain, tabId: "ai_concierge" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    items: [
      { id: "analytics", label: "Analytics", icon: BarChart3, tabId: "analytics" },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
      { id: "staff", label: "Staff Profiles", icon: KeyRound, tabId: "staff_profiles" },
      { id: "alerts", label: "Alerts", icon: Bell, tabId: "notifications" },
      { id: "settings", label: "Settings", icon: Settings, tabId: "settings" },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * AdminSidebar Component
 * ────────────────────────────────────────────────────────────────────────── */

interface AdminSidebarProps {
  activeTabId: string;
  onNavigate: (tabId: string) => void;
  user?: any;
}

export function AdminSidebar({ activeTabId, onNavigate, user }: AdminSidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed, setSidebarOpen } = useAdminShell();

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // Auto-expand the group containing the active tab
    const initial: Record<string, boolean> = {};
    NAV_GROUPS.forEach((group) => {
      const hasActive = group.items.some((item) => item.tabId === activeTabId);
      initial[group.id] = hasActive;
    });
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    if (sidebarCollapsed) return; // Don't toggle in collapsed mode
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleItemClick = (item: NavItem) => {
    if (item.tabId) {
      onNavigate(item.tabId);
    }
    // Close mobile drawer
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo area ── */}
      <div className="h-14 flex items-center px-4 border-b border-white/10 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 text-white hover:text-amber-300 transition-colors min-w-0">
          <span className="text-xl shrink-0">🎂</span>
          {!sidebarCollapsed && (
            <span className="text-sm font-bold tracking-wide truncate">CakeToHome</span>
          )}
        </Link>
        {!sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="ml-auto p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors hidden lg:flex"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="ml-auto p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors lg:hidden"
          title="Close menu"
        >
          ✕
        </button>
      </div>

      {/* ── Collapsed expand button ── */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="hidden lg:flex items-center justify-center py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      {/* ── Navigation groups ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-thumb-white/10" role="navigation" aria-label="Admin navigation">
        {NAV_GROUPS.map((group) => {
          const isExpanded = expandedGroups[group.id] ?? false;
          const hasActiveItem = group.items.some((item) => item.tabId === activeTabId);
          const GroupIcon = group.icon;

          return (
            <div key={group.id} className="mb-0.5">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`
                  w-full flex items-center gap-2.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider
                  transition-colors
                  ${hasActiveItem ? "text-[#D4AF37]" : "text-white/40 hover:text-white/70"}
                  ${sidebarCollapsed ? "justify-center px-0" : ""}
                `}
                title={sidebarCollapsed ? group.label : undefined}
              >
                {sidebarCollapsed ? (
                  <GroupIcon className="w-4 h-4" />
                ) : (
                  <>
                    <span className="truncate">{group.label}</span>
                    <span className="ml-auto">
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </span>
                  </>
                )}
              </button>

              {/* Group items */}
              {(isExpanded || sidebarCollapsed) && (
                <div className={sidebarCollapsed ? "flex flex-col items-center gap-0.5 py-1" : "flex flex-col gap-0.5 pb-1"}>
                  {group.items.map((item) => {
                    const isActive = item.tabId === activeTabId;
                    const ItemIcon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`
                          flex items-center gap-2.5 text-[13px] font-medium rounded-md transition-all
                          ${sidebarCollapsed ? "w-10 h-10 justify-center mx-auto" : "mx-2 px-3 py-2"}
                          ${
                            isActive
                              ? "bg-[#1D2F5D] text-white shadow-md border-l-2 border-[#D4AF37]"
                              : "text-white/70 hover:bg-white/8 hover:text-white"
                          }
                        `}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#D4AF37]" : ""}`} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User area (bottom) ── */}
      {!sidebarCollapsed && (
        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5 text-white/70">
            <div className="w-8 h-8 rounded-full bg-[#1D2F5D] flex items-center justify-center text-xs font-bold text-[#D4AF37]">
              {user?.role?.[0] || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {user?.userId || "Admin"}
              </div>
              <div className="text-[10px] text-white/50 truncate">
                {user?.role || "SUPER_ADMIN"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { NAV_GROUPS };
