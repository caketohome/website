/**
 * CakeToHome Storefront Deliveries & Pincode Coverage Data Layer
 * Safe for client & server components.
 */

import { DeliveryDTO } from "../types";

export interface PincodeZone {
  pincode: string;
  area_name: string;
  branch_id: string;
  branch_name: string;
  distance_km: number;
  express_available: boolean;
  midnight_available: boolean;
  delivery_fee: number;
  min_order_amount: number;
  serviceable: boolean;
}

export const SERVICEABLE_ZONES: Record<string, PincodeZone> = {
  "560034": { pincode: "560034", area_name: "Koramangala 4th Block", branch_id: "br_koramangala", branch_name: "Koramangala Main Hub", distance_km: 2.5, express_available: true, midnight_available: true, delivery_fee: 49, min_order_amount: 299, serviceable: true },
  "560095": { pincode: "560095", area_name: "Koramangala 1st Block", branch_id: "br_koramangala", branch_name: "Koramangala Main Hub", distance_km: 3.0, express_available: true, midnight_available: true, delivery_fee: 49, min_order_amount: 299, serviceable: true },
  "560038": { pincode: "560038", area_name: "Indiranagar 100ft Road", branch_id: "br_indiranagar", branch_name: "Indiranagar Cake Studio", distance_km: 4.2, express_available: true, midnight_available: true, delivery_fee: 49, min_order_amount: 349, serviceable: true },
  "560102": { pincode: "560102", area_name: "HSR Layout Sector 1", branch_id: "br_koramangala", branch_name: "Koramangala Main Hub", distance_km: 5.8, express_available: true, midnight_available: true, delivery_fee: 69, min_order_amount: 399, serviceable: true },
  "560001": { pincode: "560001", area_name: "MG Road & Commercial St", branch_id: "br_indiranagar", branch_name: "Indiranagar Cake Studio", distance_km: 6.5, express_available: false, midnight_available: true, delivery_fee: 79, min_order_amount: 499, serviceable: true },
  "560103": { pincode: "560103", area_name: "Bellandur & Outer Ring Rd", branch_id: "br_koramangala", branch_name: "Koramangala Main Hub", distance_km: 9.0, express_available: false, midnight_available: true, delivery_fee: 89, min_order_amount: 499, serviceable: true },
  "560066": { pincode: "560066", area_name: "Whitefield ITPL Main Rd", branch_id: "br_whitefield", branch_name: "Whitefield Gourmet Hub", distance_km: 14.5, express_available: false, midnight_available: false, delivery_fee: 119, min_order_amount: 599, serviceable: true },
  "560076": { pincode: "560076", area_name: "BTM Layout 2nd Stage", branch_id: "br_koramangala", branch_name: "Koramangala Main Hub", distance_km: 4.5, express_available: true, midnight_available: true, delivery_fee: 49, min_order_amount: 349, serviceable: true },
};

export async function listDeliveries(filter?: Record<string, string>): Promise<DeliveryDTO[]> {
  let allDeliveries: any[] = [];
  let allOrders: any[] = [];

  try {
    if (typeof window !== "undefined") {
      const { apiClient } = await import("../api-client");
      const [delRes, ordRes] = await Promise.all([
        apiClient.getAdminDeliveries().catch(() => ({ deliveries: [] })),
        apiClient.getAdminOrders().catch(() => ({ orders: [] }))
      ]);
      allDeliveries = (delRes as any)?.deliveries || [];
      allOrders = (ordRes as any)?.orders || [];
    } else {
      const { ApiEngine } = await import("../api-engine");
      ApiEngine.ensureDeliveryPartnersStore();
      ApiEngine.ensureOrdersStore();
      allDeliveries = ApiEngine.getAdminDeliveryPartners()?.partners || [];
      allOrders = ApiEngine.getAdminOrders()?.orders || [];
    }
  } catch (e) {
    allDeliveries = [];
    allOrders = [];
  }

  const partnerId = filter?.delivery_partner_id || filter?.partner_id || "dlp_101";

  const mapped: DeliveryDTO[] = allOrders.map((o: any, idx: number) => {
    const matchedDel = allDeliveries.find((d: any) => d.id === o.id || d.order_number === o.id) || {};

    let status = o.delivery_status || "shop_accepted";
    if (o.status === "delivered" || o.status === "completed") {
      status = "delivered";
    } else if (o.status === "out_for_delivery") {
      status = "in_transit";
    } else if (o.status === "ready_for_pickup" || o.status === "packed") {
      status = "ready_for_pickup";
    } else if (o.status === "claimed" || o.status === "preparing") {
      status = "pickup_claimed";
    }

    const items = o.items || o.cart?.items || [];

    return {
      id: o.id || `CTH-${o.order_number || idx}`,
      order_id: o.id,
      delivery_status: status as any,
      status: status,
      delivery_partner_id: o.delivery_partner_id || null,
      recipient_name: o.customerName || "Ananya Rao",
      recipient_phone: o.customerPhone || "+91 98765 43210",
      recipient_address: o.deliveryAddress || o.shipping_address?.address_1 || "Flat 402, Signature Towers, Indiranagar 100ft Road",
      recipient_pincode: o.pincode || "560038",
      recipient_landmark: "Opp. To Metro Station",
      delivery_instructions: "Handle with extreme care — Multi-tier Designer Birthday Cake.",
      gift_message: "Happy 25th Birthday Ananya! Love, Family",
      delivery_otp: o.delivery_otp || "4819",
      pickup_otp: o.pickup_otp || "1294",
      order: {
        id: o.id,
        items,
        shipping_address: {
          first_name: o.customerName?.split(" ")[0] || "Ananya",
          last_name: o.customerName?.split(" ")[1] || "Rao",
          phone: o.customerPhone || "+91 98765 43210",
          address_1: o.deliveryAddress || "Flat 402, Signature Towers, Indiranagar 100ft Road",
          postal_code: o.pincode || "560038",
        }
      },
      cart: { items }
    } as any;
  });

  if (filter?.delivery_status) {
    return mapped.filter((d) => d.delivery_status === filter.delivery_status);
  }

  return mapped;
}

