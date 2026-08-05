import { OrderDTO, KitchenTicketDTO } from "./orders.types";

export class OrderMapper {
  static toOrderDTO(raw: any): OrderDTO {
    if (!raw) return null as any;
    const pricing = raw.pricing || {};
    const items = Array.isArray(raw.items)
      ? raw.items.map((i: any) => ({
          productId: i.productId || i.product_id,
          productTitle: i.productTitle || i.product_title || "Handcrafted Cake",
          variantId: i.variantId || i.variant_id || `var_${i.productId}`,
          sku: i.sku || `SKU-${i.productId}`,
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.unitPrice ?? 599.0),
          optionsCost: Number(i.optionsCost ?? 0.0),
          totalPrice: Number(i.totalPrice ?? 599.0),
          selectedOptions: Array.isArray(i.selectedOptions) ? i.selectedOptions : [],
          customMessage: i.customMessage || undefined,
          photoUrl: i.photoUrl || undefined,
        }))
      : [];

    return {
      id: raw.id,
      orderNumber: raw.orderNumber || raw.order_number || `CTH-20260731-${raw.id}`,
      idempotencyKey: raw.idempotencyKey || raw.idempotency_key || undefined,
      customerId: raw.customerId || raw.customer_id || "cus_guest_100",
      branchId: raw.branchId || raw.branch_id || "br_koramangala_01",
      status: raw.status || "CONFIRMED",
      paymentStatus: raw.paymentStatus || raw.payment_status || "PENDING",
      deliverySlot: raw.deliverySlot || {
        id: "STANDARD",
        name: "Standard Delivery",
        slotTime: "Today 2 PM - 5 PM",
        additionalFee: 0.0,
        isAvailable: true,
      },
      deliveryAddress: raw.deliveryAddress || {
        street: "100 Feet Road",
        city: "Bengaluru",
        pincode: "560038",
        recipientName: "Customer",
        recipientPhone: "+919876543210",
      },
      items,
      pricing: {
        subtotal: Number(pricing.subtotal ?? 0.0),
        discountAmount: Number(pricing.discountAmount ?? 0.0),
        deliveryFee: Number(pricing.deliveryFee ?? 49.0),
        slotFee: Number(pricing.slotFee ?? 0.0),
        taxAmount: Number(pricing.taxAmount ?? 0.0),
        totalAmount: Number(pricing.totalAmount ?? 0.0),
      },
      timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    };
  }

  static toKitchenTicketDTO(raw: any): KitchenTicketDTO {
    if (!raw) return null as any;
    const items = Array.isArray(raw.items)
      ? raw.items.map((i: any) => ({
          productId: i.productId || i.product_id,
          productTitle: i.productTitle || i.product_title || "Handcrafted Cake",
          quantity: Number(i.quantity || 1),
          customMessage: i.customMessage || undefined,
          isEggless: Boolean(i.isEggless ?? i.selectedOptions?.includes("opt_eggless")),
          specialInstructions: i.specialInstructions || undefined,
        }))
      : [];

    return {
      id: raw.id,
      orderId: raw.orderId || raw.order_id,
      orderNumber: raw.orderNumber || raw.order_number,
      branchId: raw.branchId || raw.branch_id || "br_koramangala_01",
      station: raw.station || "BAKING",
      status: raw.status || "QUEUED",
      items,
      preparedBy: raw.preparedBy || undefined,
      estimatedPreparationMinutes: Number(raw.estimatedPreparationMinutes || 30),
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
