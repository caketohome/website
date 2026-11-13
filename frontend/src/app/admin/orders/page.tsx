"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@frontend/components/admin/AdminShell";
import { AdminSidebar } from "@frontend/components/admin/AdminSidebar";
import { AdminTopbar } from "@frontend/components/admin/AdminTopbar";
import { OrdersPanel } from "@frontend/components/dashboard/admin/orders-panel";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

export default function AdminOrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const sessionUser = json?.data?.user;
        if (!sessionUser) {
          router.replace("/login");
          return;
        }
        setUser({
          role: (sessionUser.role || "").toUpperCase(),
          userId: sessionUser.id || "",
          id: sessionUser.id || "",
          phone: sessionUser.phone || "",
          permissions: sessionUser.permissions || [],
        });
        setAuthChecked(true);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handleNavigate = (tabId: string) => {
    if (tabId === "orders") {
      router.push("/admin/orders");
    } else {
      router.push(`/dashboard?tab=${tabId}`);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-xs text-slate-500">
        Verifying administrator session...
      </div>
    );
  }

  return (
    <AdminShell
      sidebar={<AdminSidebar activeTabId="orders" onNavigate={handleNavigate} user={user} />}
      topbar={
        <AdminTopbar
          user={user}
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
