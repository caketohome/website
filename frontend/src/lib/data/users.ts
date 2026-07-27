import { cookies } from "next/headers";
import { retrieveSession } from "./sessions";

export async function retrieveUser(): Promise<any> {
  const cookieStore = cookies();
  const token = retrieveSession();
  const role = cookieStore.get("_cth_role")?.value;

  // Unauthenticated guest user
  if (!token && !role) {
    return null;
  }

  const activeRole = role || "customer";

  if (activeRole === "delivery_partner" || activeRole === "dlp") {
    return {
      id: "dlp_01",
      first_name: "Rahul",
      last_name: "Kumar",
      email: "driver@cakes2home.com",
      phone: "+91 98765 12345",
      role: "DELIVERY_PARTNER",
    };
  }

  if (activeRole === "shop" || activeRole === "shpmgr") {
    return {
      id: "shpmgr_01",
      shop_id: "shop_01",
      first_name: "Koramangala",
      last_name: "Branch Manager",
      email: "shop@cakes2home.com",
      phone: "+91 98765 43210",
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
