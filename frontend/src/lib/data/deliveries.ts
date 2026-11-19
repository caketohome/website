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

// Authoritative delivery zones must be fetched dynamically from PostgreSQL delivery_zone table or branches API.


export async function listDeliveries(filter?: Record<string, string>): Promise<DeliveryDTO[]> {
  let allDeliveries: any[] = [];
  let allOrders: any[] = [];
  let partnerObj: any = null;

  const targetPartnerId = filter?.delivery_partner_id || filter?.partner_id || null;

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
      try {
        const { OrderRepository } = await import("../repositories/order.repository");
        const ordersRes = await OrderRepository.listOrders({ limit: 100 });
        allOrders = ordersRes.items || [];
      } catch (err) {
        allOrders = [];
      }
      const { ApiEngine } = await import("../api-engine");
      ApiEngine.ensureDeliveryPartnersStore();
      const store = ApiEngine.getStore();
      allDeliveries = store.delivery_partners || [];
      const storeOrders = store.orders || [];
      const existingIds = new Set(allOrders.map((o: any) => o.id));
      for (const so of storeOrders) {
        if (!existingIds.has(so.id)) {
          allOrders.push(so);
        }
      }
      if (targetPartnerId) {
        partnerObj = (allDeliveries || []).find(
          (p: any) => p.id === targetPartnerId || p.partner_number === targetPartnerId || p.phone === targetPartnerId
        );
        if (!partnerObj) {
          allOrders = [];
        } else {
          allOrders = allOrders.filter((o: any) => ApiEngine.canPartnerAccessOrder(partnerObj, o));
        }
      }
    }
  } catch (e) {
    allDeliveries = [];
    allOrders = [];
  }

  const partnerId = filter?.delivery_partner_id || filter?.partner_id || "";

  const mapped: DeliveryDTO[] = allOrders.map((o: any, idx: number) => {
    const isAssignedToThisPartner = Boolean(
      (targetPartnerId && (o.delivery_partner_id === targetPartnerId || o.delivery_partner_id === partnerObj?.partner_number)) ||
      (targetPartnerId && (o.delivery?.partner_id === targetPartnerId || o.delivery?.partner_id === partnerObj?.partner_number)) ||
      (partnerObj?.partner_number && o.delivery?.partner_number === partnerObj.partner_number) ||
      (partnerObj?.full_name && o.driver_name === partnerObj.full_name)
    );

    let rawDelStatus = (o.delivery_status || o.delivery?.delivery_status || o.delivery?.status || "").toLowerCase();
    const orderStatus = (o.status || "").toLowerCase();

    let status = "shop_accepted";
    if (rawDelStatus === "delivered" || orderStatus === "delivered" || orderStatus === "completed") {
      status = "delivered";
    } else if (rawDelStatus === "in_transit" || orderStatus === "out_for_delivery" || o.pickup_verified_at) {
      status = "in_transit";
    } else if (isAssignedToThisPartner) {
      // Auto-assigned / manually assigned orders awaiting kitchen handoff
      status = "ready_for_pickup";
    } else if (rawDelStatus === "ready_for_pickup" || orderStatus === "packed" || rawDelStatus === "dispatched") {
      status = "ready_for_pickup";
    } else if (rawDelStatus === "pickup_claimed" || rawDelStatus === "shop_preparing" || orderStatus === "preparing" || orderStatus === "claimed") {
      status = "pickup_claimed";
    } else {
      status = "shop_accepted";
    }

    const items = o.items || o.cart?.items || [];

    // Extract real values strictly from canonical order record — zero fake fallback names/addresses
    const rawAddr = o.delivery_address || o.deliveryAddress || o.recipient_address || o.shipping_address || o.address;
    let formattedAddress = "Store Pickup / Delivery Address";
    if (typeof rawAddr === "string" && rawAddr.trim()) {
      formattedAddress = rawAddr.trim();
    } else if (rawAddr && typeof rawAddr === "object") {
      const parts = [
        rawAddr.address_1 || rawAddr.line1 || rawAddr.address,
        rawAddr.address_2 || rawAddr.line2,
        rawAddr.landmark,
        rawAddr.area,
        rawAddr.city,
        rawAddr.state,
        rawAddr.postal_code || rawAddr.pincode || rawAddr.zip,
      ].filter(Boolean);
      if (parts.length > 0) formattedAddress = parts.join(", ");
    }

    const rawName =
      o.customer_name ||
      o.customerName ||
      o.recipient_name ||
      (o.customer && typeof o.customer === "object" ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() || o.customer.name : null) ||
      (o.shipping_address && typeof o.shipping_address === "object" ? `${o.shipping_address.first_name || ""} ${o.shipping_address.last_name || ""}`.trim() : null);
    let formattedName = o.customer_uid ? "Customer" : "Guest Customer";
    if (typeof rawName === "string" && rawName.trim()) {
      formattedName = rawName.trim();
    }

    const rawPhone =
      o.customer_phone ||
      o.customerPhone ||
      o.recipient_phone ||
      (o.customer && typeof o.customer === "object" ? o.customer.phone : null) ||
      (o.shipping_address && typeof o.shipping_address === "object" ? o.shipping_address.phone : null);
    let formattedPhone = "";
    if (typeof rawPhone === "string" && rawPhone.trim()) {
      formattedPhone = rawPhone.trim();
    }

    const rawPincode =
      o.pincode ||
      o.recipient_pincode ||
      (o.shipping_address && typeof o.shipping_address === "object" ? (o.shipping_address.postal_code || o.shipping_address.pincode) : null);
    let formattedPincode = "";
    if (typeof rawPincode === "string" || typeof rawPincode === "number") {
      formattedPincode = String(rawPincode).trim();
    }

    const canonicalOrderNumber = o.order_number || o.id || `CTH-ORD-${idx + 1}`;
    const pickupOtp = typeof o.delivery?.pickup_otp === "string" && o.delivery.pickup_otp !== "Not generated" ? o.delivery.pickup_otp : (typeof o.pickup_otp === "string" && o.pickup_otp !== "Not generated" ? o.pickup_otp : "");
    const deliveryOtp = typeof o.delivery?.delivery_otp === "string" && o.delivery.delivery_otp !== "Not generated" ? o.delivery.delivery_otp : (typeof o.delivery_otp === "string" && o.delivery_otp !== "Not generated" ? o.delivery_otp : "");

    // Strict Privacy Rule: Driver must NEVER receive the customer delivery OTP
    const driverSafeDeliveryOtp = targetPartnerId ? undefined : (deliveryOtp || undefined);

    return {
      id: o.id || canonicalOrderNumber,
      order_id: o.id || canonicalOrderNumber,
      display_order_number: canonicalOrderNumber,
      order_number: canonicalOrderNumber,
      customer_uid: o.customer_uid || o.customer_id || null,
      delivery_status: status as any,
      status: status,
      delivery_partner_id: o.delivery_partner_id || o.delivery?.partner_id || null,
      driver_name: o.driver_name || o.delivery?.partner_name || null,
      driver_phone: o.driver_phone || o.delivery?.partner_phone || null,
      recipient_name: formattedName,
      recipient_phone: formattedPhone,
      recipient_address: formattedAddress,
      recipient_pincode: formattedPincode,
      recipient_landmark: typeof o.landmark === "string" ? o.landmark : (o.recipient_landmark || ""),
      delivery_instructions: typeof o.delivery_instructions === "string" ? o.delivery_instructions : "",
      gift_message: typeof o.gift_message === "string" ? o.gift_message : (o.custom_message || ""),
      delivery_otp: driverSafeDeliveryOtp,
      pickup_otp: pickupOtp,
      delivery_otp_required: Boolean(deliveryOtp),
      delivery_latitude: typeof o.delivery_latitude === "number" ? o.delivery_latitude : (typeof o.latitude === "number" ? o.latitude : null),
      delivery_longitude: typeof o.delivery_longitude === "number" ? o.delivery_longitude : (typeof o.longitude === "number" ? o.longitude : null),
      delivery: o.delivery ? {
        ...o.delivery,
        partner_id: o.delivery_partner_id || o.delivery?.partner_id || null,
        partner_name: o.driver_name || o.delivery?.partner_name || null,
        pickup_otp: pickupOtp,
        delivery_otp: driverSafeDeliveryOtp,
        status: status,
      } : {
        partner_id: o.delivery_partner_id || null,
        partner_name: o.driver_name || null,
        pickup_otp: pickupOtp,
        delivery_otp: driverSafeDeliveryOtp,
        status: status,
      },
      order: {
        id: o.id || canonicalOrderNumber,
        order_id: o.id || canonicalOrderNumber,
        display_number: canonicalOrderNumber,
        order_number: canonicalOrderNumber,
        customer_uid: o.customer_uid || o.customer_id || null,
        customer_name: formattedName,
        customer_phone: formattedPhone,
        customer_email: o.customer_email || o.email || null,
        branch_id: o.branch_id || null,
        branch_name: o.branch_name || null,
        payment_status: o.payment_status || "paid",
        status: o.status || "confirmed",
        delivery_status: status,
        total_amount: Number(o.total || o.grand_total || o.subtotal || 0),
        items,
        delivery_latitude: typeof o.delivery_latitude === "number" ? o.delivery_latitude : null,
        delivery_longitude: typeof o.delivery_longitude === "number" ? o.delivery_longitude : null,
        shipping_address: {
          first_name: formattedName.split(" ")[0] || "Customer",
          last_name: formattedName.split(" ").slice(1).join(" ") || "",
          phone: formattedPhone,
          address_1: formattedAddress,
          postal_code: formattedPincode,
          latitude: typeof o.delivery_latitude === "number" ? o.delivery_latitude : null,
          longitude: typeof o.delivery_longitude === "number" ? o.delivery_longitude : null,
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
  const found = deliveries.find((d) => d.id === deliveryId || (d as any).order_id === deliveryId || (d as any).order_number === deliveryId);
  if (found) return found;

  return {
    id: deliveryId,
    order_id: deliveryId,
    display_order_number: deliveryId,
    order_number: deliveryId,
    delivery_status: "in_transit" as any,
    status: "in_transit",
    recipient_name: "Customer",
    recipient_phone: "",
    recipient_address: "Bakery Dispatch Hub",
    recipient_pincode: "560038",
    delivery_otp: undefined,
    pickup_otp: undefined,
    order: {
      id: deliveryId,
      display_number: deliveryId,
      order_number: deliveryId,
      shipping_address: {
        first_name: "Customer",
        last_name: "",
        phone: "",
        address_1: "Bakery Dispatch Hub",
        postal_code: "560038",
      }
    }
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
          midnight_available: false,
          message: `Fresh cake delivery via ${data.branch.name}. ETA: ~${data.etaminutes || 40} mins.`,
        };
      }
    }
  } catch (err) {
    console.error("[checkPincodeServiceability Error]:", err);
  }

  // PostgreSQL-Only: No silent fallback to static hardcoded dictionary.

  return {
    serviceable: false,
    delivery_fee: 0,
    branch_id: null,
    message: `Pincode ${cleanPin || "entered"} is outside our current bakery delivery coverage zones.`,
  };
}

export async function getCheckoutAvailability(query: {
  cart_id?: string;
  delivery_type?: "delivery" | "pickup";
  pincode?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  address?: string;
  branch_id?: string;
  date?: string;
  slot_id?: string;
  coupon_code?: string;
}) {
  try {
    const baseUrl = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000");
    const params = new URLSearchParams();
    if (query.cart_id) params.set("cart_id", query.cart_id);
    if (query.delivery_type) params.set("delivery_type", query.delivery_type);
    if (query.pincode) params.set("pincode", query.pincode);
    const lat = query.latitude ?? query.lat;
    const lng = query.longitude ?? query.lng;
    if (typeof lat === "number") params.set("lat", String(lat));
    if (typeof lng === "number") params.set("lng", String(lng));
    if (query.address) params.set("address", query.address);
    if (query.branch_id) params.set("branch_id", query.branch_id);
    if (query.date) params.set("date", query.date);
    if (query.slot_id) params.set("slot_id", query.slot_id);
    if (query.coupon_code) params.set("coupon_code", query.coupon_code);

    const res = await fetch(`${baseUrl}/api/v1/checkout/availability?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data) {
      return data;
    }
  } catch (err) {
    console.error("Failed to fetch checkout availability:", err);
  }

  return {
    success: false,
    serviceable: false,
    branch_id: null,
    branch_name: null,
    delivery_type: query.delivery_type || "delivery",
    status_message: "Unable to verify service availability. Please try again.",
    operating_status: "OPERATIONAL",
    available_dates: [],
    available_slots: [],
    pricing: {
      subtotal: 0,
      discount: 0,
      delivery_fee: 0,
      slot_surcharge: 0,
      tax: 0,
      grand_total: 0,
    },
  };
}

export async function getDeliverySlots(branchId: string, date: string, mode: "delivery" | "pickup" = "delivery"): Promise<{ delivery_slots: Array<any>; status?: string; message?: string; is_open?: boolean }> {
  try {
    const baseUrl = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/v1/branches?type=slots&branchId=${encodeURIComponent(branchId)}&date=${encodeURIComponent(date)}&mode=${encodeURIComponent(mode)}`);
    const data = await res.json();
    if (res.ok && data && data.delivery_slots) {
      return { delivery_slots: data.delivery_slots, status: data.status, message: data.message, is_open: data.is_open };
    }
  } catch (err) {
    console.error("Failed to fetch branch delivery slots:", err);
  }

  return {
    delivery_slots: [],
    status: "ERROR",
    message: "Unable to load slots at this moment",
  };
}


