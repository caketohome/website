"use client";

import React from "react";
import { AdminShell } from "@frontend/components/admin/AdminShell";
import { AdminSidebar } from "@frontend/components/admin/AdminSidebar";
import { AdminTopbar } from "@frontend/components/admin/AdminTopbar";
import { BankManagementDashboard } from "@frontend/components/dashboard/admin/bank-management-dashboard";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";
import { useRouter } from "next/navigation";

export default function AddBankAccountPage() {
  const router = useRouter();

  return (
    <AdminShell
      sidebar={<AdminSidebar activeTabId="bank_accounts" onNavigate={(tab) => router.push(`/dashboard?tab=${tab}`)} />}
      topbar={<AdminTopbar breadcrumbs={[{ label: "Accounting" }, { label: "Bank Accounts" }, { label: "Add Bank Account" }]} />}
    >
      <DashboardErrorBoundary moduleName="Add Bank Account">
        <BankManagementDashboard />
      </DashboardErrorBoundary>
    </AdminShell>
  );
}
