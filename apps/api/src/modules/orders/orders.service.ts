/**
 * CakeToHome Core API - Checkout & Orders Domain Service (Phase 1 Feature 5)
 * Manages Checkout Validation Pipeline, Immutable Order Snapshots, Idempotency Deduplication,
 * Human-Readable Order Numbers (CTH-YYYYMMDD-XXXXXX), Delivery Slots, and Atomic Outbox Events.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service";

export interface DeliverySlotDto {
  id: "EXPRESS_45MIN" | "STANDARD" | "SCHEDULED" | "MIDNIGHT";
  name: string;
  slotTime: string;
  additionalFee: string;
  isAvailable: boolean;
}

export interface OrderItemSnapshotDto {
  productId: string;
  productTitle: string;
  variantId: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  optionsCost: string;
  totalPrice: string;
  selectedOptions: string[];
  customMessage?: string;
  photoUrl?: string;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  idempotencyKey?: string;
  customerId: string;
  branchId: string;
  status: "PENDING" | "CONFIRMED" | "KITCHEN_PREPARING" | "READY_FOR_DISPATCH" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  paymentStatus: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  deliverySlot: DeliverySlotDto;
  deliveryAddress: {
    street: string;
    city: string;
    pincode: string;
    recipientName: string;
    recipientPhone: string;
  };
  items: OrderItemSnapshotDto[];
  pricing: {
    subtotal: string;
    discountAmount: string;
    deliveryFee: string;
    slotFee: string;
    taxAmount: string;
    totalAmount: string;
  };
  timeline: { status: string; timestamp: string; note: string }[];
  createdAt: string;
}

export class OrdersService {
  private orders: Map<string, OrderDto> = new Map();
  private idempotencyKeys: Map<string, OrderDto> = new Map();
  private orderCounter = 123;

  async createOrder(payload: {
    idempotencyKey?: string;
    customerId: string;
    pincode: string;
    deliveryAddress: { street: string; city: string; pincode: string; recipientName: string; recipientPhone: string };
    deliverySlotId: "EXPRESS_45MIN" | "STANDARD" | "SCHEDULED" | "MIDNIGHT";
    cartItems: { productId: string; productTitle: string; variantId: string; sku: string; quantity: number; unitPrice: string; selectedOptions: string[]; customMessage?: string }[];
    promoDiscount?: string;
    paymentProvider: "RAZORPAY" | "COD";
  }): Promise<{ order: OrderDto; outboxEvent: any }> {
    if (payload.idempotencyKey && this.idempotencyKeys.has(payload.idempotencyKey)) {
      const existing = this.idempotencyKeys.get(payload.idempotencyKey)!;
      return {
        order: existing,
        outboxEvent: { eventType: "OrderCreated", aggregateId: existing.id, status: "IDEMPOTENT_REPLAY" },
      };
    }

    const slots: Record<string, DeliverySlotDto> = {
      EXPRESS_45MIN: { id: "EXPRESS_45MIN", name: "Express 45-Minute Delivery", slotTime: "Within 45 Mins", additionalFee: "50.00", isAvailable: true },
      STANDARD: { id: "STANDARD", name: "Standard Today Delivery", slotTime: "Today 2 PM - 5 PM", additionalFee: "0.00", isAvailable: true },
      SCHEDULED: { id: "SCHEDULED", name: "Scheduled Delivery", slotTime: "Tomorrow 10 AM - 1 PM", additionalFee: "0.00", isAvailable: true },
      MIDNIGHT: { id: "MIDNIGHT", name: "Surprise Midnight Delivery", slotTime: "Tonight 11:45 PM", additionalFee: "99.00", isAvailable: true },
    };

    const selectedSlot = slots[payload.deliverySlotId] || slots.STANDARD;

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    this.orderCounter++;
    const orderNumber = `CTH-${todayStr}-${String(this.orderCounter).padStart(6, "0")}`;
    const orderId = `ord_${Date.now()}`;

    let subtotalNum = 0;
    const itemSnapshots: OrderItemSnapshotDto[] = payload.cartItems.map((ci) => {
      const unitNum = parseFloat(ci.unitPrice);
      const lineTotal = unitNum * ci.quantity;
      subtotalNum += lineTotal;
      return {
        productId: ci.productId,
        productTitle: ci.productTitle,
        variantId: ci.variantId,
        sku: ci.sku,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        optionsCost: "0.00",
        totalPrice: lineTotal.toFixed(2),
        selectedOptions: ci.selectedOptions,
        customMessage: ci.customMessage,
      };
    });

    const subtotal = subtotalNum.toFixed(2);
    const discountAmount = payload.promoDiscount || "0.00";
    const netSubtotal = Math.max(0, subtotalNum - parseFloat(discountAmount));

    const deliveryFee = netSubtotal >= 500 ? "0.00" : "49.00";
    const slotFee = selectedSlot.additionalFee;
    const taxAmount = (netSubtotal * 0.05).toFixed(2);
    const totalAmount = (netSubtotal + parseFloat(deliveryFee) + parseFloat(slotFee) + parseFloat(taxAmount)).toFixed(2);

    const order: OrderDto = {
      id: orderId,
      orderNumber,
      idempotencyKey: payload.idempotencyKey,
      customerId: payload.customerId,
      branchId: "br_koramangala",
      status: "CONFIRMED",
      paymentStatus: payload.paymentProvider === "COD" ? "PENDING" : "AUTHORIZED",
      deliverySlot: selectedSlot,
      deliveryAddress: payload.deliveryAddress,
      items: itemSnapshots,
      pricing: {
        subtotal,
        discountAmount,
        deliveryFee,
        slotFee,
        taxAmount,
        totalAmount,
      },
      timeline: [
        { status: "ORDER_PLACED", timestamp: new Date().toISOString(), note: `Order placed via ${payload.paymentProvider}` },
        { status: "CONFIRMED", timestamp: new Date().toISOString(), note: "Order confirmed & assigned to Koramangala Central Kitchen" },
      ],
      createdAt: new Date().toISOString(),
    };

    this.orders.set(orderId, order);
    if (payload.idempotencyKey) {
      this.idempotencyKeys.set(payload.idempotencyKey, order);
    }

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: "OrderCreated",
      aggregateId: orderId,
      payload: {
        orderId,
        orderNumber,
        customerId: order.customerId,
        totalAmount,
        branchId: order.branchId,
        status: order.status,
      },
    });

    return { order, outboxEvent };
  }

  async getOrder(orderId: string): Promise<OrderDto | null> {
    return this.orders.get(orderId) || null;
  }
}
