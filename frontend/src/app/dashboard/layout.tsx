import { retrieveUser } from "@frontend/lib/data";
import type { Metadata } from "next";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

export const metadata: Metadata = {
  title: "CakeToHome — Admin Dashboard",
  description: "Bakery management and operations control dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DashboardErrorBoundary moduleName="Root Dashboard Layout">
      {children}
    </DashboardErrorBoundary>
  );
}
