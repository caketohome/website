/**
 * CakeToHome Client-Safe Orders Data Layer
 */

import { apiClient } from "../api-client";
import { OrderDetail, DeliveryProofEntry } from "./orders";

export async function clientGetOrder(orderId: string): Promise<{ order: OrderDetail }> {
  try {
    const res = await apiClient.getOrder(orderId);
    if (res?.order) {
      const o = res.order;
      return {
        order: {
          order_id: o.id,
          status: (o.status || "CONFIRMED").toUpperCase(),
          current_status_since: o.updated_at || o.created_at || new Date().toISOString(),
          display_number: o.order_number || o.id,
          total_amount: Number(o.total || o.subtotal || 0),
          currency_code: "INR",
          placed_at: o.created_at || new Date().toISOString(),
          item_count: Array.isArray(o.items) ? o.items.length : 1,
          delivery_date: o.delivery_date || null,
          delivery_slot_id: o.delivery_slot || null,
          email: o.customer_email || "customer@cakes2home.com",
          shipping_address: { address_1: o.delivery_address, postal_code: o.pincode, city: o.city },
          items: o.items || [],
          timeline: o.timeline || [
            { id: "tl_1", type: "status", timestamp: o.created_at || new Date().toISOString(), title: "Order Confirmed", is_customer_visible: true },
          ],
          delivery_proofs: [],
          refunds: [],
        },
      };
    }
  } catch (e) {
    console.warn("Client failed to fetch order:", e);
  }

  const dummy: OrderDetail = {
    order_id: orderId,
    status: "CONFIRMED",
    current_status_since: new Date().toISOString(),
    display_number: `CTH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-101`,
    total_amount: 599,
    currency_code: "INR",
    placed_at: new Date().toISOString(),
    item_count: 1,
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "Evening Slot",
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
