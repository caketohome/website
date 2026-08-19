import { OrdersService } from "../orders.service";
import { validateCreateOrderInput, validateUpdateTicketStatusInput, validateIngestEventInput } from "../orders.validator";

describe("OrdersService Capability 7.1 & 7.2 Unit & Integration Tests", () => {
  let service: OrdersService;

  beforeEach(() => {
    service = new OrdersService();
  });

  it("Capability 7.1: should validate create order input parameters", () => {
    expect(() => validateCreateOrderInput({})).toThrow("Property 'deliveryAddress' object is required.");
    expect(() =>
      validateCreateOrderInput({
        deliveryAddress: { street: "100 Feet Rd", city: "Bengaluru", pincode: "560038", recipientName: "Alex" },
      })
    ).toThrow("Delivery address must contain street, city, pincode, recipientName, and recipientPhone.");
    expect(() =>
      validateCreateOrderInput({
        deliveryAddress: { street: "100 Feet Rd", city: "Bengaluru", pincode: "560038", recipientName: "Alex", recipientPhone: "9876543210" },
        cartItems: [],
      })
    ).toThrow("At least 1 item is required in 'cartItems' array to place an order.");

    const valid = validateCreateOrderInput({
      deliveryAddress: { street: "100 Feet Rd", city: "Bengaluru", pincode: "560038", recipientName: "Alex", recipientPhone: "9876543210" },
      deliverySlotId: "EXPRESS_45MIN",
      cartItems: [{ productId: "prod_01", productTitle: "Chocolate Truffle", quantity: 1, unitPrice: 699 }],
      paymentProvider: "RAZORPAY",
    });

    expect(valid.deliverySlotId).toBe("EXPRESS_45MIN");
    expect(valid.cartItems.length).toBe(1);
    expect(valid.paymentProvider).toBe("RAZORPAY");
  });

  it("Capability 7.1: should create new order, calculate subtotal, slot fee, tax, and emit OrderCreated event", async () => {
    const result = await service.createOrder({
      customerId: "cus_100",
      pincode: "560038",
      deliveryAddress: { street: "100 Feet Rd", city: "Bengaluru", pincode: "560038", recipientName: "Rahul", recipientPhone: "+919876543210" },
      deliverySlotId: "EXPRESS_45MIN",
      cartItems: [{ productId: "prod_01", productTitle: "Belgian Truffle Cake", quantity: 1, unitPrice: 699.0 }],
      paymentProvider: "RAZORPAY",
    });

    expect(result.order).toBeDefined();
    expect(result.order.orderNumber).toMatch(/^CTH-\d{8}-\d{6}$/);
    expect(result.order.status).toBe("CONFIRMED");
    expect(result.order.pricing.subtotal).toBe(699.0);
    expect(result.order.pricing.deliveryFee).toBe(0.0); // Free delivery >= 500
    expect(result.order.pricing.slotFee).toBe(50.0); // Express 45-min fee
    expect(result.order.pricing.taxAmount).toBe(34.95);
    expect(result.order.pricing.totalAmount).toBe(783.95);

    expect(result.outboxEvent).toBeDefined();
    expect(result.outboxEvent.eventType).toBe("OrderCreated");
    expect(result.outboxEvent.payload.orderId).toBe(result.order.id);
  });

  it("Capability 7.1 Idempotency Safeguard: should return identical existing order on duplicate idempotency key submission", async () => {
    const idempotencyKey = "idempotent_key_abc123";

    const payload = {
      idempotencyKey,
      customerId: "cus_100",
      pincode: "560038",
      deliveryAddress: { street: "100 Feet Rd", city: "Bengaluru", pincode: "560038", recipientName: "Rahul", recipientPhone: "+919876543210" },
      deliverySlotId: "STANDARD" as const,
      cartItems: [{ productId: "prod_01", productTitle: "Belgian Truffle Cake", quantity: 1, unitPrice: 699.0 }],
      paymentProvider: "RAZORPAY" as const,
    };

    const first = await service.createOrder(payload);
    expect(first.isIdempotentReplay).toBe(false);

    const second = await service.createOrder(payload);
    expect(second.isIdempotentReplay).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(second.order.orderNumber).toBe(first.order.orderNumber);
    expect(second.outboxEvent.status).toBe("IDEMPOTENT_REPLAY");
  });

  it("Capability 7.2: should validate kitchen ticket status update and event ingestion inputs", () => {
    expect(() => validateUpdateTicketStatusInput({ status: "INVALID_STATUS" })).toThrow(
      "Ticket 'status' must be one of: QUEUED, PREPARING, READY_FOR_DISPATCH, COMPLETED."
    );
    expect(() => validateIngestEventInput({})).toThrow("Property 'outboxEventId' is required for event ingestion.");

    const validStatus = validateUpdateTicketStatusInput({ status: "PREPARING", station: "BAKING", preparedBy: "Chef Chefkin" });
    expect(validStatus.status).toBe("PREPARING");
    expect(validStatus.station).toBe("BAKING");
    expect(validStatus.preparedBy).toBe("Chef Chefkin");
  });

  it("Capability 7.2: should ingest OrderCreated event and process kitchen ticket lifecycle", async () => {
    // 1. Order Creation
    const orderRes = await service.createOrder({
      customerId: "cus_kds_test",
      pincode: "560038",
      deliveryAddress: { street: "Indiranagar", city: "Bengaluru", pincode: "560038", recipientName: "Chef", recipientPhone: "+919999988888" },
      deliverySlotId: "STANDARD",
      cartItems: [{ productId: "prod_03", productTitle: "Red Velvet Cake", quantity: 1, unitPrice: 749.0, selectedOptions: ["opt_premium_packaging"] }],
      paymentProvider: "RAZORPAY",
    });

    // 2. Ingest Event into KDS
    const ingestRes1 = await service.ingestOrderEvent({
      outboxEventId: `evt_${Date.now()}`,
      eventType: "OrderCreated",
      orderId: orderRes.order.id,
      orderNumber: orderRes.order.orderNumber,
      branchId: orderRes.order.branchId,
      items: orderRes.order.items,
    });

    expect(ingestRes1.isDuplicate).toBe(false);
    expect(ingestRes1.ticket.status).toBe("QUEUED");

    // 3. Duplicate event ingestion (Idempotent Event Ingestion Test)
    const ingestRes2 = await service.ingestOrderEvent({
      outboxEventId: ingestRes1.ticket.id, // Duplicate event ID
      eventType: "OrderCreated",
      orderId: orderRes.order.id,
      orderNumber: orderRes.order.orderNumber,
      branchId: orderRes.order.branchId,
      items: orderRes.order.items,
    });
    expect(ingestRes2.isDuplicate).toBe(true);

    // 4. Kitchen Preparation Lifecycle State Machine Transition
    const updatedTicket = await service.updateKitchenTicketStatus(ingestRes1.ticket.id, {
      status: "PREPARING",
      station: "BAKING",
      preparedBy: "Chef Vikram",
    });
    expect(updatedTicket.status).toBe("PREPARING");
    expect(updatedTicket.station).toBe("BAKING");

    // 5. Verify Master Order Timeline Synchronized
    const masterOrder = await service.getOrder(orderRes.order.id);
    expect(masterOrder.status).toBe("KITCHEN_PREPARING");
    expect(masterOrder.timeline.some((t) => t.status === "PREPARING")).toBe(true);
  });
});
