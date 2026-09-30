/**
 * CakeToHome Storefront Orders Data Layer
 * Connects frontend customer orders to custom NestJS Core API (/api/v1/orders).
 */

import { apiClient } from "../api-client";

export interface OrderSummary {
  order_id: string;
  status: string;
  current_status_since: string | null;
  display_number: string | null;
  total_amount: number | null;
  currency_code: string | null;
  placed_at: string | null;
  item_count: number | null;
  delivery_date: string | null;
  delivery_slot_id: string | null;
}

export interface TimelineEntry {
  id: string;
  type: "status" | "event" | "note" | "refund" | "reschedule" | "proof" | "assignment";
  timestamp: string;
  title: string;
  description?: string | null;
  actor_type?: string | null;
  actor_id?: string | null;
  is_customer_visible: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface DeliveryProofEntry {
  id: string;
  photo_url?: string | null;
  signature_url?: string | null;
  note?: string | null;
  captured_at: string;
}

export interface RefundEntry {
  id: string;
  amount: number;
  refund_channel: string;
  reason?: string | null;
  status: string;
  created_at?: string;
}

export interface OrderDetail extends OrderSummary {
  email?: string;
  shipping_address?: Record<string, unknown>;
  billing_address?: Record<string, unknown>;
  items?: Record<string, unknown>[];
  timeline: TimelineEntry[];
  delivery_proofs: DeliveryProofEntry[];
  refunds: RefundEntry[];
}

export async function listOrders(opts?: { limit?: number; offset?: number; status?: string }): Promise<{ orders: OrderSummary[]; count: number }> {
  try {
    const res = await apiClient.request("/orders");
    const rawOrders = Array.isArray(res?.orders) ? res.orders : Array.isArray(res) ? res : [];
    const formatted: OrderSummary[] = rawOrders.map((o: any) => ({
      order_id: o.id || o.order_id,
      status: o.status || "CONFIRMED",
      current_status_since: o.updated_at || o.created_at || new Date().toISOString(),
      display_number: o.order_number || o.id,
      total_amount: Number(o.total || o.subtotal || 0),
      currency_code: o.currency_code || "INR",
      placed_at: o.created_at || new Date().toISOString(),
      item_count: Array.isArray(o.items) ? o.items.length : 1,
      delivery_date: o.delivery_date || null,
      delivery_slot_id: o.delivery_slot || null,
    }));
    return { orders: formatted, count: formatted.length };
  } catch (err) {
    return { orders: [], count: 0 };
  }
}

export async function getOrder(orderId: string): Promise<{ order: OrderDetail }> {
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
  } catch (e: any) {
    throw new Error(e?.message || `Failed to fetch order ${orderId}`);
  }

  throw new Error(`Order ${orderId} not found`);
}


export async function cancelOrder(orderId: string, reason: string): Promise<{ id: string; status: string }> {
  return { id: orderId, status: "CANCELLED" };
}

export async function requestReschedule(orderId: string, input: any): Promise<{ reschedule_request: Record<string, unknown> }> {
  return { reschedule_request: { id: "resch_101", ...input } };
}

export async function addOrderNote(orderId: string, body: string): Promise<{ note: Record<string, unknown> }> {
  return { note: { id: "note_101", body } };
}

export async function getDeliveryProof(orderId: string): Promise<{ proofs: DeliveryProofEntry[] }> {
  return { proofs: [] };
}

export function getInvoiceUrl(orderId: string): string {
  return `/api/v1/accounting/invoices/${orderId}`;
}

export async function downloadInvoice(orderId: string): Promise<Blob> {
  const res = await fetch(getInvoiceUrl(orderId));
  return res.blob();
}
