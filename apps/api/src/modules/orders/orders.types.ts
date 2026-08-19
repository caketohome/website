export interface DeliverySlotDTOv1 {
  id: "EXPRESS_45MIN" | "STANDARD" | "SCHEDULED" | "MIDNIGHT";
  name: string;
  slotTime: string;
  additionalFee: number;
  isAvailable: boolean;
}

export interface OrderItemSnapshotDTOv1 {
  productId: string;
  productTitle: string;
  variantId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  optionsCost: number;
  totalPrice: number;
  selectedOptions: string[];
  customMessage?: string;
  photoUrl?: string;
}

export interface OrderDTOv1 {
  id: string;
  orderNumber: string;
  idempotencyKey?: string;
  customerId: string;
  branchId: string;
  status: "PENDING" | "CONFIRMED" | "KITCHEN_PREPARING" | "READY_FOR_DISPATCH" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  paymentStatus: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  deliverySlot: DeliverySlotDTOv1;
  deliveryAddress: {
    street: string;
    city: string;
    pincode: string;
    recipientName: string;
    recipientPhone: string;
  };
  items: OrderItemSnapshotDTOv1[];
  pricing: {
    subtotal: number;
    discountAmount: number;
    deliveryFee: number;
    slotFee: number;
    taxAmount: number;
    totalAmount: number;
  };
  timeline: { status: string; timestamp: string; note: string }[];
  createdAt: string;
}

export type OrderDTO = OrderDTOv1;

export interface KitchenTicketDTOv1 {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  station: "BAKING" | "DECORATION" | "PACKAGING" | "DISPATCH";
  status: "QUEUED" | "PREPARING" | "READY_FOR_DISPATCH" | "COMPLETED";
  items: {
    productId: string;
    productTitle: string;
    quantity: number;
    customMessage?: string;
        specialInstructions?: string;
  }[];
  preparedBy?: string;
  estimatedPreparationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export type KitchenTicketDTO = KitchenTicketDTOv1;

export interface CreateOrderInput {
  idempotencyKey?: string;
  customerId: string;
  pincode: string;
  deliveryAddress: {
    street: string;
    city: string;
    pincode: string;
    recipientName: string;
    recipientPhone: string;
  };
  deliverySlotId: "EXPRESS_45MIN" | "STANDARD" | "SCHEDULED" | "MIDNIGHT";
  cartItems: {
    productId: string;
    productTitle: string;
    variantId?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    selectedOptions?: string[];
    customMessage?: string;
    photoUrl?: string;
  }[];
  promoDiscount?: number;
  paymentProvider: "RAZORPAY" | "COD";
}

export interface UpdateTicketStatusInput {
  status: "QUEUED" | "PREPARING" | "READY_FOR_DISPATCH" | "COMPLETED";
  station?: "BAKING" | "DECORATION" | "PACKAGING" | "DISPATCH";
  preparedBy?: string;
}

export interface IngestOrderEventInput {
  outboxEventId: string;
  eventType: "OrderCreated";
  orderId: string;
  orderNumber: string;
  branchId: string;
  items: any[];
}
