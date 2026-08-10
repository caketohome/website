/**
 * CakeToHome Storefront Delivery Partners Data Layer
 */

import { apiClient } from "../api-client";
import { DeliveryPartnerDTO } from "@frontend/lib/types";

export async function retrieveDeliveryPartner(delivery_partnerId: string): Promise<DeliveryPartnerDTO> {
  return {
    id: delivery_partnerId || "dlp_01",
    first_name: "Rahul",
    last_name: "Kumar",
    phone: "+91 98765 12345",
    email: "driver@cakes2home.com",
    is_active: true,
  } as any;
}
