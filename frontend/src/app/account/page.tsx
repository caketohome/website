import { retrieveUser } from "@frontend/lib/data";
import { AccountDashboardView } from "@frontend/components/store/account/account-dashboard-view";
import { redirect } from "next/navigation";
import type { CustomerProfileDTO } from "@frontend/lib/crm/types";

export const metadata = {
  title: "My Account | CakeToHome",
  description: "Manage your CakeToHome account, delivery addresses, and artisanal cake orders.",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await retrieveUser();

  if (!user) {
    redirect("/login");
  }

  const initialCustomer: CustomerProfileDTO = {
    id: user.id || "cus_default",
    customer_uid: user.customer_uid || user.id || "cth_cus_default",
    full_name: user.full_name || user.name || user.customer_name || "Gourmet Customer",
    name: user.full_name || user.name || user.customer_name || "Gourmet Customer",
    first_name: user.first_name || (user.full_name || user.name || "").split(" ")[0] || "Gourmet",
    last_name: user.last_name || (user.full_name || user.name || "").split(" ").slice(1).join(" ") || "",
    phone: user.phone || "",
    normalized_phone: user.normalized_phone || (user.phone ? user.phone.replace(/\D/g, "").slice(-10) : ""),
    email: user.email || "",
    profile_image: user.profile_image || "",
    date_of_birth: user.date_of_birth || null,
    tier: user.tier || "STANDARD",
    lifecycle_stage: user.lifecycle_stage || "NEW",
    created_at: user.created_at || new Date().toISOString(),
    updated_at: user.updated_at || new Date().toISOString(),
    last_login_at: user.last_login_at || null,
    stats: user.stats || {
      orders: user.orders_count || 0,
      total_spent: user.total_spend || 0,
      favourite_cake: "Belgian Dark Chocolate Truffle Cake",
      last_order_date: null,
    },
    addresses: user.addresses || [],
    preferences: user.preferences || {
      favourite_flavour: "Belgian Dark Chocolate Truffle",
      whatsapp_notifications: true,
      sms_notifications: true,
      marketing_emails: true,
    },
  };

  return <AccountDashboardView initialCustomer={initialCustomer} />;
}
