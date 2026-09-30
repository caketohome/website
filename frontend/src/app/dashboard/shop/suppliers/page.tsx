import { retrieveUser } from "@frontend/lib/data";
import { ShopManagerDTO } from "@frontend/lib/types";
import { redirect } from "next/navigation";
import SupplierPanel from "@frontend/components/dashboard/admin/supplier-panel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Suppliers | CakeToHome Admin",
  description: "Manage suppliers for the purchase module",
};

export default async function SuppliersPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;
  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }
  return (
    <div className="p-6">
      <SupplierPanel />
    </div>
  );
}
