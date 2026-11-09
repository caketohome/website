import { retrieveUser } from "@frontend/lib/data";
import { ShopManagerDTO } from "@frontend/lib/types";
import { redirect } from "next/navigation";
import BranchOperationsManager from "@frontend/components/dashboard/shop/branch-operations-manager";

export const dynamic = "force-dynamic";

export default async function BranchManagerPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;

  // Strict RBAC: authorized for BRANCH_MANAGER, SHOP_MANAGER, or SUPER_ADMIN
  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SHOP_MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950">
      <BranchOperationsManager />
    </div>
  );
}

