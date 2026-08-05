"use server";

import { DeliveryDTO, DeliveryStatus } from "@frontend/lib/types";
import { revalidateTag } from "next/cache";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";
import { checkDeliveryAvailability, getDeliverySlots } from "../data/deliveries";

export async function proceedDelivery(delivery: DeliveryDTO, delivery_partnerId?: string) {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateAdminDeliveryStatus(delivery.id, delivery.status || "in_transit").catch(() => null);
  return delivery;
}

export async function claimDelivery(deliveryId: string, delivery_partnerId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateAdminDeliveryStatus(deliveryId, "claimed").catch(() => null);
  return { id: deliveryId, delivery_partnerId };
}

export async function passDelivery(deliveryId: string, delivery_partnerId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateAdminDeliveryStatus(deliveryId, "available").catch(() => null);
  return { message: "Delivery passed" };
}

export async function pickUpDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  await apiClient.updateAdminDeliveryStatus(deliveryId, "in_transit").catch(() => null);
  return { id: deliveryId };
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
