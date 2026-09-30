import { retrieveUser } from "@frontend/lib/data";
import { ShopManagerDTO } from "@frontend/lib/types";
import { redirect } from "next/navigation";
import FleetPanel from "@frontend/components/dashboard/admin/fleet-panel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Fleet & Delivery Cost | CakeToHome Admin",
  description: "Vehicle management, manual odometer trip logs, fuel tracking, and delivery logistics",
};

export default async function FleetPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;
  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }
  return (
    <div className="p-6">
      <FleetPanel />
    </div>
  );
}
