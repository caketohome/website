import { retrieveUser } from "@frontend/lib/data";
import { ShopManagerDTO } from "@frontend/lib/types";
import { redirect } from "next/navigation";
import PurchasePanel from "@frontend/components/dashboard/admin/purchase-panel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Purchases | CakeToHome Admin",
  description: "Purchase entry, approval, and reporting",
};

export default async function PurchasesPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;
  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }
  return (
    <div className="p-6">
      <PurchasePanel />
    </div>
  );
}
