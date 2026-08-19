import { OrderMapper } from "./orders.mapper";
import { OrderDTO, KitchenTicketDTO, CreateOrderInput, UpdateTicketStatusInput, IngestOrderEventInput } from "./orders.types";
import { ORDERS_CONSTANTS } from "./orders.constants";

export class OrderRepository {
  private prisma: any;
  private inMemoryOrders: Map<string, any> = new Map();
  private idempotencyKeys: Map<string, any> = new Map();
  private inMemoryTickets: Map<string, any> = new Map();
  private ingestedEvents: Set<string> = new Set();
  private orderCounter = 200;

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
  }

  async findByIdempotencyKey(key: string): Promise<OrderDTO | null> {
    if (this.prisma) {
      const raw = await this.prisma.order.findFirst({ where: { idempotencyKey: key }, include: { items: true } });
      return raw ? OrderMapper.toOrderDTO(raw) : null;
    }
    const raw = this.idempotencyKeys.get(key);
    return raw ? OrderMapper.toOrderDTO(raw) : null;
  }

  async findById(orderId: string): Promise<OrderDTO | null> {
    if (this.prisma) {
      const raw = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
      return raw ? OrderMapper.toOrderDTO(raw) : null;
    }
    const raw = this.inMemoryOrders.get(orderId);
    return raw ? OrderMapper.toOrderDTO(raw) : null;
  }

  async listCustomerOrders(customerId: string): Promise<OrderDTO[]> {
    if (this.prisma) {
      const rawList = await this.prisma.order.findMany({ where: { customerId }, include: { items: true } });
      return rawList.map(OrderMapper.toOrderDTO);
    }
    const list = Array.from(this.inMemoryOrders.values()).filter((o) => o.customerId === customerId);
    return list.map(OrderMapper.toOrderDTO);
  }

  async createOrder(input: CreateOrderInput): Promise<OrderDTO> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    this.orderCounter++;
    const orderNumber = `${ORDERS_CONSTANTS.ORDER_NUMBER_PREFIX}-${todayStr}-${String(this.orderCounter).padStart(6, "0")}`;
    const orderId = `ord_${Date.now()}`;

    const slot = ORDERS_CONSTANTS.SLOTS[input.deliverySlotId] || ORDERS_CONSTANTS.SLOTS.STANDARD;

    let subtotal = 0;
    const items = input.cartItems.map((ci) => {
      const lineTotal = ci.unitPrice * ci.quantity;
      subtotal += lineTotal;
      return {
        productId: ci.productId,
        productTitle: ci.productTitle,
        variantId: ci.variantId || `var_${ci.productId}`,
        sku: ci.sku || `SKU-${ci.productId}`,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        optionsCost: 0.0,
        totalPrice: lineTotal,
        selectedOptions: ci.selectedOptions || [],
        customMessage: ci.customMessage,
        photoUrl: ci.photoUrl,
      };
    });

    const discountAmount = input.promoDiscount || 0.0;
    const netSubtotal = Math.max(0, subtotal - discountAmount);

    const deliveryFee = netSubtotal >= 500 ? 0.0 : 49.0;
    const slotFee = slot.additionalFee;
    const taxAmount = Number((netSubtotal * 0.05).toFixed(2));
    const totalAmount = Number((netSubtotal + deliveryFee + slotFee + taxAmount).toFixed(2));

    const rawOrder = {
      id: orderId,
      orderNumber,
      idempotencyKey: input.idempotencyKey,
      customerId: input.customerId,
      branchId: ORDERS_CONSTANTS.DEFAULT_BRANCH_ID,
      status: "CONFIRMED",
      paymentStatus: input.paymentProvider === "COD" ? "PENDING" : "AUTHORIZED",
      deliverySlot: slot,
      deliveryAddress: input.deliveryAddress,
      items,
      pricing: {
        subtotal,
        discountAmount,
        deliveryFee,
        slotFee,
        taxAmount,
        totalAmount,
      },
      timeline: [
        { status: "ORDER_PLACED", timestamp: new Date().toISOString(), note: `Order placed via ${input.paymentProvider}` },
        { status: "CONFIRMED", timestamp: new Date().toISOString(), note: "Order confirmed & assigned to Koramangala Kitchen" },
      ],
      createdAt: new Date().toISOString(),
    };

    if (this.prisma) {
      const created = await this.prisma.order.create({
        data: rawOrder,
        include: { items: true },
      });

      // Auto-create Kitchen KDS Ticket for new order
      await this.createKitchenTicketFromOrder(created);

      return OrderMapper.toOrderDTO(created);
    }

    this.inMemoryOrders.set(orderId, rawOrder);
    if (input.idempotencyKey) {
      this.idempotencyKeys.set(input.idempotencyKey, rawOrder);
    }

    // Auto-create Kitchen KDS Ticket for new order
    await this.createKitchenTicketFromOrder(rawOrder);

    return OrderMapper.toOrderDTO(rawOrder);
  }

  async createKitchenTicketFromOrder(order: any): Promise<KitchenTicketDTO> {
    const ticketId = `kds_${order.id}`;
    const rawTicket = {
      id: ticketId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId || ORDERS_CONSTANTS.DEFAULT_BRANCH_ID,
      station: "BAKING",
      status: "QUEUED",
      items: (order.items || []).map((i: any) => ({
        productId: i.productId,
        productTitle: i.productTitle,
        quantity: i.quantity,
        customMessage: i.customMessage,
        is_artisan: Boolean(i.selectedOptions?.includes("opt_")),
      })),
      estimatedPreparationMinutes: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.prisma) {
      const created = await this.prisma.kitchenTicket.create({ data: rawTicket });
      return OrderMapper.toKitchenTicketDTO(created);
    }

    this.inMemoryTickets.set(ticketId, rawTicket);
    return OrderMapper.toKitchenTicketDTO(rawTicket);
  }

  async ingestOrderEvent(input: IngestOrderEventInput): Promise<{ ticket: KitchenTicketDTO; isDuplicate: boolean }> {
    if (this.ingestedEvents.has(input.outboxEventId)) {
      const existingTicket = Array.from(this.inMemoryTickets.values()).find((t) => t.orderId === input.orderId);
      return {
        ticket: OrderMapper.toKitchenTicketDTO(existingTicket),
        isDuplicate: true,
      };
    }

    this.ingestedEvents.add(input.outboxEventId);

    let ticket = Array.from(this.inMemoryTickets.values()).find((t) => t.orderId === input.orderId);
    if (!ticket) {
      ticket = {
        id: `kds_${input.orderId}`,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        branchId: input.branchId,
        station: "BAKING",
        status: "QUEUED",
        items: input.items.map((i: any) => ({
          productId: i.productId || "prod_01",
          productTitle: i.productTitle || "Cake",
          quantity: i.quantity || 1,
          customMessage: i.customMessage,
        })),
        estimatedPreparationMinutes: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.inMemoryTickets.set(ticket.id, ticket);
    }

    return {
      ticket: OrderMapper.toKitchenTicketDTO(ticket),
      isDuplicate: false,
    };
  }

  async listKitchenTickets(branchId?: string, status?: string): Promise<KitchenTicketDTO[]> {
    if (this.prisma) {
      const where: any = {};
      if (branchId) where.branchId = branchId;
      if (status) where.status = status;
      const rawList = await this.prisma.kitchenTicket.findMany({ where, orderBy: { createdAt: "asc" } });
      return rawList.map(OrderMapper.toKitchenTicketDTO);
    }

    let list = Array.from(this.inMemoryTickets.values());
    if (branchId) list = list.filter((t) => t.branchId === branchId);
    if (status) list = list.filter((t) => t.status === status);

    return list.map(OrderMapper.toKitchenTicketDTO);
  }

  async updateKitchenTicketStatus(ticketId: string, input: UpdateTicketStatusInput): Promise<KitchenTicketDTO> {
    if (this.prisma) {
      const updated = await this.prisma.kitchenTicket.update({
        where: { id: ticketId },
        data: {
          status: input.status,
          station: input.station,
          preparedBy: input.preparedBy,
          updatedAt: new Date(),
        },
      });
      return OrderMapper.toKitchenTicketDTO(updated);
    }

    const raw = this.inMemoryTickets.get(ticketId) || Array.from(this.inMemoryTickets.values()).find((t) => t.orderId === ticketId);
    if (!raw) {
      throw new Error(`Kitchen KDS ticket with identifier '${ticketId}' not found.`);
    }

    raw.status = input.status;
    if (input.station) raw.station = input.station;
    if (input.preparedBy) raw.preparedBy = input.preparedBy;
    raw.updatedAt = new Date().toISOString();

    // Also sync master order status when kitchen ticket transitions
    const order = this.inMemoryOrders.get(raw.orderId);
    if (order) {
      if (input.status === "PREPARING") order.status = "KITCHEN_PREPARING";
      if (input.status === "READY_FOR_DISPATCH") order.status = "READY_FOR_DISPATCH";
      order.timeline.push({
        status: input.status,
        timestamp: new Date().toISOString(),
        note: `Kitchen station updated ticket to ${input.status} by ${input.preparedBy || "Kitchen Staff"}`,
      });
    }

    return OrderMapper.toKitchenTicketDTO(raw);
  }
}
