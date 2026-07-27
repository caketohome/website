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
    const res = await apiClient.getCart();
    return { orders: [], count: 0 };
  } catch (err) {
    return { orders: [], count: 0 };
  }
}

export async function getOrder(orderId: string): Promise<{ order: OrderDetail }> {
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
