import { CreateOrderInput, UpdateTicketStatusInput, IngestOrderEventInput } from "./orders.types";
import { ORDERS_CONSTANTS } from "./orders.constants";
import { BadRequestError } from "../../core/errors/app-error";

export function validateCreateOrderInput(body: any, idempotencyKeyHeader?: string): CreateOrderInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const customerId = body.customerId ? String(body.customerId).trim() : "cus_guest_100";

  const addr = body.deliveryAddress;
  if (!addr || typeof addr !== "object") {
    throw new BadRequestError("Property 'deliveryAddress' object is required.");
  }
  if (!addr.street || !addr.city || !addr.pincode || !addr.recipientName || !addr.recipientPhone) {
    throw new BadRequestError("Delivery address must contain street, city, pincode, recipientName, and recipientPhone.");
  }

  const deliverySlotId = body.deliverySlotId && ORDERS_CONSTANTS.SLOTS[body.deliverySlotId as keyof typeof ORDERS_CONSTANTS.SLOTS]
    ? body.deliverySlotId
    : "STANDARD";

  if (!Array.isArray(body.cartItems) || body.cartItems.length === 0) {
    throw new BadRequestError("At least 1 item is required in 'cartItems' array to place an order.");
  }

  const cartItems = body.cartItems.map((item: any, idx: number) => {
    if (!item.productId) throw new BadRequestError(`Item at index ${idx} missing 'productId'.`);
    const quantity = parseInt(item.quantity || 1, 10);
    const unitPrice = parseFloat(item.unitPrice || 599.0);
    if (isNaN(quantity) || quantity < 1) throw new BadRequestError(`Item at index ${idx} has invalid quantity.`);
    if (isNaN(unitPrice) || unitPrice < 0) throw new BadRequestError(`Item at index ${idx} has invalid unitPrice.`);

    return {
      productId: String(item.productId).trim(),
      productTitle: item.productTitle ? String(item.productTitle).trim() : "Handcrafted Cake",
      variantId: item.variantId ? String(item.variantId).trim() : `var_${item.productId}`,
      sku: item.sku ? String(item.sku).trim() : `SKU-${item.productId}`,
      quantity,
      unitPrice,
      selectedOptions: Array.isArray(item.selectedOptions) ? item.selectedOptions : [],
      customMessage: item.customMessage ? String(item.customMessage).trim() : undefined,
      photoUrl: item.photoUrl ? String(item.photoUrl).trim() : undefined,
    };
  });

  const paymentProvider = body.paymentProvider === "COD" ? "COD" : "CASHFREE";

  return {
    idempotencyKey: idempotencyKeyHeader || body.idempotencyKey || undefined,
    customerId,
    pincode: String(addr.pincode).trim(),
    deliveryAddress: {
      street: String(addr.street).trim(),
      city: String(addr.city).trim(),
      pincode: String(addr.pincode).trim(),
      recipientName: String(addr.recipientName).trim(),
      recipientPhone: String(addr.recipientPhone).trim(),
    },
    deliverySlotId,
    cartItems,
    promoDiscount: body.promoDiscount ? parseFloat(body.promoDiscount) : 0,
    paymentProvider,
  };
}

export function validateUpdateTicketStatusInput(body: any): UpdateTicketStatusInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const validStatuses = ["QUEUED", "PREPARING", "READY_FOR_DISPATCH", "COMPLETED"];
  if (!body.status || !validStatuses.includes(body.status)) {
    throw new BadRequestError("Ticket 'status' must be one of: QUEUED, PREPARING, READY_FOR_DISPATCH, COMPLETED.");
  }

  const validStations = ["BAKING", "DECORATION", "PACKAGING", "DISPATCH"];
  const station = body.station && validStations.includes(body.station) ? body.station : undefined;

  return {
    status: body.status,
    station,
    preparedBy: body.preparedBy ? String(body.preparedBy).trim() : undefined,
  };
}

export function validateIngestEventInput(body: any): IngestOrderEventInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const outboxEventId = body.outboxEventId ? String(body.outboxEventId).trim() : "";
  if (!outboxEventId) {
    throw new BadRequestError("Property 'outboxEventId' is required for event ingestion.");
  }

  const orderId = body.orderId ? String(body.orderId).trim() : "";
  if (!orderId) {
    throw new BadRequestError("Property 'orderId' is required for event ingestion.");
  }

  return {
    outboxEventId,
    eventType: "OrderCreated",
    orderId,
    orderNumber: body.orderNumber ? String(body.orderNumber).trim() : `CTH-20260731-${orderId}`,
    branchId: body.branchId ? String(body.branchId).trim() : ORDERS_CONSTANTS.DEFAULT_BRANCH_ID,
    items: Array.isArray(body.items) ? body.items : [],
  };
}
