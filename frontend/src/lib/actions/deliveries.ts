"use server";

import { DeliveryDTO, DeliveryStatus } from "@frontend/lib/types";
import { revalidateTag } from "next/cache";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function proceedDelivery(delivery: DeliveryDTO, delivery_partnerId?: string) {
  revalidateTag(getCacheTag("deliveries"));
  return delivery;
}

export async function claimDelivery(deliveryId: string, delivery_partnerId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  return { id: deliveryId, delivery_partnerId };
}

export async function passDelivery(deliveryId: string, delivery_partnerId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  return { message: "Delivery passed" };
}

export async function pickUpDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  return { id: deliveryId };
}

export async function completeDelivery(deliveryId: string): Promise<any> {
  revalidateTag("deliveries");
  return { id: deliveryId };
}

export async function acceptDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  return { id: deliveryId };
}

export async function declineDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  return { id: deliveryId };
}

export async function prepareDelivery(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  return { id: deliveryId };
}

export async function preparationReady(deliveryId: string): Promise<any> {
  revalidateTag(getCacheTag("deliveries"));
  return { id: deliveryId };
}

export async function checkDeliveryAvailabilityAction(pincode: string) {
  return { serviceable: true, delivery_fee: 49, branch_id: "br_koramangala", message: "Delivery available for pincode" };
}

export async function getDeliverySlotsAction(branchId: string, date: string) {
  return { delivery_slots: [] };
}
