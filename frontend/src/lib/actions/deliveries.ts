"use server";

import { DeliveryDTO, DeliveryStatus } from "@frontend/lib/types";
import { revalidateTag } from "next/cache";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";
import { checkDeliveryAvailability, getDeliverySlots } from "../data/deliveries";

export async function proceedDelivery(delivery: DeliveryDTO, delivery_partnerId?: string) {
  const { ApiEngine } = await import("../api-engine");
  const partnerId = delivery_partnerId || delivery.delivery_partner_id || (delivery as any).delivery_partner?.id || "dlp_auto";
  const res = ApiEngine.claimDeliveryJob(delivery.id, partnerId);
  revalidateTag("deliveries");
  return res;
}

export async function claimDelivery(deliveryId: string, delivery_partnerId: string): Promise<any> {
  const { ApiEngine } = await import("../api-engine");
  const res = ApiEngine.claimDeliveryJob(deliveryId, delivery_partnerId);
  revalidateTag("deliveries");
  return res;
}

export async function passDelivery(deliveryId: string, delivery_partnerId: string, reason?: string): Promise<any> {
  const { ApiEngine } = await import("../api-engine");
  const res = ApiEngine.rejectDeliveryJob(deliveryId, delivery_partnerId, reason || "Delivery partner declined job");
  revalidateTag("deliveries");
  return res;
}

export async function pickUpDelivery(deliveryId: string): Promise<any> {
  revalidateTag("deliveries");
  await apiClient.updateAdminDeliveryStatus(deliveryId, "in_transit").catch(() => null);
  return { id: deliveryId };
}

export async function verifyPickupOtp(deliveryId: string, otpInput: string, partnerId: string): Promise<any> {
  const { ApiEngine } = await import("../api-engine");
  const res = ApiEngine.verifyPickupOtpBackend(deliveryId, otpInput, partnerId);
  revalidateTag("deliveries");
  return res;
}

export async function verifyCustomerOtp(deliveryId: string, otpInput: string, partnerId: string): Promise<any> {
  const { ApiEngine } = await import("../api-engine");
  const res = ApiEngine.verifyCustomerOtpBackend(deliveryId, otpInput, partnerId);
  revalidateTag("deliveries");
  return res;
}

export async function reportDeliveryException(deliveryId: string, partnerId: string, type: string, description: string): Promise<any> {
  const { ApiEngine } = await import("../api-engine");
  const res = ApiEngine.reportDeliveryExceptionBackend(deliveryId, partnerId, type, description);
  revalidateTag("deliveries");
  return res;
}

export async function updatePartnerAvailability(partnerId: string, status: "ONLINE" | "OFFLINE" | "PAUSED", pauseMins?: number): Promise<any> {
  const { ApiEngine } = await import("../api-engine");
  const res = ApiEngine.updatePartnerAvailabilityBackend(partnerId, status, pauseMins);
  revalidateTag("deliveries");
  return res;
}

export async function completeDelivery(deliveryId: string): Promise<any> {
  revalidateTag("deliveries");
  await apiClient.updateAdminDeliveryStatus(deliveryId, "delivered").catch(() => null);
  return { id: deliveryId };
}

export async function acceptDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateOrderStatus(deliveryId, "accepted").catch(() => null);
  return { id: deliveryId };
}

export async function declineDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateOrderStatus(deliveryId, "declined").catch(() => null);
  return { id: deliveryId };
}

export async function prepareDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateOrderStatus(deliveryId, "preparing").catch(() => null);
  return { id: deliveryId };
}

export async function preparationReady(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateOrderStatus(deliveryId, "ready_for_pickup").catch(() => null);
  return { id: deliveryId };
}

export async function checkDeliveryAvailabilityAction(pincode: string) {
  return checkDeliveryAvailability(pincode);
}

export async function getDeliverySlotsAction(branchId: string, date: string) {
  return getDeliverySlots(branchId, date);
}

export async function validateOrderEligibilityAction(query: {
  pincode: string;
  product_ids?: string[];
  accessory_ids?: string[];
  delivery_type?: "standard" | "express" | "midnight" | "scheduled";
  scheduled_date?: string;
  order_total?: number;
}) {
  try {
    return await apiClient.validateOrderEligibility(query);
  } catch (err: any) {
    return {
      eligible: true,
      branch: null,
      delivery_fee: 49,
      eta_minutes: 45,
      partner: "porter",
      warnings: [],
      blockers: [],
      alternative_suggestions: [],
    };
  }
}
