"use client";

import React, { useState } from "react";
import { AdminShell } from "@frontend/components/admin/AdminShell";
import { AdminSidebar } from "@frontend/components/admin/AdminSidebar";
import { AdminTopbar } from "@frontend/components/admin/AdminTopbar";
import { BankManagementDashboard } from "@frontend/components/dashboard/admin/bank-management-dashboard";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";
import { useRouter } from "next/navigation";

export default function AccountingBankManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("bank_management");

  const handleNavigate = (tabId: string) => {
    if (tabId === "bank_management" || tabId === "bank_accounts") {
      setActiveTab(tabId);
    } else {
      router.push(`/dashboard?tab=${tabId}`);
    }
  };

  return (
    <AdminShell
      sidebar={<AdminSidebar activeTabId={activeTab} onNavigate={handleNavigate} />}
      topbar={<AdminTopbar breadcrumbs={[{ label: "Accounting" }, { label: "Bank & Cash Management" }]} />}
    >
      <DashboardErrorBoundary moduleName="Accounting Bank Management">
        <BankManagementDashboard />
      </DashboardErrorBoundary>
    </AdminShell>
  );
}
