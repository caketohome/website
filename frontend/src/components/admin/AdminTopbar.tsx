"use client";

import React from "react";
import { Bell, Search, Menu } from "lucide-react";
import { adminDisplayName, useAdminShell } from "./AdminShell";

/* ─────────────────────────────────────────────────────────────────────────────
 * AdminTopbar — Compact top bar with hamburger, search, notifications, user
 * ────────────────────────────────────────────────────────────────────────── */

interface AdminTopbarProps {
  user?: any;
  breadcrumbs?: { label: string; href?: string }[];
}

export function AdminTopbar({ user, breadcrumbs }: AdminTopbarProps) {
  const { toggleSidebar } = useAdminShell();

  return (
    <div className="flex items-center justify-between w-full gap-3">
      {/* Left: hamburger + breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="hidden sm:flex items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="mx-1 text-slate-300">/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-slate-700 transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-slate-600 font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      {/* Right: search + notifications + user avatar */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Global search */}
        <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-56 lg:w-72 focus-within:ring-2 focus-within:ring-brand-gold/50 focus-within:border-brand-gold transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search orders, products, customers..."
            suppressHydrationWarning
            className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none border-none !ring-0"
          />
          <kbd className="hidden lg:inline-flex items-center text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 font-mono">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        {/* User avatar */}
        <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
          <div className="w-7 h-7 rounded-full bg-brand-navy flex items-center justify-center text-[10px] font-bold text-brand-gold">
            {user?.role?.[0] || "A"}
          </div>
          <div className="hidden lg:block text-left min-w-0">
            <div className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">
              {adminDisplayName(user)}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