export async function retrieveDelivery(deliveryId: string): Promise<DeliveryDTO> {
  const deliveries = await listDeliveries();
  const found = deliveries.find((d) => d.id === deliveryId || (d as any).order_id === deliveryId);
  if (found) return found;

  return {
    id: deliveryId,
    order_id: deliveryId,
    delivery_status: "in_transit" as any,
    recipient_name: "Valued Customer",
    recipient_phone: "+91 98765 43210",
    recipient_address: "Indiranagar 100ft Road, Bengaluru",
    recipient_pincode: "560038",
    delivery_otp: "4819",
    pickup_otp: "1294",
  } as any;
}

export async function checkDeliveryAvailability(pincodeInput: string): Promise<{
  serviceable: boolean;
  delivery_fee: number;
  branch_id: string | null;
  branch_name?: string;
  area_name?: string;
  express_available?: boolean;
  midnight_available?: boolean;
  message?: string;
}> {
  const cleanPin = (pincodeInput || "").trim().replace(/\D/g, "");

  try {
    const baseUrl = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/v1/branches?pincode=${cleanPin}`);
    const data = await res.json();
    if (res.ok && data && data.success) {
      if (data.blockedReason) {
        return {
          serviceable: false,
          delivery_fee: 0,
          branch_id: null,
          message: data.blockedReason,
        };
      }

      if (data.resolvedBy !== "fallback_default" && data.branch) {
        return {
          serviceable: true,
          delivery_fee: data.deliveryFee ?? 49,
          branch_id: data.branch.id,
          branch_name: data.branch.name,
          area_name: `Zone (${cleanPin})`,
          express_available: true,
          midnight_available: true,
          message: `Fresh cake delivery via ${data.branch.name}. ETA: ~${data.etaminutes || 40} mins.`,
        };
      }
    }
  } catch {
    // API unreachable — fallback to static lookup
  }

  // Fallback to static serviceable zones dictionary if API unreachable or returns fallback
  if (SERVICEABLE_ZONES[cleanPin]) {
    const zone = SERVICEABLE_ZONES[cleanPin];
    return {
      serviceable: true,
      delivery_fee: zone.delivery_fee,
      branch_id: zone.branch_id,
      branch_name: zone.branch_name,
      area_name: zone.area_name,
      express_available: zone.express_available,
      midnight_available: zone.midnight_available,
      message: zone.express_available
        ? `⚡ Hyperlocal 45-min Express Delivery Available in ${zone.area_name}!`
        : `Fresh Fresh-baked Cake Delivery Available in ${zone.area_name}.`,
    };
  }

  if (cleanPin.length === 6 && cleanPin.startsWith("560")) {
    return {
      serviceable: true,
      delivery_fee: 79,
      branch_id: "br_koramangala",
      branch_name: "Koramangala Main Hub",
      area_name: `Bangalore Zone (${cleanPin})`,
      express_available: false,
      midnight_available: true,
      message: "Standard Delivery Available in your Bangalore area.",
    };
  }

  return {
    serviceable: false,
    delivery_fee: 0,
    branch_id: null,
    message: `Pincode ${cleanPin || "entered"} is outside our current bakery delivery coverage zone. Please enter a valid Bangalore pincode (e.g. 560034, 560038, 560102).`,
  };
}

export async function getDeliverySlots(branchId: string, date: string): Promise<{ delivery_slots: Array<any> }> {
  try {
    const baseUrl = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/v1/branches?type=slots&branchId=${branchId}&date=${encodeURIComponent(date)}`);
    const data = await res.json();
    if (res.ok && data && data.delivery_slots) {
      return { delivery_slots: data.delivery_slots };
    }
  } catch {
    // Fallback
  }

  return {
    delivery_slots: [
      { id: "SLOT_STANDARD_MORNING", slot_name: "Morning Slot (10:00 AM - 01:00 PM)", start_time: "10:00", end_time: "13:00", extra_charge: 0, max_capacity: 30, booked_count: 5, available: true, remaining_capacity: 25 },
      { id: "SLOT_EXPRESS_45MIN", slot_name: "⚡ Express 45-Min Delivery", start_time: "Now", end_time: "+45 Min", extra_charge: 49, max_capacity: 10, booked_count: 2, available: true, remaining_capacity: 8 },
      { id: "SLOT_MIDNIGHT", slot_name: "🌙 Midnight Surprise (11:30 PM - 12:05 AM)", start_time: "23:30", end_time: "00:05", extra_charge: 149, max_capacity: 15, booked_count: 8, available: true, remaining_capacity: 7 },
    ],
  };
}

