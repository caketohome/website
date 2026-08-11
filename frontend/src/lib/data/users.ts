import { cookies } from "next/headers";
import { retrieveSession } from "./sessions";

export async function retrieveUser(): Promise<any> {
  const cookieStore = cookies();
  const token = retrieveSession();
  const role = cookieStore.get("_cth_role")?.value || "delivery_partner";

  const activeRole = role || "delivery_partner";

  if (activeRole === "delivery_partner" || activeRole === "dlp") {
    return {
      id: "dlp_101",
      first_name: "Suresh",
      last_name: "Kumar",
      email: "suresh.k@cakes2home.com",
      phone: "+91 98123 45678",
      role: "DELIVERY_PARTNER",
    };
  }

  if (activeRole === "shop" || activeRole === "shpmgr" || activeRole === "branch_manager" || activeRole === "branch" || activeRole === "manager") {
    return {
      id: "shpmgr_01",
      shop_id: "shop_01",
      first_name: "Koramangala Hub",
      last_name: "Branch Manager",
      email: "manager@cakes2home.com",
      phone: "+91 98765 99999",
      role: "SHOP_MANAGER",
    };
  }

  if (activeRole === "admin" || activeRole === "super_admin") {
    return {
      id: "admin_01",
      shop_id: "shop_01",
      first_name: "Super",
      last_name: "Admin",
      email: "admin@cakes2home.com",
      phone: "+91 98765 00000",
      role: "SUPER_ADMIN",
    };
  }

  return {
    id: "cus_9876543210",
    first_name: "Alex",
    last_name: "Johnson",
    email: "alex@cakes2home.com",
    phone: "+91 98765 43210",
    role: "CUSTOMER",
  };
}
