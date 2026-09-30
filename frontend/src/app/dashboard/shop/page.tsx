import { retrieveUser } from "@frontend/lib/data";
import { ShopManagerDTO } from "@frontend/lib/types";
import { redirect } from "next/navigation";
import BranchOperationsManager from "@frontend/components/dashboard/shop/branch-operations-manager";

export const dynamic = "force-dynamic";

export default async function ShopDashboardPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;

  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  return (
    <div className="w-full">
      <BranchOperationsManager />
    </div>
  );
}


