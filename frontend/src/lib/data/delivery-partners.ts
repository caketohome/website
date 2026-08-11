/**
 * CakeToHome Storefront Delivery Partners Data Layer
 */

import { apiClient } from "../api-client";
import { DeliveryPartnerDTO } from "@frontend/lib/types";

export async function retrieveDeliveryPartner(delivery_partnerId: string, currentUser?: any): Promise<DeliveryPartnerDTO> {
  let partners: any[] = [];
  try {
    if (typeof window === "undefined") {
      const { ApiEngine } = await import("../api-engine");
      ApiEngine.ensureDeliveryPartnersStore();
      partners = ApiEngine.getAdminDeliveryPartners()?.partners || [];
    } else {
      const res = await apiClient.getAdminDeliveryPartners().catch(() => ({ partners: [] }));
      partners = res.partners || [];
    }
  } catch (e) {
    partners = [];
  }

  let partner = partners.find(
    (p: any) =>
      p.id === delivery_partnerId ||
      p.partner_number === delivery_partnerId ||
      (currentUser?.email && p.email === currentUser.email) ||
      (currentUser?.phone && p.phone === currentUser.phone)
  );

  if (!partner && partners.length > 0) {
    partner = partners[0];
  }

  if (partner) {
    return {
      id: partner.id,
      partner_number: partner.partner_number || `CTH-DP-${partner.id.slice(-6).toUpperCase()}`,
      first_name: partner.first_name || partner.name?.split(" ")[0] || "Delivery",
      last_name: partner.last_name || partner.name?.split(" ")[1] || "Partner",
      full_name: partner.full_name || partner.name || `${partner.first_name || ""} ${partner.last_name || ""}`.trim(),
      phone: partner.phone || currentUser?.phone || "No phone registered",
      email: partner.email || currentUser?.email || "No email registered",
      is_active: partner.status === "active" || partner.is_active !== false,
      availability_status: partner.availability_status || "ONLINE",
      rating: typeof partner.rating === "number" ? partner.rating : null,
      total_deliveries: partner.total_deliveries || partner.successful_deliveries || 0,
      maximum_concurrent_orders: partner.maximum_concurrent_orders || 2,
      current_active_orders: partner.current_active_orders || 0,
      primary_branch_name: partner.primary_branch_name || partner.primary_branch_id || "Unassigned Kitchen Hub",
      associated_branches: partner.associated_branches || [],
      coverage: partner.coverage || {
        pincodes: [],
        cities: [],
        areas: [],
      },
    } as any;
  }

  const uName = currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim() : currentUser?.email || "Delivery Partner";

  return {
    id: delivery_partnerId || currentUser?.id || "dlp_unassigned",
    partner_number: `CTH-DP-${(delivery_partnerId || "000000").slice(-6).toUpperCase()}`,
    first_name: currentUser?.first_name || "Delivery",
    last_name: currentUser?.last_name || "Partner",
    full_name: uName,
    phone: currentUser?.phone || "No phone registered",
    email: currentUser?.email || "No email registered",
    is_active: true,
    availability_status: "ONLINE",
    rating: null,
    total_deliveries: 0,
    maximum_concurrent_orders: 2,
    current_active_orders: 0,
    primary_branch_name: "Unassigned Kitchen Hub",
    associated_branches: [],
    coverage: {
      pincodes: [],
      cities: [],
      areas: [],
    },
  } as any;
}
