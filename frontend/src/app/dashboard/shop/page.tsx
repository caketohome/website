import { retrieveShop, retrieveUser } from "@frontend/lib/data";
import { ShopManagerDTO } from "@frontend/lib/types";
import { redirect } from "next/navigation";
import BranchOperationsManager from "@frontend/components/dashboard/shop/branch-operations-manager";

export const dynamic = "force-dynamic";

export default async function ShopDashboardPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;

  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN" && !user.id?.includes("shpmgr_") && !user.id?.includes("admin_") && !user.id?.includes("mgr_"))) {
    redirect("/login");
  }

  const shopId = user.shop_id || user.branch_id || "res_01KXYMAHGFPRY1G9TZKEVGAGAT";
  const shop = await retrieveShop(shopId);

  return (
    <div className="w-full">
      <BranchOperationsManager initialShop={shop} />
    </div>
  );
}

