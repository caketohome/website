/**
 * CakeToHome Client-Safe Orders Data Layer
 */

import { apiClient } from "../api-client";
import { OrderDetail, DeliveryProofEntry } from "./orders";

export async function clientGetOrder(orderId: string): Promise<{ order: OrderDetail }> {
  const dummy: OrderDetail = {
    order_id: orderId,
    status: "CONFIRMED",
    current_status_since: new Date().toISOString(),
    display_number: "CTH-20260722-000124",
    total_amount: 675.45,
    currency_code: "INR",
    placed_at: new Date().toISOString(),
    item_count: 1,
    delivery_date: "2026-07-23",
    delivery_slot_id: "MIDNIGHT",
    timeline: [
      { id: "tl_1", type: "status", timestamp: new Date().toISOString(), title: "Order Confirmed", is_customer_visible: true },
      { id: "tl_2", type: "status", timestamp: new Date().toISOString(), title: "Baking Started in Kitchen", is_customer_visible: true },
    ],
    delivery_proofs: [],
    refunds: [],
  };
  return { order: dummy };
}

export async function clientCancelOrder(orderId: string, reason: string): Promise<{ id: string; status: string }> {
  return { id: orderId, status: "CANCELLED" };
}

export async function clientRequestReschedule(orderId: string, input: any): Promise<{ reschedule_request: Record<string, unknown> }> {
  return { reschedule_request: { id: "resch_101", ...input } };
}

export async function clientAddOrderNote(orderId: string, body: string): Promise<{ note: Record<string, unknown> }> {
  return { note: { id: "note_101", body } };
}

export async function clientGetDeliveryProof(orderId: string): Promise<{ proofs: DeliveryProofEntry[] }> {
  return { proofs: [] };
}

export function clientGetInvoiceUrl(orderId: string): string {
  return `/api/v1/accounting/invoices/${orderId}`;
}

export async function clientDownloadInvoice(orderId: string): Promise<Blob> {
  const res = await fetch(clientGetInvoiceUrl(orderId));
  return res.blob();
}
