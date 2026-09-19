"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * AdminShell — Premium responsive admin layout
 *
 * Desktop: Sidebar + Topbar + Content
 * Mobile:  Drawer + Compact Topbar + Full-width Content
 * ────────────────────────────────────────────────────────────────────────── */

interface AdminShellContextValue {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const AdminShellContext = createContext<AdminShellContextValue>({
  sidebarOpen: false,
  sidebarCollapsed: false,
  toggleSidebar: () => {},
  setSidebarOpen: () => {},
  setSidebarCollapsed: () => {},
});

export function useAdminShell() {
  return useContext(AdminShellContext);
}

interface AdminShellProps {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}

export function AdminShell({ sidebar, topbar, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    // On mobile: toggle drawer open/close
    // On desktop: toggle collapsed/expanded
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, []);

  const ctx: AdminShellContextValue = {
    sidebarOpen,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarOpen,
    setSidebarCollapsed,
  };

  return (
    <AdminShellContext.Provider value={ctx}>
      <div className="admin-shell flex h-screen w-full overflow-hidden bg-[var(--admin-page-bg,#F8FAFC)]">
        {/* ── Mobile overlay backdrop ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`
            admin-sidebar-container
            fixed inset-y-0 left-0 z-50
            lg:static lg:z-auto
            flex flex-col
            bg-[var(--admin-sidebar-bg,#0F1729)] text-white
            border-r border-[var(--admin-sidebar-border,rgba(30,46,91,0.4))]
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            ${sidebarCollapsed ? "w-[68px]" : "w-[260px]"}
          `}
        >
          {sidebar}
        </aside>

        {/* ── Main area (topbar + content) ── */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* ── Topbar ── */}
          <header className="admin-topbar shrink-0 h-14 flex items-center bg-white border-b border-[var(--admin-border,#E2E8F0)] px-4 lg:px-6 shadow-sm z-30">
            {topbar}
          </header>

          {/* ── Scrollable content area ── */}
          <main className="admin-content flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminShellContext.Provider>
  );
}
