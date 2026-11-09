"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@frontend/components/admin/AdminShell";
import { AdminSidebar } from "@frontend/components/admin/AdminSidebar";
import { AdminTopbar } from "@frontend/components/admin/AdminTopbar";
import { OrdersPanel } from "@frontend/components/dashboard/admin/orders-panel";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

export default function AdminOrdersPage() {
  const router = useRouter();

  const handleNavigate = (tabId: string) => {
    if (tabId === "orders") {
      router.push("/admin/orders");
    } else {
      router.push(`/dashboard?tab=${tabId}`);
    }
  };

  return (
    <AdminShell
      sidebar={<AdminSidebar activeTabId="orders" onNavigate={handleNavigate} />}
      topbar={
        <AdminTopbar
          breadcrumbs={[
            { label: "Admin ERP", href: "/dashboard" },
            { label: "Orders Register", href: "/admin/orders" },
          ]}
        />
      }
    >
      <DashboardErrorBoundary moduleName="Admin Orders Register">
        <div className="w-full min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 lg:p-6 space-y-6">
          <OrdersPanel />
        </div>
      </DashboardErrorBoundary>
    </AdminShell>
  );
}

